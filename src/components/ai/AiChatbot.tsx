import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  X,
  Send,
  RotateCcw,
  ArrowRight,
  Bot,
  User,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuthStore } from "@/store/authStore";
import { useNavigate } from "@tanstack/react-router";
import api from "@/lib/api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  actions?: Array<{ label: string; path: string }>;
  isError?: boolean;
}

interface AiChatbotProps {
  isOpen: boolean;
  onClose: () => void;
}

// Formats markdown text into beautiful enterprise UI elements
function FormattedMessageContent({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="space-y-1.5 text-xs sm:text-sm leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        // H3 Heading: ### Title
        if (trimmed.startsWith("### ")) {
          return (
            <h4
              key={idx}
              className="font-bold text-sm sm:text-base text-foreground flex items-center gap-1.5 mt-2 mb-1"
            >
              {renderInlineStyles(trimmed.replace(/^###\s+/, ""))}
            </h4>
          );
        }

        // Bullet point: - text or * text
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const text = trimmed.replace(/^[-*]\s+/, "");
          return (
            <div key={idx} className="flex items-start gap-2 pl-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <div className="flex-1">{renderInlineStyles(text)}</div>
            </div>
          );
        }

        // Numbered list: 1. text
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1.5">
              <span className="font-semibold text-primary text-xs shrink-0 mt-0.5">
                {numMatch[1]}.
              </span>
              <div className="flex-1">{renderInlineStyles(numMatch[2])}</div>
            </div>
          );
        }

        // Standard paragraph
        return (
          <p key={idx} className="text-foreground/90">
            {renderInlineStyles(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

// Helper to render bold (**text**), code (`text`), italic (*text*), and status badges
function renderInlineStyles(text: string) {
  // Regex splitting by bold, inline code, status tags
  const parts = text.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);

  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      const codeVal = part.slice(1, -1);
      // Style common ERP status badges
      const lower = codeVal.toLowerCase();
      let badgeStyle = "bg-muted text-muted-foreground border-border";
      if (lower.includes("completed") || lower.includes("active")) {
        badgeStyle = "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      } else if (lower.includes("in progress") || lower.includes("review")) {
        badgeStyle = "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20";
      } else if (lower.includes("pending")) {
        badgeStyle = "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20";
      }

      return (
        <span
          key={i}
          className={`inline-block px-1.5 py-0.5 text-[11px] rounded font-mono font-medium border ${badgeStyle}`}
        >
          {codeVal}
        </span>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={i} className="italic text-muted-foreground">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

export function AiChatbot({ isOpen, onClose }: AiChatbotProps) {
  const { user, activeRole } = useAuthStore();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [quickActions, setQuickActions] = useState<Array<{ label: string; prompt: string }>>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const role = (activeRole || user?.role || "developer").toLowerCase();
  const isManagement = ["admin", "founder", "manager", "super admin", "ceo"].includes(role);

  // Fetch role-tailored quick actions on mount
  useEffect(() => {
    if (isManagement) {
      setQuickActions([
        { label: "Team Tasks", prompt: "Show team tasks and progress" },
        { label: "Project Status", prompt: "What is the status of active projects?" },
        { label: "Pending Tasks", prompt: "How many tasks are currently pending?" },
        { label: "Announcements", prompt: "What announcements were posted recently?" }
      ]);
    } else {
      setQuickActions([
        { label: "My Tasks", prompt: "What tasks are assigned to me?" },
        { label: "Pending Tasks", prompt: "How many tasks are pending?" },
        { label: "My Projects", prompt: "What projects am I working on?" },
        { label: "My Rewards", prompt: "How many leaderboard points do I have?" },
        { label: "My Reports", prompt: "Show my task report summary" },
        { label: "Notifications", prompt: "Show my recent notifications" }
      ]);
    }
  }, [isManagement]);

  // Focus input when chatbot opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // Auto scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isOpen]);

  // Send message handler
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: "msg-" + Date.now() + "-user",
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInputValue("");
    setIsLoading(true);

    try {
      // Build lightweight conversation history
      const historyPayload = messages.slice(-4).map((m) => ({
        role: m.role,
        content: m.content
      }));

      const res = await api.post("/ai/chat", {
        message: text,
        history: historyPayload
      });

      const responseData = res.data?.data;
      const aiMessage: ChatMessage = {
        id: "msg-" + Date.now() + "-ai",
        role: "assistant",
        content: responseData?.message || "I could not generate an answer at this time.",
        actions: responseData?.actions || [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err: any) {
      console.error("AI Assistant query error:", err);
      const errorMessage: ChatMessage = {
        id: "msg-" + Date.now() + "-err",
        role: "assistant",
        content: "Sorry, I'm unable to connect to Thenam AI right now. Please try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isError: true
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleActionClick = (path: string) => {
    navigate({ to: path as any });
    // On small screens, close chatbot on navigation for best UX
    if (window.innerWidth < 640) {
      onClose();
    }
  };

  const retryLastMessage = () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      // Remove trailing error messages
      setMessages((prev) => prev.filter((m) => !m.isError));
      handleSendMessage(lastUserMsg.content);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="thenam-ai-panel"
          initial={{ opacity: 0, y: -12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.97 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="fixed top-18 right-2 sm:right-4 lg:right-6 z-50 w-[calc(100vw-1rem)] sm:w-[420px] max-w-[430px] h-[580px] max-h-[calc(100vh-5.5rem)] flex flex-col rounded-2xl sm:rounded-3xl border border-border/80 bg-card/95 text-card-foreground shadow-2xl backdrop-blur-2xl overflow-hidden"
          style={{
            boxShadow: "0 20px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px var(--color-border)"
          }}
        >
          {/* Top Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/70 bg-muted/40 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
                <Sparkles className="h-4 w-4 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm tracking-tight text-foreground flex items-center gap-1.5">
                    Thenam AI
                  </h3>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-none mt-0.5">
                  ERP Intelligent Assistant
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                      onClick={handleClearChat}
                      disabled={messages.length === 0 || isLoading}
                      aria-label="Clear chat"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Clear conversation</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                onClick={onClose}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Conversation Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
            {/* Initial Welcome Greeting */}
            {messages.length === 0 && (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-2xl bg-muted/40 border border-border/60">
                  <div className="flex items-start gap-3">
                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Hello {user?.name || "there"} 👋
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        I'm your **Thenam ERP AI Assistant**. I can answer questions about your
                        assigned tasks, active projects, leaderboard rewards, and navigate the platform.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
                    Quick Actions
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {quickActions.map((qa, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(qa.prompt)}
                        className="text-left text-xs p-2.5 rounded-xl border border-border/70 bg-card hover:bg-primary/5 hover:border-primary/30 transition-all text-foreground font-medium flex items-center justify-between group cursor-pointer shadow-2xs"
                      >
                        <span className="truncate">{qa.label}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5 shrink-0 ml-1" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 text-center">
                  <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
                    <HelpCircle className="h-3 w-3" />
                    Ask in natural language: e.g. "What tasks are pending?"
                  </p>
                </div>
              </div>
            )}

            {/* Message History */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-1">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-2xs ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground font-medium rounded-tr-xs"
                      : msg.isError
                      ? "bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-tl-xs"
                      : "bg-muted/60 border border-border/80 text-foreground rounded-tl-xs"
                  }`}
                >
                  {msg.role === "user" ? (
                    <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </p>
                  ) : (
                    <div>
                      <FormattedMessageContent content={msg.content} />

                      {/* Action buttons (navigation shortcuts) */}
                      {msg.actions && msg.actions.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-border/60 flex flex-wrap gap-1.5">
                          {msg.actions.map((act, idx) => (
                            <Button
                              key={idx}
                              size="sm"
                              variant="outline"
                              onClick={() => handleActionClick(act.path)}
                              className="h-7 text-xs gap-1.5 rounded-lg border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/60 cursor-pointer font-medium"
                            >
                              <span>{act.label}</span>
                              <ExternalLink className="h-3 w-3 opacity-80" />
                            </Button>
                          ))}
                        </div>
                      )}

                      {/* Retry on error */}
                      {msg.isError && (
                        <div className="mt-2.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={retryLastMessage}
                            className="h-7 text-xs gap-1 border-rose-500/40 text-rose-500 hover:bg-rose-500/10"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Retry
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  <span
                    className={`block text-[10px] mt-1 ${
                      msg.role === "user" ? "text-primary-foreground/75 text-right" : "text-muted-foreground"
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>

                {msg.role === "user" && (
                  <div className="h-7 w-7 rounded-lg bg-primary/20 flex items-center justify-center text-primary shrink-0 mt-1">
                    <User className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            ))}

            {/* Thinking / Loading indicator */}
            {isLoading && (
              <div className="flex items-start gap-2.5 justify-start">
                <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-1">
                  <Sparkles className="h-3.5 w-3.5 animate-spin" />
                </div>
                <div className="rounded-2xl rounded-tl-xs px-3.5 py-2.5 bg-muted/60 border border-border/80 text-foreground flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                    ✨ Thenam AI is thinking
                    <span className="inline-flex gap-0.5">
                      <span className="h-1 w-1 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-1 w-1 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-1 w-1 rounded-full bg-primary animate-bounce" />
                    </span>
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Chat Input Form */}
          <div className="p-3 border-t border-border/70 bg-card/80 backdrop-blur-md">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-end gap-2 bg-muted/50 rounded-xl border border-border p-1.5 focus-within:border-primary/60 focus-within:bg-background transition-all"
            >
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Thenam AI... (e.g., What tasks are pending?)"
                disabled={isLoading}
                rows={1}
                className="flex-1 bg-transparent resize-none border-none outline-hidden text-xs sm:text-sm px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground max-h-24 min-h-[36px]"
              />

              <Button
                type="submit"
                size="icon"
                disabled={!inputValue.trim() || isLoading}
                className="h-8 w-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 cursor-pointer disabled:opacity-40 transition-all shadow-xs"
                aria-label="Send message"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </Button>
            </form>

            <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground/75 px-1">
              <span>Press Enter to send, Shift + Enter for newline</span>
              <span>Context: {role}</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
