/**
 * NotificationHub.tsx
 * 
 * Global notification system mounted in _app.tsx.
 * Listens to socket events and shows bottom-right floating popup cards for:
 *  - announcement:new
 *  - task:assigned
 *  - task:approval_request   (admin only)
 *  - task:approved
 *  - task:denied
 * 
 * Also loads active announcements from the DB on mount (offline fallback).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { X, Megaphone, ClipboardList, CheckCircle2, XCircle, Bell, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveAnnouncements, useApproveTaskCompletion, useDenyTaskCompletion, useApproveRevertRequest, useDenyRevertRequest } from "@/lib/api-hooks";
import { getSocket } from "@/routes/__root";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotifCard {
  id: string;              // announcement ID or task ID
  type: "announcement" | "task_assigned" | "task_approval" | "task_approved" | "task_denied" | "revert_request";
  title: string;
  body: string;
  by?: string;
  date?: string;
  // task-specific
  taskId?: string;
  projectId?: string;
  actionUrl?: string;
  taskTitle?: string;
  submittedByName?: string;
  denialReason?: string;
  // revert-specific
  revertRequestId?: string;
  transactionId?: string;
  transactionReference?: string;
  requestedByName?: string;
  amount?: number;
  txType?: string;
  ventureName?: string;
  reason?: string;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function getAnnouncementDismissals(): Record<string, { hideUntil: string }> {
  try {
    return JSON.parse(localStorage.getItem("announcementDismissals") || "{}");
  } catch {
    return {};
  }
}

function setAnnouncementDismissal(announcementId: string, untilTomorrow: boolean) {
  const data = getAnnouncementDismissals();
  if (untilTomorrow) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    data[announcementId] = { hideUntil: tomorrow.toISOString() };
  } else {
    // Permanent dismiss — set hideUntil to far future
    const far = new Date("2099-01-01").toISOString();
    data[announcementId] = { hideUntil: far };
  }
  localStorage.setItem("announcementDismissals", JSON.stringify(data));
}

function isAnnouncementDismissed(announcementId: string): boolean {
  const data = getAnnouncementDismissals();
  const entry = data[announcementId];
  if (!entry) return false;
  return new Date(entry.hideUntil) > new Date();
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function NotificationHub() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const userRole = (user?.role || "").toLowerCase();
  const isManagement = ["admin", "founder", "manager", "super admin"].includes(userRole);

  const [cards, setCards] = useState<NotifCard[]>([]);
  const shownIds = useRef<Set<string>>(new Set()); // deduplicate

  const approveTask = useApproveTaskCompletion();
  const denyTask = useDenyTaskCompletion();

  // Denial dialog state
  const [denyDialogCard, setDenyDialogCard] = useState<NotifCard | null>(null);
  const [denyReason, setDenyReason] = useState("");

  // ── Load active announcements from DB (offline fallback) ──────────────────
  const { data: activeAnnouncements } = useActiveAnnouncements();

  useEffect(() => {
    if (!activeAnnouncements || !Array.isArray(activeAnnouncements)) return;
    activeAnnouncements.forEach((ann: any) => {
      const id = ann._id || ann.id;
      if (!id || isAnnouncementDismissed(id) || shownIds.current.has(id)) return;
      if (ann.expiresAt && new Date(ann.expiresAt) < new Date()) return;
      addCard({
        id,
        type: "announcement",
        title: ann.title,
        body: ann.content || ann.message || "",
        by: ann.author?.name || ann.createdByName || "Leadership",
        date: ann.createdAt
          ? new Date(ann.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
          : undefined
      });
    });
  }, [activeAnnouncements]);

  // ── Socket listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleAnnouncementNew = (data: any) => {
      const id = data._id || data.id;
      if (!id || isAnnouncementDismissed(id)) return;
      addCard({
        id,
        type: "announcement",
        title: data.title,
        body: data.content || data.message || "",
        by: data.author?.name || data.createdByName || "Leadership",
        date: data.createdAt
          ? new Date(data.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
          : undefined
      });
    };

    const handleTaskAssigned = (data: any) => {
      const actUrl =
        data.actionUrl ||
        (data.projectId
          ? `/projects?projectId=${data.projectId}&taskId=${data.taskId}`
          : `/projects?taskId=${data.taskId}`);
      addCard({
        id: `task_assigned_${data.taskId}`,
        type: "task_assigned",
        title: "New Task Assigned",
        body: data.taskTitle || "A new task has been assigned to you",
        by: data.assignedByName || "Admin",
        date: data.dueDate
          ? new Date(data.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
          : undefined,
        taskId: data.taskId,
        projectId: data.projectId,
        actionUrl: actUrl
      });
    };

    const handleTaskApprovalRequest = (data: any) => {
      if (!isManagement) return;
      addCard({
        id: `task_approval_${data.taskId}_${Date.now()}`,
        type: "task_approval",
        title: "Task Completion Approval",
        body: `"${data.taskTitle}" has been submitted for completion approval.`,
        by: data.submittedByName || "An employee",
        taskId: data.taskId,
        taskTitle: data.taskTitle,
        submittedByName: data.submittedByName
      });
    };

    const handleTaskApproved = (data: any) => {
      addCard({
        id: `task_approved_${data.taskId}`,
        type: "task_approved",
        title: "Task Approved ✓",
        body: `"${data.taskTitle}" was approved and marked as Completed.`,
        by: data.approvedByName || "Admin"
      });
    };

    const handleTaskDenied = (data: any) => {
      addCard({
        id: `task_denied_${data.taskId}`,
        type: "task_denied",
        title: "Task Completion Not Approved",
        body: `"${data.taskTitle}" completion was denied.`,
        by: data.deniedByName || "Admin",
        denialReason: data.denialReason
      });
    };

    const handleRevertRequest = (data: any) => {
      if (!isManagement) return;
      addCard({
        id: data.id || `revert_request_${data.revertRequestId}_${Date.now()}`,
        type: "revert_request",
        title: "Transaction Revert Request",
        body: `Transaction ${data.transactionReference} submitted for revert by ${data.requestedByName}.`,
        transactionReference: data.transactionReference,
        requestedByName: data.requestedByName,
        amount: data.amount,
        txType: data.txType,
        ventureName: data.ventureName,
        reason: data.reason,
        revertRequestId: data.revertRequestId,
        transactionId: data.transactionId
      });
    };

    const handleRevertProcessed = (data: any) => {
      addCard({
        id: data.id || `revert_processed_${Date.now()}`,
        type: data.status === "approved" ? "task_approved" : "task_denied",
        title: data.title,
        body: data.body,
        denialReason: data.denialReason
      });
    };

    socket.on("announcement:new", handleAnnouncementNew);
    socket.on("task:assigned", handleTaskAssigned);
    socket.on("task:approval_request", handleTaskApprovalRequest);
    socket.on("task:approved", handleTaskApproved);
    socket.on("task:denied", handleTaskDenied);
    socket.on("revert_request", handleRevertRequest);
    socket.on("revert_processed", handleRevertProcessed);

    return () => {
      socket.off("announcement:new", handleAnnouncementNew);
      socket.off("task:assigned", handleTaskAssigned);
      socket.off("task:approval_request", handleTaskApprovalRequest);
      socket.off("task:approved", handleTaskApproved);
      socket.off("task:denied", handleTaskDenied);
      socket.off("revert_request", handleRevertRequest);
      socket.off("revert_processed", handleRevertProcessed);
    };
  }, [isManagement]);

  const addCard = useCallback((card: NotifCard) => {
    if (shownIds.current.has(card.id)) return;
    shownIds.current.add(card.id);
    setCards((prev) => {
      // Max 5 cards visible at once; newest on top
      const next = [card, ...prev].slice(0, 5);
      return next;
    });
  }, []);

  const removeCard = (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  };

  const handleDismissAnnouncement = (card: NotifCard, hideUntilTomorrow: boolean) => {
    setAnnouncementDismissal(card.id, hideUntilTomorrow);
    removeCard(card.id);
  };

  const handleViewAnnouncement = (card: NotifCard) => {
    removeCard(card.id);
    navigate({ to: "/communication" });
  };

  const handleViewTask = (card: NotifCard) => {
    removeCard(card.id);
    if (card.actionUrl) {
      window.location.href = card.actionUrl;
    } else if (card.taskId) {
      window.location.href = card.projectId
        ? `/projects?projectId=${card.projectId}&taskId=${card.taskId}`
        : `/projects?taskId=${card.taskId}`;
    } else {
      navigate({ to: "/tasks" });
    }
  };

  const approveRevert = useApproveRevertRequest();
  const denyRevert = useDenyRevertRequest();

  const handleApproveRevert = (card: NotifCard) => {
    if (!card.revertRequestId) return;
    approveRevert.mutate(card.revertRequestId, {
      onSuccess: () => {
        toast.success(`Revert request approved!`);
        removeCard(card.id);
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || "Failed to approve revert request");
      }
    });
  };

  const handleVerifyRevert = (card: NotifCard) => {
    removeCard(card.id);
    navigate({ to: "/finance" });
  };

  const handleApproveTask = (card: NotifCard) => {
    if (!card.taskId) return;
    approveTask.mutate(card.taskId as string, {
      onSuccess: () => {
        toast.success(`Task "${card.taskTitle}" approved!`);
        removeCard(card.id);
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || "Failed to approve task");
      }
    });
  };

  const handleDenyTask = (card: NotifCard) => {
    setDenyDialogCard(card);
    setDenyReason("");
  };

  const handleConfirmDeny = () => {
    if (!denyDialogCard || !denyReason.trim()) return;

    if (denyDialogCard.type === "revert_request") {
      if (!denyDialogCard.revertRequestId) return;
      denyRevert.mutate(
        { id: denyDialogCard.revertRequestId, denialReason: denyReason },
        {
          onSuccess: () => {
            toast.success("Revert request denied.");
            removeCard(denyDialogCard.id);
            setDenyDialogCard(null);
          },
          onError: (err: any) => {
            toast.error(err?.response?.data?.message || "Failed to deny revert request");
          }
        }
      );
    } else {
      if (!denyDialogCard.taskId) return;
      denyTask.mutate(
        { taskId: denyDialogCard.taskId as string, reason: denyReason },
        {
          onSuccess: () => {
            toast.success("Task completion denied.");
            removeCard(denyDialogCard.id);
            setDenyDialogCard(null);
          },
          onError: (err: any) => {
            toast.error(err?.response?.data?.message || "Failed to deny task");
          }
        }
      );
    }
  };

  return (
    <>
      {/* ── Notification card stack (bottom-right) ─────────────────────────── */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col-reverse gap-3 w-[360px] max-w-[90vw]">
        <AnimatePresence>
          {cards.map((card) => (
            <NotifCardComponent
              key={card.id}
              card={card}
              isManagement={isManagement}
              onDismiss={(hideUntilTomorrow) =>
                card.type === "announcement"
                  ? handleDismissAnnouncement(card, hideUntilTomorrow)
                  : removeCard(card.id)
              }
              onView={() => {
                if (card.type === "revert_request") {
                  handleVerifyRevert(card);
                } else if (card.type === "announcement") {
                  handleViewAnnouncement(card);
                } else {
                  handleViewTask(card);
                }
              }}
              onApprove={() => {
                if (card.type === "revert_request") {
                  handleApproveRevert(card);
                } else {
                  handleApproveTask(card);
                }
              }}
              onDeny={() => handleDenyTask(card)}
              isApproving={card.type === "revert_request" ? approveRevert.isPending : approveTask.isPending}
              isDenying={card.type === "revert_request" ? denyRevert.isPending : denyTask.isPending}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* ── Deny reason dialog ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {denyDialogCard && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <h3 className="text-base font-semibold text-foreground mb-1">Deny Completion</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Why are you denying completion of "{denyDialogCard.taskTitle}"?
              </p>
              <textarea
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                placeholder="Enter reason..."
                className="w-full min-h-[80px] resize-none rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="flex gap-2 mt-4">
                <Button
                  variant="ghost"
                  className="flex-1 rounded-xl"
                  onClick={() => setDenyDialogCard(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-xl bg-rose-500 text-white hover:bg-rose-600"
                  onClick={handleConfirmDeny}
                  disabled={!denyReason.trim() || denyTask.isPending}
                >
                  {denyTask.isPending ? "Denying..." : "Deny Completion"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Individual Card Component ────────────────────────────────────────────────

interface CardProps {
  card: NotifCard;
  isManagement: boolean;
  onDismiss: (hideUntilTomorrow: boolean) => void;
  onView: () => void;
  onApprove: () => void;
  onDeny: () => void;
  isApproving: boolean;
  isDenying: boolean;
}

function NotifCardComponent({
  card,
  isManagement,
  onDismiss,
  onView,
  onApprove,
  onDeny,
  isApproving,
  isDenying
}: CardProps) {
  const [dontShowToday, setDontShowToday] = useState(false);

  const iconMap = {
    announcement: <Megaphone className="h-4 w-4" />,
    task_assigned: <ClipboardList className="h-4 w-4" />,
    task_approval: <Bell className="h-4 w-4" />,
    task_approved: <CheckCircle2 className="h-4 w-4" />,
    task_denied: <XCircle className="h-4 w-4" />,
    revert_request: <AlertTriangle className="h-4 w-4" />
  };

  const colorMap = {
    announcement: "from-emerald-500/20 to-lime-500/10 border-emerald-500/30",
    task_assigned: "from-blue-500/20 to-cyan-500/10 border-blue-500/30",
    task_approval: "from-amber-500/20 to-yellow-500/10 border-amber-500/30",
    task_approved: "from-green-500/20 to-emerald-500/10 border-green-500/30",
    task_denied: "from-rose-500/20 to-red-500/10 border-rose-500/30",
    revert_request: "from-amber-500/20 to-orange-500/10 border-amber-500/30"
  };

  const iconColorMap = {
    announcement: "text-emerald-400 bg-emerald-500/15",
    task_assigned: "text-blue-400 bg-blue-500/15",
    task_approval: "text-amber-400 bg-amber-500/15",
    task_approved: "text-green-400 bg-green-500/15",
    task_denied: "text-rose-400 bg-rose-500/15",
    revert_request: "text-amber-400 bg-amber-500/15"
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`relative rounded-2xl border bg-gradient-to-br ${colorMap[card.type]} backdrop-blur-md shadow-2xl overflow-hidden`}
    >
      {/* Decorative leaf accent */}
      <div className="absolute top-0 right-0 w-20 h-20 opacity-5 pointer-events-none">
        <svg viewBox="0 0 100 100" className="w-full h-full fill-emerald-400">
          <path d="M50 5 C20 5, 5 30, 5 60 C5 85, 25 95, 50 95 C75 95, 95 85, 95 60 C95 30, 80 5, 50 5 Z" />
        </svg>
      </div>

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${iconColorMap[card.type]}`}>
              {iconMap[card.type]}
            </div>
            <span className="text-xs font-semibold text-foreground/80">{card.title}</span>
          </div>
          <button
            onClick={() => onDismiss(dontShowToday)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body */}
        <p className="text-sm text-foreground/90 leading-relaxed mb-2 line-clamp-3">{card.body}</p>

        {/* Denial reason */}
        {card.denialReason && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg px-2.5 py-1.5 mb-2">
            <p className="text-xs text-rose-300">
              <span className="font-semibold">Reason:</span> {card.denialReason}
            </p>
          </div>
        )}
        {/* Revert request details */}
        {card.type === "revert_request" && isManagement && (
          <div className="text-[11px] space-y-1.5 my-2.5 bg-background/50 p-2.5 rounded-xl border border-border/40 text-foreground/90 font-medium">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Transaction:</span>
              <span className="font-bold font-mono">{card.transactionReference}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Requested by:</span>
              <span>{card.requestedByName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-bold">₹{card.amount?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type:</span>
              <span className={card.txType === "Money In" ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>
                {card.txType}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Venture:</span>
              <span className="truncate max-w-[150px]">{card.ventureName}</span>
            </div>
            <div className="mt-1.5 pt-1.5 border-t border-border/40">
              <span className="text-muted-foreground block text-[9px] uppercase font-bold tracking-wider mb-0.5">Reason:</span>
              <p className="text-foreground font-normal leading-normal italic">"{card.reason}"</p>
            </div>
          </div>
        )}

        {/* Meta */}
        {(card.by || card.date) && (
          <p className="text-[11px] text-muted-foreground mb-3">
            {card.by && <span className="font-medium">{card.by}</span>}
            {card.by && card.date && <span className="mx-1">·</span>}
            {card.date && <span>{card.date}</span>}
          </p>
        )}

        {/* "Don't show again today" for announcements */}
        {card.type === "announcement" && (
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer mb-3 select-none">
            <input
              type="checkbox"
              checked={dontShowToday}
              onChange={(e) => setDontShowToday(e.target.checked)}
              className="w-3 h-3 rounded accent-emerald-500"
            />
            Don't show this popup again today
          </label>
        )}

        {/* Actions */}
        {card.type === "announcement" && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 h-7 text-xs rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10"
              onClick={() => onDismiss(dontShowToday)}
            >
              Dismiss
            </Button>
            <Button
              size="sm"
              className="flex-1 h-7 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => { onView(); }}
            >
              View
            </Button>
          </div>
        )}

        {(card.type === "task_assigned" || card.type === "task_approved" || card.type === "task_denied") && (
          <Button
            size="sm"
            className="w-full h-7 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
            onClick={onView}
          >
            View Task
          </Button>
        )}

        {card.type === "task_approval" && isManagement && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 h-7 text-xs rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20"
              onClick={onDeny}
              disabled={isDenying}
            >
              Deny
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 h-7 text-xs rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 border border-border"
              onClick={onView}
            >
              Verify
            </Button>
            <Button
              size="sm"
              className="flex-1 h-7 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={onApprove}
              disabled={isApproving}
            >
              {isApproving ? "..." : "Approve"}
            </Button>
          </div>
        )}

        {card.type === "revert_request" && isManagement && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 h-7 text-xs rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20"
              onClick={onDeny}
              disabled={isDenying}
            >
              Deny
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 h-7 text-xs rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 border border-border"
              onClick={onView}
            >
              Verify Transaction
            </Button>
            <Button
              size="sm"
              className="flex-1 h-7 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={onApprove}
              disabled={isApproving}
            >
              {isApproving ? "..." : "Approve"}
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
