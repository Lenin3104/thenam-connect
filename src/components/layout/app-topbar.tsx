import { useEffect, useState, useMemo } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bell, MessageSquare, Menu, Plus, Search, Sun, Moon, Calendar, LogOut, User, Shield, Briefcase, CheckCircle2 } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { AppSidebar } from "./app-sidebar";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "@/store/authStore";
import { useVentures, useProjects, useEmployees, useTasks, useNotifications, useMarkNotificationRead } from "@/lib/api-hooks";
import { hasPermission, canAccessRoute, normalizeRole } from "@/lib/permissions";

export function AppTopbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const { user, logout, setActiveRole, activeRole } = useAuthStore();
  const currentRole = normalizeRole(activeRole || user?.role);
  
  const handleRoleSwitch = (role: string) => {
      setActiveRole(role);
      navigate({ to: "/" }); // optionally redirect home to re-evaluate permissions safely
  };

  const [mobileOpen, setMobileOpen] = useState(false);
  const [today, setToday] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const { data: ventures } = useVentures();
  const { data: projects } = useProjects();
  const { data: employees } = useEmployees();
  const { data: notifications } = useNotifications();
  const markAsReadMutation = useMarkNotificationRead();

  const unreadNotifications = useMemo(() => {
    if (!notifications) return [];
    return notifications.filter((n: any) => !n.isRead);
  }, [notifications]);
  const { data: tasks } = useTasks();

  // Quick add items filtered by permissions
  const quickAddOptions = useMemo(() => {
    const options = [];
    if (hasPermission(user?.role, "projects", "create")) {
      options.push({ label: "Project", path: "/projects" });
    }
    if (hasPermission(user?.role, "tasks", "create")) {
      options.push({ label: "Task", path: "/tasks" });
    }
    if (hasPermission(user?.role, "team", "create")) {
      options.push({ label: "Employee", path: "/team" });
    }
    if (hasPermission(user?.role, "finance", "create")) {
      options.push({ label: "Transaction", path: "/finance" });
    }
    if (hasPermission(user?.role, "ventures", "create")) {
      options.push({ label: "Venture", path: "/ventures" });
    }
    return options;
  }, [user?.role]);

  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const term = searchQuery.toLowerCase();
    const results: Array<{ title: string; subtitle: string; category: string; path: string }> = [];

    if (canAccessRoute(user?.role, "/ventures")) {
      ventures?.filter((v: any) => v.name?.toLowerCase().includes(term) || v.code?.toLowerCase().includes(term))
        .slice(0, 3)
        .forEach((v: any) => results.push({ title: v.name, subtitle: `Venture • ${v.category || "Business"}`, category: "Venture", path: "/ventures" }));
    }

    if (canAccessRoute(user?.role, "/projects")) {
      projects?.filter((p: any) => p.name?.toLowerCase().includes(term))
        .slice(0, 3)
        .forEach((p: any) => results.push({ title: p.name, subtitle: `Project • ${p.status}`, category: "Project", path: "/projects" }));
    }

    if (canAccessRoute(user?.role, "/team")) {
      employees?.filter((e: any) => e.name?.toLowerCase().includes(term) || e.email?.toLowerCase().includes(term))
        .slice(0, 3)
        .forEach((e: any) => results.push({ title: e.name, subtitle: `Employee • ${e.department || e.role}`, category: "Team", path: "/team" }));
    }

    if (canAccessRoute(user?.role, "/tasks")) {
      tasks?.filter((t: any) => t.title?.toLowerCase().includes(term))
        .slice(0, 3)
        .forEach((t: any) => results.push({ title: t.title, subtitle: `Task • ${t.status}`, category: "Task", path: "/tasks" }));
    }

    return results;
  }, [searchQuery, ventures, projects, employees, tasks, user?.role]);

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    );
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-2 px-4 lg:px-6">
        {/* Mobile menu */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[260px] p-0 bg-sidebar border-sidebar-border">
            <AppSidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="hidden lg:inline-flex">
          <Menu className="h-5 w-5" />
        </Button>

        <div className="relative hidden md:block flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            placeholder="Search ventures, people, projects, tasks…"
            className="pl-9 h-10 rounded-xl bg-muted/50 border-transparent focus-visible:bg-background"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground md:inline-block">
            ⌘K
          </kbd>

          {/* Floating Search Results */}
          {searchFocused && searchQuery.trim().length > 0 && (
            <div className="absolute top-12 left-0 right-0 z-50 rounded-2xl bg-background border border-border shadow-2xl p-3 max-h-80 overflow-y-auto space-y-2">
              {filteredResults.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2 text-center">No results found for "{searchQuery}"</p>
              ) : (
                filteredResults.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      navigate({ to: item.path as any });
                      setSearchQuery("");
                      setSearchFocused(false);
                    }}
                    className="p-2.5 rounded-xl hover:bg-card cursor-pointer flex items-center justify-between transition"
                  >
                    <div>
                      <p className="text-xs font-semibold text-foreground">{item.title}</p>
                      <p className="text-[10px] text-muted-foreground">{item.subtitle}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{item.category}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="hidden xl:flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" /> {today}
          </div>

          {quickAddOptions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-1.5 rounded-xl gradient-royal text-white hover:opacity-90 cursor-pointer">
                  <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Quick add</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-background text-foreground border-border">
                <DropdownMenuLabel>Create new</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {quickAddOptions.map((opt) => (
                  <DropdownMenuItem key={opt.path} onClick={() => navigate({ to: opt.path as any })} className="cursor-pointer">
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button variant="ghost" size="icon" className="relative" onClick={() => navigate({ to: "/communication" })}>
            <MessageSquare className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-500" />
          </Button>

          {/* Notifications Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative cursor-pointer">
                <Bell className="h-5 w-5" />
                {unreadNotifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-extrabold text-white px-1 animate-bounce shadow-md">
                    {unreadNotifications.length > 99 ? "99+" : unreadNotifications.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 sm:w-96 bg-card text-foreground border-border rounded-2xl p-2 shadow-2xl">
              <DropdownMenuLabel className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">Notifications</span>
                  {unreadNotifications.length > 0 && (
                    <span className="text-[10px] font-bold bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full">
                      {unreadNotifications.length} new
                    </span>
                  )}
                </div>
                <button
                  onClick={() => navigate({ to: "/communication" })}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  View all
                </button>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/60" />

              <div className="max-h-80 overflow-y-auto space-y-1 py-1">
                {!notifications || notifications.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No notifications available</p>
                ) : (
                  notifications.slice(0, 10).map((n: any) => (
                    <div
                      key={n._id}
                      onClick={() => {
                        if (!n.isRead) markAsReadMutation.mutate(n._id);
                        if (n.actionUrl) {
                          window.location.href = n.actionUrl;
                        } else {
                          navigate({ to: "/communication" });
                        }
                      }}
                      className={`p-2.5 rounded-xl cursor-pointer text-xs transition border flex items-start gap-2.5 ${
                        !n.isRead
                          ? "bg-primary/10 border-primary/30 text-foreground font-medium"
                          : "bg-card/40 border-border/40 text-muted-foreground hover:bg-card"
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${!n.isRead ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                        <Bell className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-xs line-clamp-1">{n.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-snug">{n.message}</p>
                        <span className="text-[10px] text-muted-foreground/70 mt-1 block">
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {!n.isRead && (
                        <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0 mt-1" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {user?.roles && user.roles.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="hidden sm:flex items-center gap-2 border border-border/50 bg-background/50 cursor-pointer rounded-full px-3">
                  <Briefcase className="h-4 w-4 text-indigo-500" />
                  <span className="text-xs font-medium capitalize">{currentRole}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-background text-foreground border-border rounded-xl">
                <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Switch Workspace</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.roles.map(r => {
                   const normalizedR = normalizeRole(r);
                   const isActive = normalizedR === currentRole;
                   return (
                      <DropdownMenuItem 
                        key={r} 
                        onClick={() => handleRoleSwitch(r)} 
                        className={`cursor-pointer capitalize text-sm ${isActive ? 'bg-indigo-500/10 text-indigo-500 font-bold' : ''}`}
                      >
                        {normalizedR}
                        {isActive && <CheckCircle2 className="h-3.5 w-3.5 ml-auto" />}
                      </DropdownMenuItem>
                   )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="h-9 w-9 ring-2 ring-primary/20 hover:ring-primary/50 transition cursor-pointer ml-1">
                <AvatarImage src={user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name || "User"}`} />
                <AvatarFallback>{user?.name?.charAt(0) || "U"}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-background text-foreground border-border">
              <DropdownMenuLabel>
                <p className="text-sm font-semibold">{user?.name || "User"}</p>
                <p className="text-xs text-muted-foreground">{user?.email || ""}</p>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-emerald-500">
                  <Shield className="h-3 w-3" /> Role: {currentRole}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/settings" })} className="cursor-pointer gap-2">
                <User className="h-4 w-4" /> Profile & Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { logout(); navigate({ to: "/login" }); }} className="text-rose-400 focus:text-rose-400 cursor-pointer gap-2">
                <LogOut className="h-4 w-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
