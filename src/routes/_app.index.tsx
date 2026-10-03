import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  TrendingUp,
  Briefcase,
  Users,
  Users2,
  CheckCircle2,
  ClipboardList,
  Plus,
  Wallet,
  UserPlus,
  Layers,
  Clock,
  Mail,
  FileText
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { StatCard } from "@/components/ui-ext/stat-card";
import { SectionCard } from "@/components/ui-ext/section-card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useDashboardStats, useDashboardCharts, useRecentActivities, useProjects } from "@/lib/api-hooks";
import { useAuthStore } from "@/store/authStore";
import { canAccessRoute, hasPermission, normalizeRole } from "@/lib/permissions";
import { RoleGuard } from "@/components/rbac/RoleGuard";
import { ReportEmailDetailDialog } from "@/components/reports/ReportEmailDetailDialog";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

export const Route = createFileRoute("/_app/")(
  {
    head: () => ({
      meta: [
        { title: "Dashboard — Thenam Software Solutions ERP" },
        { name: "description", content: "Executive dashboard for ventures, finance, teams and projects." },
      ],
    }),
    component: DashboardPage,
  }
);

function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const role = normalizeRole(user?.role);

  const { data: stats, isLoading: isStatsLoading } = useDashboardStats();
  const { data: chartData, isLoading: isChartsLoading } = useDashboardCharts();
  const { data: recentActivities, isLoading: isActivitiesLoading } = useRecentActivities();
  const { data: projects, isLoading: isProjectsLoading } = useProjects();

  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [isEmailDetailOpen, setIsEmailDetailOpen] = useState(false);

  const upcoming = projects?.filter((p: any) => p.status === 'Planning') || [];
  const pending = projects?.filter((p: any) => ['In Progress', 'Active', 'Testing', 'On Hold', 'Paused'].includes(p.status)) || [];
  const completed = projects?.filter((p: any) => p.status === 'Completed') || [];

  const canSeeFinance = hasPermission(user?.role, "finance", "read");
  const canSeeVentures = canAccessRoute(user?.role, "/ventures");
  const canSeeTeam = canAccessRoute(user?.role, "/team");
  const canSeeTeams = canAccessRoute(user?.role, "/teams");
  const canSeeProjects = canAccessRoute(user?.role, "/projects");
  const canSeeTasks = canAccessRoute(user?.role, "/tasks");

  const quickActions = [
    { label: "Create venture", tone: "gradient-royal", path: "/ventures", resource: "ventures", action: "create" },
    { label: "Create team", tone: "gradient-brand", path: "/teams", resource: "teams", action: "create" },
    { label: "Add employee", tone: "gradient-emerald", path: "/team", resource: "team", action: "create" },
    { label: "Record payment", tone: "gradient-gold", path: "/finance", resource: "finance", action: "create" },
  ].filter(a => hasPermission(user?.role, a.resource as any, a.action as any));

  // Check if there is an employee report email activity for this user
  const latestEmployeeReportActivity = recentActivities?.find((act: any) => {
    const isReport = act.action === 'Sent Employee Report Email' || (act.action && String(act.action).toLowerCase().includes('report email'));
    if (!isReport) return false;
    const targetEmail = (act.newValue?.recipientEmail || '').toLowerCase();
    const targetName = (act.newValue?.employeeName || act.entityName || '').toLowerCase();
    const myEmail = (user?.email || '').toLowerCase();
    const myName = (user?.name || '').toLowerCase();
    return (targetEmail && targetEmail === myEmail) || (myName && targetName.includes(myName)) || (user?.role === 'employee' || user?.role === 'developer');
  });

  return (
    <PageContainer>
      <PageHeader
        title={`Welcome back, ${user?.name || "User"}`}
        subtitle={`${role} Dashboard — Overview across Thenam ventures & teams.`}
        actions={
          <RoleGuard resource="ventures" action="create">
            <Button className="rounded-xl gradient-royal text-white hover:opacity-90 gap-1.5 cursor-pointer" onClick={() => navigate({ to: "/ventures" })}>
              <Plus className="h-4 w-4" /> New venture
            </Button>
          </RoleGuard>
        }
      />

      {latestEmployeeReportActivity && (
        <div className="mb-6 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-primary/15 flex items-center justify-center text-primary shrink-0 ring-2 ring-primary/20 shadow-xs">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-foreground">Employee Report Received from Admin</h4>
                <Badge className="text-[10px] px-2 py-0.5 bg-primary/20 text-primary border-primary/30">Official Email</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Admin sent your task report and performance metrics. You can view the full email, task breakdown, and download attached reports.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => {
                setSelectedEmailId(latestEmployeeReportActivity.newValue?.emailId || 'latest');
                setIsEmailDetailOpen(true);
              }}
              className="rounded-xl gradient-brand text-white shadow-sm hover:opacity-95 gap-1.5 cursor-pointer font-medium text-xs px-3.5 h-8"
            >
              <Mail className="h-3.5 w-3.5" />
              <span>Open Email Sent by Admin</span>
            </Button>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {canSeeFinance && (
          <StatCard
            label="Total Revenue"
            value={isStatsLoading ? "..." : `₹${stats?.totalRevenue?.toLocaleString() || "0"}`}
            delta="—"
            tone="royal"
            icon={<Wallet className="h-5 w-5" />}
            index={0}
          />
        )}
        {canSeeFinance && (
          <StatCard
            label="Monthly Profit"
            value={isStatsLoading ? "..." : `₹${stats?.profit?.toLocaleString() || "0"}`}
            delta="—"
            tone="emerald"
            icon={<TrendingUp className="h-5 w-5" />}
            index={1}
          />
        )}
        {canSeeVentures && (
          <StatCard
            label="Active Ventures"
            value={isStatsLoading ? "..." : String(stats?.activeVentures || 0)}
            delta="—"
            tone="gold"
            icon={<Briefcase className="h-5 w-5" />}
            index={2}
          />
        )}
        {canSeeTeams && (
          <StatCard
            label="Total Teams"
            value={isStatsLoading ? "..." : String(stats?.totalTeams || 0)}
            delta="—"
            tone="royal"
            icon={<Users2 className="h-5 w-5" />}
            index={3}
          />
        )}
        {canSeeTeam && (
          <StatCard
            label="Employees"
            value={isStatsLoading ? "..." : String(stats?.activeEmployees || stats?.totalEmployees || 0)}
            delta="—"
            tone="emerald"
            icon={<Users className="h-5 w-5" />}
            index={4}
          />
        )}
        {canSeeProjects && (
          <StatCard
            label="Completed Projects"
            value={isStatsLoading ? "..." : String(stats?.completedProjects || 0)}
            delta="—"
            tone="gold"
            icon={<CheckCircle2 className="h-5 w-5" />}
            index={5}
          />
        )}
      </div>

      {/* Projects Status Overview */}
      {canSeeProjects && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SectionCard title="Upcoming Projects" description="Scheduled to start or planning stage">
            {isProjectsLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground">Loading projects...</div>
            ) : upcoming.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No upcoming projects.</div>
            ) : (
              <div className="space-y-3 mt-3">
                {upcoming.slice(0, 5).map((p: any) => (
                  <div key={p._id} className="p-3.5 rounded-xl bg-card border border-border flex flex-col gap-2 shadow-sm hover:shadow transition-shadow">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-foreground truncate" title={p.name}>{p.name}</h4>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{p.venture?.name || "No Venture"}</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] font-mono shrink-0 text-amber-500 bg-amber-500/5 border-amber-500/20">
                        #{p._id ? p._id.substring(p._id.length - 6).toUpperCase() : "PROJ"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground pt-1.5 border-t border-border/40">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>Due: {p.deadline ? new Date(p.deadline).toLocaleDateString() : "No Date"}</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-amber-500/10 text-amber-500 uppercase tracking-wider">
                        {p.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Pending Projects" description="Active or currently in development">
            {isProjectsLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground">Loading projects...</div>
            ) : pending.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No pending projects.</div>
            ) : (
              <div className="space-y-3 mt-3">
                {pending.slice(0, 5).map((p: any) => (
                  <div key={p._id} className="p-3.5 rounded-xl bg-card border border-border flex flex-col gap-2 shadow-sm hover:shadow transition-shadow">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-foreground truncate" title={p.name}>{p.name}</h4>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{p.venture?.name || "No Venture"}</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] font-mono shrink-0 text-blue-500 bg-blue-500/5 border-blue-500/20">
                        #{p._id ? p._id.substring(p._id.length - 6).toUpperCase() : "PROJ"}
                      </Badge>
                    </div>
                    {/* Progress Bar */}
                    {p.progress !== undefined && (
                      <div className="space-y-1 mt-1">
                        <div className="flex justify-between text-[9px] text-muted-foreground">
                          <span>Progress</span>
                          <span>{p.progress}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                          <div className="bg-blue-500 h-full rounded-full" style={{ width: `${p.progress}%` }} />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground pt-1.5 border-t border-border/40">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>Due: {p.deadline ? new Date(p.deadline).toLocaleDateString() : "No Date"}</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-blue-500/10 text-blue-500 uppercase tracking-wider">
                        {p.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Completed Projects" description="Successfully finalized deliverables">
            {isProjectsLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground">Loading projects...</div>
            ) : completed.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No completed projects.</div>
            ) : (
              <div className="space-y-3 mt-3">
                {completed.slice(0, 5).map((p: any) => (
                  <div key={p._id} className="p-3.5 rounded-xl bg-card border border-border flex flex-col gap-2 shadow-sm hover:shadow transition-shadow">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-foreground truncate" title={p.name}>{p.name}</h4>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{p.venture?.name || "No Venture"}</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] font-mono shrink-0 text-emerald-500 bg-emerald-500/5 border-emerald-500/20">
                        #{p._id ? p._id.substring(p._id.length - 6).toUpperCase() : "PROJ"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground pt-1.5 border-t border-border/40">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>Finished: {p.deadline ? new Date(p.deadline).toLocaleDateString() : "No Date"}</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-emerald-500/10 text-emerald-500 uppercase tracking-wider">
                        Completed
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* Team Distribution & Recent Joinings Widgets */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Teams Breakdown Widget */}
        <SectionCard title="Active Teams Overview" description="Member distribution per team & venture">
          {isStatsLoading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Loading teams data...</div>
          ) : !stats?.teamDistribution || stats.teamDistribution.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">No active teams created yet.</div>
          ) : (
            <div className="space-y-3 mt-3">
              {stats.teamDistribution.slice(0, 5).map((t: any, idx: number) => (
                <div key={idx} className="p-3 rounded-xl bg-card border border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{t.teamName}</p>
                      <p className="text-[10px] text-muted-foreground">{t.ventureName || "Venture Team"}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {t.memberCount || 0} Members
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Recent Joinings Widget */}
        <SectionCard title="Recent Joinings" description="Newly onboarded team members">
          {isStatsLoading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Loading recent joinings...</div>
          ) : !stats?.recentJoinings || stats.recentJoinings.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">No recent employee joinings recorded.</div>
          ) : (
            <div className="space-y-3 mt-3">
              {stats.recentJoinings.map((emp: any) => (
                <div key={emp._id} className="p-3 rounded-xl bg-card border border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={emp.avatar || emp.photo} />
                      <AvatarFallback>{emp.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-xs font-bold text-foreground">{emp.name}</p>
                      <p className="text-[10px] text-muted-foreground">{emp.designation || emp.role} • {emp.venture?.name || "Venture"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="font-mono text-[10px] text-primary">
                      {emp.employeeId || "EMP"}
                    </Badge>
                    <p className="text-[9px] text-muted-foreground mt-0.5">
                      Joined {new Date(emp.joiningDate || emp.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Venture Credit Summary Widget */}
      <div className="mt-6">
        <SectionCard
          title="Credit Amount per Venture"
          description="Total credited revenue and funds received by venture"
        >
          {isStatsLoading ? (
            <div className="py-6 text-center text-xs text-muted-foreground">Loading venture credits...</div>
          ) : !stats?.ventureCredits || stats.ventureCredits.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">No venture credit data available.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
              {stats.ventureCredits.map((vc: any) => (
                <div
                  key={vc.ventureId}
                  className="p-3.5 rounded-xl bg-card border border-border flex items-center justify-between shadow-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                      <Wallet className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{vc.ventureName}</p>
                      <p className="text-[10px] text-muted-foreground">Credited Funds</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs text-emerald-500 font-bold bg-emerald-500/10 border-0">
                    ₹{vc.creditAmount?.toLocaleString() || "0"} credit
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Revenue chart (Only for roles with finance access) */}
      {canSeeFinance && (
        <div className="mt-6">
          <SectionCard
            title="Revenue Overview"
            description="Revenue vs Expenses performance summary"
          >
            {isChartsLoading ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                Loading charts...
              </div>
            ) : !chartData?.revenueSeries || chartData.revenueSeries.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                <div className="text-center space-y-2">
                  <TrendingUp className="h-10 w-10 mx-auto opacity-30" />
                  <p>No financial records this year</p>
                </div>
              </div>
            ) : (
              <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData.revenueSeries}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-royal)" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="var(--color-royal)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-gold)" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="var(--color-gold)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: 'currentColor' }}
                      tickLine={false}
                      axisLine={false}
                      className="text-xs text-muted-foreground"
                    />
                    <YAxis
                      tickFormatter={(value) => `₹${value}`}
                      tick={{ fill: 'currentColor' }}
                      tickLine={false}
                      axisLine={false}
                      className="text-xs text-muted-foreground"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                      }}
                      labelClassName="text-sm font-semibold text-foreground mb-1"
                      itemStyle={{ fontSize: '12px' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue"
                      stroke="var(--color-royal)"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                    />
                    <Area
                      type="monotone"
                      dataKey="expense"
                      name="Expense"
                      stroke="var(--color-gold)"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorExpense)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* Quick actions and Activity logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {quickActions.length > 0 && (
          <div className="lg:col-span-2">
            <SectionCard
              title="Quick Actions"
              description="Jump into common workflows"
            >
              <div className="grid grid-cols-2 gap-3 mt-4">
                {quickActions.map((a) => (
                  <button
                    key={a.label}
                    onClick={() => navigate({ to: a.path as any })}
                    className={`group relative overflow-hidden rounded-2xl ${a.tone} p-5 text-left text-white shadow-elevated card-hover cursor-pointer`}
                  >
                    <p className="text-sm font-semibold">{a.label}</p>
                  </button>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        <div className={quickActions.length === 0 ? "lg:col-span-3" : ""}>
          <SectionCard
            title="Recent Activity"
            description="Real-time operational logs"
          >
            <div className="flow-root mt-4 max-h-[220px] overflow-y-auto pr-1">
              {isActivitiesLoading ? (
                <div className="py-8 text-center text-xs text-muted-foreground">Loading activities...</div>
              ) : !recentActivities || recentActivities.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">No recent activities.</div>
              ) : (
                <ul className="-mb-8">
                  {recentActivities.map((act: any, actIdx: number) => {
                    const isReportEmail =
                      act.action === 'Sent Employee Report Email' ||
                      (act.action && String(act.action).toLowerCase().includes('report email')) ||
                      (act.entity === 'Report' && act.newValue?.emailId) ||
                      Boolean(act.newValue?.emailId);

                    return (
                      <li key={act._id}>
                        <div className="relative pb-8">
                          {actIdx !== recentActivities.length - 1 ? (
                            <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-border/30" aria-hidden="true" />
                          ) : null}
                          <div className="relative flex space-x-3">
                            <div>
                              <span className="h-8 w-8 rounded-full bg-muted flex items-center justify-center ring-4 ring-slate-900 text-xs font-semibold text-muted-foreground">
                                {act.userName?.charAt(0) || act.user?.name?.charAt(0) || 'A'}
                              </span>
                            </div>
                            <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-foreground">
                                  <span className="font-semibold text-muted-foreground">{act.userName || act.user?.name || "System"}</span>{" "}
                                  {act.action} <span className="font-semibold text-primary">{act.entityName || act.entity}</span>
                                </p>
                                {isReportEmail && (
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setSelectedEmailId(act.newValue?.emailId || 'latest');
                                        setIsEmailDetailOpen(true);
                                      }}
                                      className="h-7 px-2.5 text-xs rounded-lg gap-1.5 border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 hover:border-primary/50 cursor-pointer font-medium shadow-xs transition-all"
                                    >
                                      <Mail className="h-3.5 w-3.5 text-primary" />
                                      <span>Open Email Sent by Admin</span>
                                    </Button>
                                    {act.newValue?.pdfAttached && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-rose-500/10 text-rose-500 border-rose-500/20 font-medium">
                                        PDF Attached
                                      </Badge>
                                    )}
                                    {act.newValue?.excelAttached && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-medium">
                                        Excel Attached
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="whitespace-nowrap text-right text-[10px] text-muted-foreground">
                                {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      <ReportEmailDetailDialog
        emailId={selectedEmailId}
        isOpen={isEmailDetailOpen}
        onClose={() => {
          setIsEmailDetailOpen(false);
          setSelectedEmailId(null);
        }}
      />
    </PageContainer>
  );
}
