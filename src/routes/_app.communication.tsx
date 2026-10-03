import { useState, useRef, useEffect, useCallback, DragEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { SectionCard } from "@/components/ui-ext/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MessageSquare, Send, Bell, Hash, Plus, Megaphone,
  Trash2, Pin, ShieldCheck, Search, Image, Video, FileText, Paperclip,
  ExternalLink, X, Loader2, Download, Globe, Eye,
  ChevronDown, Check, CheckCheck, AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  useNotifications,
  useMarkNotificationRead,
  useChatMessages,
  useSendMessage,
  useAnnouncements,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useDirectUsers,
  useDirectConversation,
  useSendDirectMessage,
  useDirectMessages,
} from "@/lib/api-hooks";
import { useAuthStore } from "@/store/authStore";
import { normalizeRole } from "@/lib/permissions";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { parseGoogleDriveLink, loadGoogleScripts } from "@/lib/google-drive";
import { getSocket } from "@/routes/__root";

export const Route = createFileRoute("/_app/communication")({
  head: () => ({ meta: [{ title: "Communication — Thenam ERP" }] }),
  component: CommunicationPage,
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActiveChat {
  type: "channel" | "dm";
  id: string;                      // 'general' or recipient user _id
  recipientUserId?: string;
  name: string;
  avatar?: string;
  designation?: string;
}

interface DraftAttachment {
  id: string;
  file?: File;
  name: string;
  type: string;   // 'image' | 'video' | 'file'
  size: number;
  progress: number;
  status: "uploading" | "uploaded" | "failed";
  url?: string;
  storagePath?: string;
  provider: "firebase" | "google-drive" | "local";
  fileId?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getFileUrl(url?: string) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  const backendBase = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");
  return `${backendBase}${url.startsWith("/") ? "" : "/"}${url}`;
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function formatTime(d: string | Date) {
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function classifyMime(file: File): "image" | "video" | "file" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "file";
}

// ─── Main Component ───────────────────────────────────────────────────────────

function CommunicationPage() {
  const { user } = useAuthStore();
  const currentUserId = (user as any)?._id || (user as any)?.id;
  const queryClient = useQueryClient();

  // ── Composer state ────────────────────────────────────────────────────────
  const [draft, setDraft] = useState("");
  const [draftAttachments, setDraftAttachments] = useState<DraftAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSendingRef = useRef(false);            // double-click guard

  // ── Scroll state ──────────────────────────────────────────────────────────
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const prevChatIdRef = useRef("");
  const [showNewMessages, setShowNewMessages] = useState(false);

  // ── Search & active conversation ──────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [activeChat, setActiveChat] = useState<ActiveChat>({
    type: "channel",
    id: "general",
    name: "general",
  });
  const activeChatRef = useRef(activeChat);
  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);

  // ── Announcement modal ────────────────────────────────────────────────────
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [annPriority, setAnnPriority] = useState<"Normal" | "Important" | "Urgent">("Normal");
  const [annTargetAudience, setAnnTargetAudience] = useState<"Everyone" | "Department" | "Selected Employees">("Everyone");
  const [annDepartment, setAnnDepartment] = useState("");
  const [annTargetUsers, setAnnTargetUsers] = useState<string[]>([]);
  const [annPinned, setAnnPinned] = useState(false);

  // ── Google Drive modal ────────────────────────────────────────────────────
  const [gdModalOpen, setGdModalOpen] = useState(false);
  const [gdLinkInput, setGdLinkInput] = useState("");
  const [gdNameInput, setGdNameInput] = useState("");

  const userRole = normalizeRole(user?.role).toLowerCase();
  const canPostAnnouncement =
    ["admin", "founder"].includes(userRole) ||
    ["admin", "founder", "manager", "super admin"].includes((user?.role || "").toLowerCase());

  // ── API Hooks ─────────────────────────────────────────────────────────────
  const { data: directUsers, isLoading: isUsersLoading } = useDirectUsers();
  const { data: notifications, isLoading: isNotifsLoading } = useNotifications();
  const markNotifRead = useMarkNotificationRead();

  // Channel (General) — only enabled when in channel mode
  const { data: channelMessages, isLoading: isChannelMessagesLoading } = useChatMessages(
    activeChat.type === "channel" ? activeChat.id : undefined
  );
  const sendChannelMessage = useSendMessage();

  // DM — only enabled when in dm mode
  const { data: directConversation } = useDirectConversation(
    activeChat.type === "dm" ? activeChat.recipientUserId : undefined
  );
  const { data: directMessages, isLoading: isDirectMessagesLoading } = useDirectMessages(
    activeChat.type === "dm" ? activeChat.recipientUserId : undefined
  );
  const sendDirectMessage = useSendDirectMessage(activeChat.recipientUserId || "");

  const { data: announcements, isLoading: isAnnouncementsLoading } = useAnnouncements();
  const createAnnouncement = useCreateAnnouncement();
  const deleteAnnouncement = useDeleteAnnouncement();

  const isMessagesLoading =
    activeChat.type === "channel" ? isChannelMessagesLoading : isDirectMessagesLoading;

  // Single authoritative list — direct from server via React Query
  const messages: any[] = activeChat.type === "channel"
    ? (channelMessages || [])
    : (directMessages || []);

  const isSending = sendChannelMessage.isPending || sendDirectMessage.isPending;

  // ── Scroll helpers ────────────────────────────────────────────────────────
  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : ("instant" as any) });
  }, []);

  const handleScrollEvent = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = dist < 120;
    if (isNearBottomRef.current) setShowNewMessages(false);
  }, []);

  // On conversation switch → jump to bottom instantly
  useEffect(() => {
    const chatId =
      activeChat.type === "dm" ? activeChat.recipientUserId! : activeChat.id;
    if (chatId !== prevChatIdRef.current) {
      prevChatIdRef.current = chatId;
      isNearBottomRef.current = true;
      setShowNewMessages(false);
      setTimeout(() => scrollToBottom(false), 80);
    }
  }, [activeChat, scrollToBottom]);

  // On new messages — scroll if near bottom, else show banner
  useEffect(() => {
    if (!messages.length) return;
    if (isNearBottomRef.current) {
      scrollToBottom();
      setShowNewMessages(false);
    } else {
      setShowNewMessages(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // Close attach menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Socket: real-time message events ─────────────────────────────────────
  // Listen to message:new (channel messages) and dm:new (direct messages).
  // When received, invalidate the correct React Query cache to refresh messages.
  // The backend uses clientMessageId idempotency to guarantee no duplicate DB entries.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleMessageNew = (data: any) => {
      const currentChat = activeChatRef.current;
      if (currentChat.type === "channel" && data._channelKey === currentChat.id) {
        queryClient.invalidateQueries({ queryKey: ["chat-messages", currentChat.id] });
      }
    };

    const handleDmNew = (data: any) => {
      const currentChat = activeChatRef.current;
      if (currentChat.type === "dm" && (data._conversationUserId === currentChat.recipientUserId || data.senderId?._id === currentChat.recipientUserId)) {
        queryClient.invalidateQueries({ queryKey: ["direct-messages", currentChat.recipientUserId] });
      }
      // Always refresh direct-users list to update last message preview and unread count
      queryClient.invalidateQueries({ queryKey: ["direct-users"] });
    };

    const handleAnnouncementNew = () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      queryClient.invalidateQueries({ queryKey: ["announcements-active"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };

    const handleNotificationNew = () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };

    socket.on("message:new", handleMessageNew);
    socket.on("dm:new", handleDmNew);
    socket.on("announcement:new", handleAnnouncementNew);
    socket.on("notification:new", handleNotificationNew);
    socket.on("task:assigned", handleNotificationNew);

    return () => {
      socket.off("message:new", handleMessageNew);
      socket.off("dm:new", handleDmNew);
      socket.off("announcement:new", handleAnnouncementNew);
      socket.off("notification:new", handleNotificationNew);
      socket.off("task:assigned", handleNotificationNew);
    };
  }, [queryClient]);


  // ── Drag & Drop ───────────────────────────────────────────────────────────
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragOver(true);
  };
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragOver(false);
  };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragOver(false);
    if (e.dataTransfer.files?.length) handleFilesUpload(Array.from(e.dataTransfer.files));
  };

  // ── File Upload (Firebase SDK with Server Fallback) ─────────────────────
  const handleFilesUpload = (files: File[]) => {
    const LIMITS: Record<string, number> = {
      image: 10 * 1024 * 1024,
      video: 50 * 1024 * 1024,
      file:  25 * 1024 * 1024,
    };

    files.forEach(async (file) => {
      const typeClass = classifyMime(file);
      const limit = LIMITS[typeClass];

      if (file.size > limit) {
        toast.error(
          `"${file.name}" is too large. ` +
          `Max ${typeClass === "video" ? "50 MB" : typeClass === "image" ? "10 MB" : "25 MB"}.`
        );
        return;
      }

      const localId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newAtt: DraftAttachment = {
        id: localId,
        file,
        name: file.name,
        type: typeClass,
        size: file.size,
        progress: 10,
        status: "uploading",
        provider: "firebase",
      };
      setDraftAttachments((p) => [...p, newAtt]);

      const uploadToBackendServer = async () => {
        try {
          const formData = new FormData();
          formData.append("file", file);
          const res = await api.post("/upload/single", formData, {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                setDraftAttachments((p) =>
                  p.map((a) => (a.id === localId ? { ...a, progress } : a))
                );
              }
            },
          });
          const serverUrl = res.data.data?.url || res.data.data?.path || "";
          setDraftAttachments((p) =>
            p.map((a) =>
              a.id === localId
                ? { ...a, status: "uploaded", url: serverUrl, provider: "local", progress: 100 }
                : a
            )
          );
        } catch (err: any) {
          console.error("[Upload] Server fallback error:", err);
          setDraftAttachments((p) =>
            p.map((a) => (a.id === localId ? { ...a, status: "failed" } : a))
          );
          toast.error(`Upload failed for "${file.name}".`);
        }
      };

      try {
        const convId =
          activeChat.type === "dm"
            ? directConversation?._id || "temp"
            : "general";
        const safeFilename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const storagePath =
          activeChat.type === "dm"
            ? `communication/direct/${convId}/${safeFilename}`
            : `communication/general/${safeFilename}`;

        const storageRef = ref(storage, storagePath);
        const task = uploadBytesResumable(storageRef, file);

        task.on(
          "state_changed",
          (snap) => {
            const progress = Math.round(
              (snap.bytesTransferred / snap.totalBytes) * 100
            );
            setDraftAttachments((p) =>
              p.map((a) => (a.id === localId ? { ...a, progress } : a))
            );
          },
          (err) => {
            console.warn("[Upload] Firebase storage failed, switching to local upload fallback:", err.message);
            uploadToBackendServer();
          },
          async () => {
            try {
              const url = await getDownloadURL(task.snapshot.ref);
              setDraftAttachments((p) =>
                p.map((a) =>
                  a.id === localId
                    ? { ...a, status: "uploaded", url, storagePath, progress: 100 }
                    : a
                )
              );
            } catch (urlErr) {
              console.warn("[Upload] Could not get download URL, using server fallback");
              uploadToBackendServer();
            }
          }
        );
      } catch (fbErr) {
        console.warn("[Upload] Firebase init error, using server fallback:", fbErr);
        uploadToBackendServer();
      }
    });
  };

  const removeDraftAttachment = (id: string) =>
    setDraftAttachments((p) => p.filter((a) => a.id !== id));

  // ── Google Drive ──────────────────────────────────────────────────────────
  const handleAddGoogleDriveLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gdLinkInput.trim()) return;
    const { fileId, parsedUrl } = parseGoogleDriveLink(gdLinkInput);
    if (!fileId) { toast.error("Invalid Google Drive URL."); return; }
    setDraftAttachments((p) => [
      ...p,
      {
        id: `gd-${Date.now()}`,
        name: gdNameInput.trim() || "Google Drive File",
        type: "file", size: 0, progress: 100,
        status: "uploaded", url: parsedUrl,
        provider: "google-drive", fileId,
      },
    ]);
    setGdLinkInput(""); setGdNameInput("");
    setGdModalOpen(false);
    toast.success("Google Drive file attached!");
  };

  const handleGooglePickerOpen = async () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const developerKey = import.meta.env.VITE_GOOGLE_DEVELOPER_KEY;
    if (!clientId || !developerKey) {
      toast.info("Google OAuth credentials not configured. Please use the manual link tab.");
      return;
    }
    try {
      toast.loading("Connecting Google Drive…");
      await loadGoogleScripts();
      const auth = (window as any).gapi.auth2.getAuthInstance();
      if (!auth) {
        (window as any).gapi.load("auth2", {
          callback: () =>
            (window as any).gapi.auth2
              .init({ client_id: clientId, scope: "https://www.googleapis.com/auth/drive.readonly" })
              .then(() => triggerPicker(developerKey)),
        });
      } else {
        triggerPicker(developerKey);
      }
    } catch (err: any) {
      toast.dismiss();
      toast.error("Failed to load Google SDK: " + err.message);
    }
  };

  const triggerPicker = (developerKey: string) => {
    toast.dismiss();
    const token = (window as any).gapi.auth.getToken();
    if (token) createPicker(token.access_token, developerKey);
    else
      (window as any).gapi.auth2
        .getAuthInstance()
        .signIn()
        .then((u: any) => createPicker(u.getAuthResponse().access_token, developerKey));
  };

  const createPicker = (accessToken: string, developerKey: string) => {
    const view = new (window as any).google.picker.View(
      (window as any).google.picker.ViewId.DOCS
    );
    new (window as any).google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(developerKey)
      .setCallback((data: any) => {
        if (data.action === (window as any).google.picker.Action.PICKED) {
          const doc = data.docs[0];
          setDraftAttachments((p) => [
            ...p,
            {
              id: `gd-${Date.now()}`,
              name: doc.name, type: "file", size: doc.sizeBytes || 0,
              progress: 100, status: "uploaded", url: doc.url,
              provider: "google-drive", fileId: doc.id,
            },
          ]);
          setGdModalOpen(false);
          toast.success(`Attached: ${doc.name}`);
        }
      })
      .build()
      .setVisible(true);
  };

  // ── Send handler ──────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    if (isSendingRef.current || isSending) return;

    const hasText = draft.trim();
    const hasAtts = draftAttachments.length > 0;
    if (!hasText && !hasAtts) return;

    if (draftAttachments.some((a) => a.status === "uploading")) {
      toast.error("Please wait for uploads to finish.");
      return;
    }
    if (draftAttachments.some((a) => a.status === "failed")) {
      toast.error("Some attachments failed to upload. Remove them or retry.");
      return;
    }

    isSendingRef.current = true;

    // ── Idempotency key ────────────────────────────────────────────────────
    // One UUID per send action. Even if this POST is retried (network flap,
    // Axios retry, React StrictMode double-invoke), the backend will return
    // the existing message and never create a second DB record.
    const clientMessageId = crypto.randomUUID();

    const payloadAttachments = draftAttachments.map((a) => ({
      url: a.url || "",
      name: a.name,
      type: a.type,
      size: a.size,
      storageProvider: a.provider,
      storagePath: a.storagePath || "",
    }));

    let messageType: "text" | "image" | "video" | "file" = "text";
    if (payloadAttachments.length === 1) {
      const t = payloadAttachments[0].type as string;
      if (t === "image" || t === "video" || t === "file") messageType = t;
    } else if (payloadAttachments.length > 1) {
      messageType = "file";
    }

    const content = draft.trim();
    setDraft("");
    setDraftAttachments([]);

    const onError = (err: any) => {
      const msg = err?.response?.data?.message || "Message could not be sent. Please try again.";
      toast.error(msg);
      setDraft(content); // restore on failure
    };
    const onSettled = () => { isSendingRef.current = false; };

    if (activeChat.type === "dm" && activeChat.recipientUserId) {
      sendDirectMessage.mutate(
        { text: content, content, messageType, attachments: payloadAttachments, clientMessageId },
        { onError, onSettled }
      );
    } else {
      sendChannelMessage.mutate(
        { content, text: content, channel: activeChat.id, messageType, attachments: payloadAttachments, clientMessageId },
        { onError, onSettled }
      );
    }
  }, [draft, draftAttachments, activeChat, isSending, sendDirectMessage, sendChannelMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Announcements ─────────────────────────────────────────────────────────
  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) {
      toast.error("Announcement title and message are required.");
      return;
    }
    if (annTargetAudience === "Department" && !annDepartment.trim()) {
      toast.error("Please enter target department.");
      return;
    }
    if (annTargetAudience === "Selected Employees" && annTargetUsers.length === 0) {
      toast.error("Please select at least one employee.");
      return;
    }

    createAnnouncement.mutate(
      {
        title: annTitle.trim(),
        content: annContent.trim(),
        message: annContent.trim(),
        priority: annPriority,
        targetAudience: annTargetAudience,
        department: annDepartment.trim(),
        targetUsers: annTargetUsers,
        pinned: annPinned,
      },
      {
        onSuccess: () => {
          toast.success("Announcement published successfully!");
          setAnnouncementModalOpen(false);
          setAnnTitle("");
          setAnnContent("");
          setAnnPriority("Normal");
          setAnnTargetAudience("Everyone");
          setAnnDepartment("");
          setAnnTargetUsers([]);
          setAnnPinned(false);
          queryClient.invalidateQueries({ queryKey: ["announcements"] });
          queryClient.invalidateQueries({ queryKey: ["announcements-active"] });
        },
        onError: (err: any) =>
          toast.error(err.response?.data?.message || "Failed to post announcement."),
      }
    );
  };

  const handleDeleteAnnouncement = (id: string) =>
    deleteAnnouncement.mutate(id, {
      onSuccess: () => toast.success("Deleted"),
      onError: (err: any) => toast.error(err.response?.data?.message || "Failed to delete."),
    });

  // ── Filter users ──────────────────────────────────────────────────────────
  const filteredUsers = (directUsers || [])
    .filter((u: any) => u._id !== currentUserId)
    .filter((u: any) => {
      if (!searchTerm) return true;
      const t = searchTerm.toLowerCase();
      return (
        u.name?.toLowerCase().includes(t) ||
        u.email?.toLowerCase().includes(t) ||
        (u.designation || u.role || "").toLowerCase().includes(t)
      );
    });

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <PageContainer>
      <PageHeader
        title="Communication & Workspace Chat"
        subtitle="Group channels, 1-on-1 messaging, and leadership announcements."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-4 items-start">

        {/* ── LEFT SIDEBAR ─────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Channels */}
          <SectionCard title="Channels" description="Group conversations">
            <div className="space-y-1">
              <button
                onClick={() =>
                  setActiveChat({ type: "channel", id: "general", name: "general" })
                }
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeChat.type === "channel" && activeChat.id === "general"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold shadow-sm"
                    : "text-muted-foreground hover:bg-card/80 hover:text-foreground"
                }`}
              >
                <Hash className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">everyone (general)</span>
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                  All
                </Badge>
              </button>
            </div>
          </SectionCard>

          {/* Direct Messages */}
          <SectionCard title="Direct Messages" description="1-on-1 with team members">
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search people…"
                  className="pl-9 h-9 text-xs rounded-xl border-border bg-card/50"
                />
              </div>

              <div className="space-y-0.5 max-h-[380px] overflow-y-auto pr-1">
                {isUsersLoading ? (
                  <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" />
                    Loading users…
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">
                    {searchTerm ? "No users match your search" : "No team members found"}
                  </p>
                ) : (
                  filteredUsers.map((emp: any) => {
                    const isSelected =
                      activeChat.type === "dm" && activeChat.recipientUserId === emp._id;
                    const hasUnread = emp.unreadCount > 0;
                    const isOnline =
                      !!emp.lastMessageAt &&
                      Date.now() - new Date(emp.lastMessageAt).getTime() < 30 * 60 * 1000;

                    return (
                      <button
                        key={emp._id}
                        onClick={() =>
                          setActiveChat({
                            type: "dm",
                            id: emp._id,
                            recipientUserId: emp._id,
                            name: emp.name,
                            avatar: emp.avatar,
                            designation: emp.designation || emp.role,
                          })
                        }
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs transition-all border ${
                          isSelected
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold border-emerald-500/20"
                            : "text-foreground hover:bg-card/80 border-transparent hover:border-border"
                        }`}
                      >
                        <div className="relative shrink-0">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={emp.avatar || ""} />
                            <AvatarFallback className="text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                              {emp.name?.substring(0, 2).toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          {isOnline && (
                            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background" />
                          )}
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <div className="flex justify-between items-center gap-1">
                            <p className={`truncate ${hasUnread ? "font-bold text-foreground" : "font-medium"}`}>
                              {emp.name}
                            </p>
                            {emp.lastMessageAt && (
                              <span className="text-[9px] text-muted-foreground shrink-0 font-normal">
                                {formatTime(emp.lastMessageAt)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-0.5">
                            <p className="text-[9px] text-muted-foreground truncate max-w-[75%]">
                              {emp.lastMessage || emp.designation || emp.role || "Team Member"}
                            </p>
                            {hasUnread && (
                              <span className="bg-emerald-500 text-white text-[9px] min-w-4 h-4 px-1 flex items-center justify-center rounded-full shrink-0 font-bold">
                                {emp.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ── MIDDLE: CHAT WINDOW ──────────────────────────────────── */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative rounded-2xl border shadow-sm flex flex-col overflow-hidden bg-card transition-colors ${
            isDragOver ? "border-emerald-500 bg-emerald-500/5" : "border-border"
          }`}
          style={{ height: "calc(100vh - 200px)", minHeight: "520px" }}
        >
          {/* Drag overlay */}
          {isDragOver && (
            <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center gap-2 z-50 pointer-events-none rounded-2xl border-2 border-dashed border-emerald-500 m-1">
              <Paperclip className="h-10 w-10 text-emerald-500 animate-bounce" />
              <p className="font-semibold text-sm text-emerald-700">Drop files to attach</p>
              <p className="text-xs text-muted-foreground">Images, videos, documents up to 50 MB</p>
            </div>
          )}

          {/* ── Chat header ── */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
            {activeChat.type === "channel" ? (
              <>
                <div className="h-9 w-9 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <Hash className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight">#everyone (general)</p>
                  <p className="text-[10px] text-muted-foreground">All organization members</p>
                </div>
              </>
            ) : (
              <>
                <div className="relative shrink-0">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={activeChat.avatar || ""} />
                    <AvatarFallback className="text-xs bg-emerald-500/20 text-emerald-700">
                      {activeChat.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight">{activeChat.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {activeChat.designation || "Direct Message"} &nbsp;·&nbsp;
                    <span className="text-emerald-500">● Online</span>
                  </p>
                </div>
              </>
            )}
          </div>

          {/* ── Messages scroll container ── */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScrollEvent}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-2"
          >
            {isMessagesLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                <span className="text-xs">Loading messages…</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <MessageSquare className="h-8 w-8 text-emerald-500 opacity-50" />
                </div>
                <p className="text-sm font-semibold text-foreground">No messages yet</p>
                <p className="text-xs text-muted-foreground max-w-48">
                  {activeChat.type === "channel"
                    ? "Be the first to send a message to #general"
                    : `Start a conversation with ${activeChat.name}`}
                </p>
              </div>
            ) : (
              messages.map((msg: any) => {
                // Determine sender — handle both populated obj and raw ID
                const senderId =
                  msg.sender?._id || msg.sender?.id || msg.senderId?._id || msg.senderId;
                const isMe = senderId === currentUserId;
                const isRead = !!msg.readAt;
                const senderName = msg.sender?.name || msg.senderId?.name || "Member";
                const senderAvatar = msg.sender?.avatar || msg.senderId?.avatar || "";

                return (
                  <div
                    key={msg._id}
                    className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}
                  >
                    {/* Avatar – received only */}
                    {!isMe && (
                      <Avatar className="h-7 w-7 shrink-0 mb-1">
                        <AvatarImage src={senderAvatar} />
                        <AvatarFallback className="text-[10px] bg-emerald-500/20 text-emerald-700">
                          {senderName.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}

                    <div
                      className={`max-w-[72%] flex flex-col ${
                        isMe ? "items-end" : "items-start"
                      }`}
                    >
                      {/* Sender name in General channel (received only) */}
                      {!isMe && activeChat.type === "channel" && (
                        <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 px-1 mb-0.5">
                          {senderName}
                        </span>
                      )}

                      {/* Text bubble */}
                      {(msg.content || msg.text) && (
                        <div
                          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                            isMe
                              ? "rounded-br-sm text-white"
                              : "rounded-bl-sm bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 text-foreground"
                          }`}
                          style={
                            isMe
                              ? { background: "linear-gradient(135deg,#059669 0%,#065f46 100%)" }
                              : undefined
                          }
                        >
                          <p className="whitespace-pre-wrap break-words">
                            {msg.content || msg.text}
                          </p>
                          {/* Timestamp + tick */}
                          <div
                            className={`flex items-center gap-1 mt-1 ${
                              isMe ? "justify-end" : "justify-start"
                            }`}
                          >
                            <span
                              className={`text-[10px] ${
                                isMe ? "text-emerald-200" : "text-muted-foreground"
                              }`}
                            >
                              {formatTime(msg.createdAt)}
                            </span>
                            {isMe &&
                              (isRead ? (
                                <CheckCheck className="h-3 w-3 text-emerald-200" />
                              ) : (
                                <Check className="h-3 w-3 text-emerald-200" />
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Attachments */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="space-y-1.5 mt-1 w-full">
                          {msg.attachments.map((att: any, idx: number) => {
                            const isImg =
                              att.type === "image" ||
                              /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(att.name);
                            const isVid =
                              att.type === "video" ||
                              /\.(mp4|webm|mov|avi|mpeg)$/i.test(att.name);
                            const isGd = att.storageProvider === "google-drive";
                            const fullUrl = getFileUrl(att.url);

                            if (isImg)
                              return (
                                <div
                                  key={idx}
                                  className="relative group max-w-xs rounded-2xl overflow-hidden border border-emerald-200/40 shadow-sm"
                                >
                                  <img
                                    src={fullUrl}
                                    alt={att.name}
                                    className="max-h-52 object-cover w-full"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <a
                                      href={fullUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </a>
                                    <a
                                      href={fullUrl}
                                      download={att.name}
                                      className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white"
                                    >
                                      <Download className="h-4 w-4" />
                                    </a>
                                  </div>
                                </div>
                              );

                            if (isVid)
                              return (
                                <div
                                  key={idx}
                                  className="max-w-sm rounded-2xl overflow-hidden border border-border shadow-sm"
                                >
                                  <video
                                    controls
                                    src={fullUrl}
                                    className="w-full max-h-52 object-contain bg-black"
                                  />
                                </div>
                              );

                            // Document / Google Drive card
                            return (
                              <a
                                key={idx}
                                href={fullUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-2.5 p-3 rounded-2xl border text-xs shadow-sm max-w-xs transition-all ${
                                  isMe
                                    ? "bg-emerald-600/20 hover:bg-emerald-600/30 border-emerald-500/30 text-foreground"
                                    : "bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100/60 border-emerald-200/40"
                                }`}
                              >
                                <div
                                  className={`p-2 rounded-xl ${
                                    isGd
                                      ? "bg-blue-500/10 text-blue-500"
                                      : "bg-emerald-500/10 text-emerald-600"
                                  }`}
                                >
                                  {isGd ? (
                                    <Globe className="h-5 w-5" />
                                  ) : (
                                    <FileText className="h-5 w-5" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold truncate">{att.name}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {isGd ? "Google Drive" : formatBytes(att.size)}
                                  </p>
                                </div>
                                {isGd ? (
                                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                ) : (
                                  <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                )}
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {/* Scroll anchor */}
            <div id="chat-bottom-anchor" />
          </div>

          {/* ── New messages banner ── */}
          <AnimatePresence>
            {showNewMessages && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute bottom-[130px] left-1/2 -translate-x-1/2 z-20"
              >
                <button
                  onClick={() => { scrollToBottom(); setShowNewMessages(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-semibold shadow-lg hover:bg-emerald-700 transition-colors"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                  New messages
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Draft attachment previews ── */}
          {draftAttachments.length > 0 && (
            <div className="px-4 py-2 border-t border-border bg-card/60 backdrop-blur-sm flex flex-wrap gap-2 max-h-20 overflow-y-auto shrink-0">
              {draftAttachments.map((att) => (
                <div
                  key={att.id}
                  className={`flex items-center gap-2 p-1.5 pr-2.5 rounded-xl border text-[11px] shadow-sm relative group max-w-[200px] ${
                    att.status === "failed"
                      ? "border-destructive/50 bg-destructive/5"
                      : "border-border bg-card"
                  }`}
                >
                  <div
                    className={`p-1 rounded-lg shrink-0 ${
                      att.status === "failed"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-emerald-500/10 text-emerald-600"
                    }`}
                  >
                    {att.provider === "google-drive" ? (
                      <Globe className="h-3.5 w-3.5" />
                    ) : att.type === "image" ? (
                      <Image className="h-3.5 w-3.5" />
                    ) : att.type === "video" ? (
                      <Video className="h-3.5 w-3.5" />
                    ) : att.status === "failed" ? (
                      <AlertCircle className="h-3.5 w-3.5" />
                    ) : (
                      <Paperclip className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="truncate flex-1 min-w-0 pr-2">
                    <p className="font-medium truncate">{att.name}</p>
                    {att.status === "uploading" ? (
                      <div className="w-full bg-secondary h-1 rounded-full mt-0.5 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full transition-all duration-300"
                          style={{ width: `${att.progress}%` }}
                        />
                      </div>
                    ) : att.status === "failed" ? (
                      <span className="text-[9px] text-destructive font-semibold">
                        Upload failed
                      </span>
                    ) : (
                      <span className="text-[9px] text-emerald-600 font-medium">
                        Ready ✓
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removeDraftAttachment(att.id)}
                    className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-muted hover:bg-destructive rounded-full border border-border text-foreground hover:text-white flex items-center justify-center transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── Composer ── */}
          <div className="px-4 py-3 border-t border-border bg-card/80 backdrop-blur-sm shrink-0">
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFilesUpload(Array.from(e.target.files));
                e.target.value = ""; // allow same file re-select
              }}
            />

            <div className="flex items-end gap-2">
              {/* Attach button */}
              <div className="relative shrink-0" ref={attachMenuRef}>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setShowAttachMenu((p) => !p)}
                  className="rounded-xl h-10 w-10 border-border text-muted-foreground hover:text-emerald-600 hover:border-emerald-500/40"
                >
                  <Plus className="h-5 w-5" />
                </Button>

                <AnimatePresence>
                  {showAttachMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.96 }}
                      transition={{ duration: 0.12 }}
                      className="absolute bottom-12 left-0 bg-card border border-border rounded-2xl shadow-xl p-2 w-52 z-50 space-y-0.5"
                    >
                      <button
                        onClick={() => {
                          if (fileInputRef.current) {
                            fileInputRef.current.accept = "image/*";
                          }
                          fileInputRef.current?.click();
                          setShowAttachMenu(false);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 hover:bg-emerald-500/10 rounded-xl text-xs font-semibold text-foreground w-full transition-colors"
                      >
                        <Image className="h-4 w-4 text-emerald-500" /> Photo / Image
                      </button>
                      <button
                        onClick={() => {
                          if (fileInputRef.current) {
                            fileInputRef.current.accept = "video/*";
                          }
                          fileInputRef.current?.click();
                          setShowAttachMenu(false);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 hover:bg-emerald-500/10 rounded-xl text-xs font-semibold text-foreground w-full transition-colors"
                      >
                        <Video className="h-4 w-4 text-blue-500" /> Video
                      </button>
                      <button
                        onClick={() => {
                          if (fileInputRef.current) {
                            fileInputRef.current.accept =
                              "application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip";
                          }
                          fileInputRef.current?.click();
                          setShowAttachMenu(false);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 hover:bg-emerald-500/10 rounded-xl text-xs font-semibold text-foreground w-full transition-colors"
                      >
                        <FileText className="h-4 w-4 text-amber-500" /> Document / File
                      </button>
                      <button
                        onClick={() => {
                          if (fileInputRef.current) {
                            fileInputRef.current.accept = "*/*";
                          }
                          fileInputRef.current?.click();
                          setShowAttachMenu(false);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 hover:bg-emerald-500/10 rounded-xl text-xs font-semibold text-foreground w-full transition-colors"
                      >
                        <Paperclip className="h-4 w-4 text-muted-foreground" /> Other File
                      </button>
                      <div className="my-1 border-t border-border" />
                      <button
                        onClick={() => {
                          setGdModalOpen(true);
                          setShowAttachMenu(false);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 hover:bg-emerald-500/10 rounded-xl text-xs font-semibold text-foreground w-full transition-colors"
                      >
                        <Globe className="h-4 w-4 text-blue-400" /> Google Drive
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Message textarea */}
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  activeChat.type === "channel"
                    ? "Message #everyone (general)…"
                    : `Message ${activeChat.name}…`
                }
                rows={1}
                className="rounded-xl border-border focus-visible:ring-emerald-500 flex-1 min-w-0 resize-none min-h-10 max-h-32 py-2.5 text-sm leading-snug overflow-y-auto"
                style={{ fieldSizing: "content" } as any}
              />

              {/* Send button */}
              <Button
                type="button"
                onClick={handleSend}
                disabled={
                  isSending ||
                  (!draft.trim() && draftAttachments.length === 0) ||
                  draftAttachments.some((a) => a.status === "uploading")
                }
                className="rounded-xl h-10 w-10 p-0 shrink-0 text-white shadow-sm transition-all disabled:opacity-40"
                style={
                  isSending ||
                  (!draft.trim() && draftAttachments.length === 0) ||
                  draftAttachments.some((a) => a.status === "uploading")
                    ? undefined
                    : {
                        background:
                          "linear-gradient(135deg,#059669 0%,#065f46 100%)",
                      }
                }
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            <p className="text-[10px] text-muted-foreground mt-1.5 pl-12">
              <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">Enter</kbd> send
              &nbsp;·&nbsp;
              <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">
                Shift+Enter
              </kbd>{" "}
              new line
            </p>
          </div>
        </div>

        {/* ── RIGHT: Announcements & Notifications ─────────────────── */}
        <div className="space-y-4">
          <SectionCard
            title={
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-amber-500" />
                  <span>Announcements</span>
                </div>
                {canPostAnnouncement && (
                  <Button
                    size="sm"
                    onClick={() => setAnnouncementModalOpen(true)}
                    className="h-7 text-xs rounded-lg gap-1 px-2.5 text-white"
                    style={{
                      background: "linear-gradient(135deg,#059669 0%,#065f46 100%)",
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Post
                  </Button>
                )}
              </div>
            }
            description="Updates from leadership"
          >
            {isAnnouncementsLoading ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                Loading…
              </p>
            ) : !announcements || announcements.length === 0 ? (
              <div className="py-8 text-center space-y-1">
                <Megaphone className="h-8 w-8 text-muted-foreground opacity-30 mx-auto" />
                <p className="text-xs text-muted-foreground font-medium">
                  No announcements yet
                </p>
                {canPostAnnouncement && (
                  <p className="text-[11px] text-muted-foreground opacity-70">
                    Click "+ Post" to broadcast.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                {announcements.map((ann: any) => (
                  <div
                    key={ann._id}
                    className="p-3 rounded-xl bg-card border border-border space-y-2 relative group shadow-sm hover:border-emerald-500/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {ann.pinned && (
                            <Pin className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />
                          )}
                          <h4 className="text-xs font-semibold text-foreground leading-snug">
                            {ann.title}
                          </h4>
                          {ann.priority === "Urgent" && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-500 font-bold border border-rose-500/20">
                              Urgent
                            </span>
                          )}
                          {ann.priority === "Important" && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 font-bold border border-amber-500/20">
                              Important
                            </span>
                          )}
                          {ann.targetAudience && ann.targetAudience !== "Everyone" && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-500 font-medium">
                              {ann.department || ann.targetAudience}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          By {ann.author?.name || ann.createdByName || "Leadership"} ·{" "}
                          {new Date(ann.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      {canPostAnnouncement && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={() => handleDeleteAnnouncement(ann._id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {ann.content || ann.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Notifications" description="Recent alerts">
            {isNotifsLoading ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Loading…
              </div>
            ) : !notifications || notifications.length === 0 ? (
              <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground text-xs">
                <Bell className="h-4 w-4" />
                <span>No new notifications</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {notifications.map((n: any) => (
                  <div
                    key={n._id}
                    onClick={() => {
                      if (!n.isRead) markNotifRead.mutate(n._id);
                      if (n.actionUrl) {
                        window.location.href = n.actionUrl;
                      }
                    }}
                    className={`p-2.5 rounded-xl bg-card border text-xs flex items-center justify-between gap-2.5 cursor-pointer transition-all ${
                      !n.isRead
                        ? "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10"
                        : "border-border hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] leading-snug truncate ${!n.isRead ? "font-bold text-foreground" : "font-medium"}`}>
                        {n.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2 mt-0.5">
                        {n.message}
                      </p>
                    </div>
                    {!n.isRead && (
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 shadow-sm" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* ── Google Drive Modal ── */}
      <Dialog open={gdModalOpen} onOpenChange={setGdModalOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Globe className="h-5 w-5 text-blue-500" />
              Attach Google Drive File
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-3 bg-secondary/30 rounded-xl space-y-2">
              <p className="text-xs text-muted-foreground leading-normal">
                Connect your Google account to pick files directly, or paste a sharing
                link below.
              </p>
              <Button
                type="button"
                onClick={handleGooglePickerOpen}
                variant="outline"
                className="w-full text-xs gap-2 rounded-xl h-9 border-border"
              >
                <Globe className="h-4 w-4 text-blue-500" />
                Connect Google Account & Pick File
              </Button>
            </div>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-border" />
              <span className="flex-shrink mx-4 text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                or paste link
              </span>
              <div className="flex-grow border-t border-border" />
            </div>

            <form onSubmit={handleAddGoogleDriveLink} className="space-y-4">
              <div>
                <label htmlFor="gdLink" className="text-xs font-semibold text-foreground">
                  Google Drive Sharing URL
                </label>
                <Input
                  id="gdLink"
                  value={gdLinkInput}
                  onChange={(e) => setGdLinkInput(e.target.value)}
                  placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                  className="mt-1 rounded-xl text-xs h-10 border-border"
                  required
                />
              </div>
              <div>
                <label htmlFor="gdName" className="text-xs font-semibold text-foreground">
                  File Name (Optional)
                </label>
                <Input
                  id="gdName"
                  value={gdNameInput}
                  onChange={(e) => setGdNameInput(e.target.value)}
                  placeholder="e.g. Sales Presentation Q3.pdf"
                  className="mt-1 rounded-xl text-xs h-10 border-border"
                />
              </div>
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl text-xs"
                  onClick={() => setGdModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="rounded-xl text-white text-xs gap-1.5 px-4 h-10"
                  style={{
                    background: "linear-gradient(135deg,#059669 0%,#065f46 100%)",
                  }}
                >
                  <Plus className="h-4 w-4" /> Attach File
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Announcement Modal ── */}
      <Dialog open={announcementModalOpen} onOpenChange={setAnnouncementModalOpen}>
        <DialogContent className="sm:max-w-[520px] rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-5 w-5 text-emerald-500" />
              Broadcast Leadership Announcement
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateAnnouncement} className="space-y-4 pt-2">
            <div>
              <label htmlFor="annTitle" className="text-xs font-semibold text-foreground">
                Announcement Title *
              </label>
              <Input
                id="annTitle"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="e.g. Q3 Company Meeting & Product Roadmap"
                className="mt-1 rounded-xl h-10 border-border text-xs"
                required
              />
            </div>

            <div>
              <label htmlFor="annContent" className="text-xs font-semibold text-foreground">
                Announcement Message *
              </label>
              <Textarea
                id="annContent"
                value={annContent}
                onChange={(e) => setAnnContent(e.target.value)}
                placeholder="Write the full announcement details and instructions…"
                rows={4}
                className="mt-1 rounded-xl text-xs border-border"
                required
              />
            </div>

            {/* Priority Selection */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">
                Priority Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["Normal", "Important", "Urgent"] as const).map((p) => {
                  const isSelected = annPriority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAnnPriority(p)}
                      className={`h-9 rounded-xl text-xs font-medium border transition-all flex items-center justify-center gap-1.5 ${
                        isSelected
                          ? p === "Urgent"
                            ? "bg-rose-500/15 border-rose-500 text-rose-500 font-bold"
                            : p === "Important"
                            ? "bg-amber-500/15 border-amber-500 text-amber-500 font-bold"
                            : "bg-emerald-500/15 border-emerald-500 text-emerald-600 font-bold"
                          : "border-border bg-card/60 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${
                        p === "Urgent" ? "bg-rose-500" : p === "Important" ? "bg-amber-500" : "bg-emerald-500"
                      }`} />
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target Audience */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">
                Target Audience
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["Everyone", "Department", "Selected Employees"] as const).map((aud) => {
                  const isSelected = annTargetAudience === aud;
                  return (
                    <button
                      key={aud}
                      type="button"
                      onClick={() => setAnnTargetAudience(aud)}
                      className={`h-9 px-2 rounded-xl text-xs font-medium border transition-all text-center truncate ${
                        isSelected
                          ? "bg-emerald-500/15 border-emerald-500 text-emerald-600 font-bold"
                          : "border-border bg-card/60 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {aud}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* If Department selected */}
            {annTargetAudience === "Department" && (
              <div>
                <label htmlFor="annDept" className="text-xs font-semibold text-foreground">
                  Department Name *
                </label>
                <Input
                  id="annDept"
                  value={annDepartment}
                  onChange={(e) => setAnnDepartment(e.target.value)}
                  placeholder="e.g. Engineering, Design, Finance, HR"
                  className="mt-1 rounded-xl h-9 border-border text-xs"
                  required
                />
              </div>
            )}

            {/* If Selected Employees selected */}
            {annTargetAudience === "Selected Employees" && (
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Select Employees * ({annTargetUsers.length} selected)
                </label>
                <div className="max-h-36 overflow-y-auto border border-border rounded-xl p-2 space-y-1 bg-card/50">
                  {directUsers && directUsers.length > 0 ? (
                    directUsers.map((u: any) => {
                      const isChecked = annTargetUsers.includes(u._id);
                      return (
                        <label
                          key={u._id}
                          className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted text-xs cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAnnTargetUsers((prev) => [...prev, u._id]);
                              } else {
                                setAnnTargetUsers((prev) => prev.filter((id) => id !== u._id));
                              }
                            }}
                            className="rounded border-border text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                          />
                          <span className="font-medium text-foreground">{u.name}</span>
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {u.department || u.role || ""}
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="text-xs text-muted-foreground py-2 text-center">No employees available</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="annPinned"
                checked={annPinned}
                onChange={(e) => setAnnPinned(e.target.checked)}
                className="rounded border-border text-emerald-600 focus:ring-emerald-500 h-4 w-4"
              />
              <label
                htmlFor="annPinned"
                className="text-xs text-muted-foreground select-none cursor-pointer"
              >
                Pin to top of Announcements
              </label>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl text-xs"
                onClick={() => setAnnouncementModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createAnnouncement.isPending}
                className="rounded-xl text-white text-xs gap-1 px-4 h-10"
                style={{
                  background: "linear-gradient(135deg,#059669 0%,#065f46 100%)",
                }}
              >
                <Megaphone className="h-3.5 w-3.5" />
                {createAnnouncement.isPending ? "Publishing..." : "Publish Announcement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
