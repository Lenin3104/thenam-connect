import { createFileRoute } from "@tanstack/react-router";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { StatCard } from "@/components/ui-ext/stat-card";
import { SectionCard } from "@/components/ui-ext/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FileDown, FileSpreadsheet, TrendingUp, PieChart, Activity, Percent,
  Search, Filter, RotateCcw, Calendar, CheckCircle2, Clock, AlertTriangle,
  Award, Building2, UserCheck, ShieldCheck, Download, Loader2, Mail
} from "lucide-react";
import { SendReportEmailDialog } from "@/components/reports/SendReportEmailDialog";
import { useState } from "react";
import {
  useFinanceSummary,
  useDashboardStats,
  useDashboardCharts,
  useVentures,
  useProjects,
  useMyTaskReport,
  downloadMyTaskReportPDF,
  downloadMyTaskReportExcel
} from "@/lib/api-hooks";
import {
  BarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { useAuthStore } from "@/store/authStore";
import { canAccessRoute } from "@/lib/permissions";
import { AccessDenied } from "@/components/rbac/AccessDenied";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Task Reports & Analytics — Thenam ERP" }] }),
  component: ReportsPage,
});

const reportTypes = [
  "Monthly Financial Summary",
  "Quarterly Investor Report",
  "Venture Performance Snapshot",
  "Team Productivity Analysis",
  "Marketing ROI Breakdown",
  "Operations Health Check",
];

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

function ReportsPage() {
  const { user, activeRole } = useAuthStore();
  const userRoles = [
    activeRole,
    user?.role,
    ...(user?.roles || [])
  ].filter((r): r is string => Boolean(r)).map((r) => r.toLowerCase());

  const isAdmin = userRoles.some((r: string) =>
    ["admin", "founder", "super admin", "manager", "ceo"].includes(r)
  );

  // State for Send Employee Report Email modal
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);

  // Route Protection Check
  if (!canAccessRoute(user?.role, "/reports")) {
    return <AccessDenied resource="Reports" />;
  }

  // Active view tab: "task-completion" or "financial"
  const [activeTab, setActiveTab] = useState<"task-completion" | "financial">("task-completion");

  // Filters for Task Completion Report
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState("completedDate");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Download loading states
  const [isPdfDownloading, setIsPdfDownloading] = useState(false);
  const [isExcelDownloading, setIsExcelDownloading] = useState(false);

  // Fetch strictly authenticated employee's task completion report
  const {
    data: taskReport,
    isLoading: isTaskReportLoading,
    refetch: refetchTaskReport
  } = useMyTaskReport({
    search: search.trim() || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    priority: priorityFilter !== "all" ? priorityFilter : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    sortBy,
    sortOrder
  });

  // Financial & Operational hooks (preserved)
  const { data: summary, isLoading: isSumLoading } = useFinanceSummary();
  const { data: stats, isLoading: isStatsLoading } = useDashboardStats();
  const { data: chartData, isLoading: isChartLoading } = useDashboardCharts();
  const { data: ventures } = useVentures();
  const { data: projects } = useProjects();

  const handleDownloadPDF = async () => {
    try {
      setIsPdfDownloading(true);
      toast.info("Generating PDF report with Thenam branding...");
      await downloadMyTaskReportPDF({
        search: search.trim() || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        priority: priorityFilter !== "all" ? priorityFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sortBy,
        sortOrder
      });
      toast.success("Task Completion Report PDF downloaded successfully!");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to download PDF report");
    } finally {
      setIsPdfDownloading(false);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      setIsExcelDownloading(true);
      toast.info("Generating Excel spreadsheet...");
      await downloadMyTaskReportExcel({
        search: search.trim() || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        priority: priorityFilter !== "all" ? priorityFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sortBy,
        sortOrder
      });
      toast.success("Task Completion Report Excel downloaded successfully!");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to download Excel report");
    } finally {
      setIsExcelDownloading(false);
    }
  };

  const handleResetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setStartDate("");
    setEndDate("");
    setSortBy("completedDate");
    setSortOrder("desc");
  };

  const handleExportCSV = (title = "Financial_Summary_Report") => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Metric,Value\n"
      + `Total Revenue,₹${summary?.walletBalance || 0}\n`
      + `Money In Today,₹${summary?.inToday || 0}\n`
      + `Money Out Today,₹${summary?.outToday || 0}\n`
      + `Monthly Profit,₹${summary?.monthProfit || 0}\n`
      + `Active Ventures,${stats?.activeVentures || 0}\n`
      + `Active Projects,${stats?.activeProjects || 0}\n`
      + `Completed Tasks,${stats?.completedTasks || 0}\n`;
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${title}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`${title} exported successfully!`);
  };

  const projectStatusData = [
    { name: 'Planning', value: projects?.filter((p: any) => p.status === 'Planning').length || 0 },
    { name: 'In Progress', value: projects?.filter((p: any) => p.status === 'Active' || p.status === 'In Progress').length || 0 },
    { name: 'Testing', value: projects?.filter((p: any) => p.status === 'Testing').length || 0 },
    { name: 'Completed', value: projects?.filter((p: any) => p.status === 'Completed').length || 0 },
  ].filter(d => d.value > 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Completed":
        return <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Completed</Badge>;
      case "In Progress":
        return <Badge className="bg-blue-500/15 text-blue-400 border border-blue-500/30">In Progress</Badge>;
      case "Pending":
        return <Badge className="bg-slate-500/15 text-slate-300 border border-slate-500/30">Pending</Badge>;
      case "Overdue":
        return <Badge className="bg-rose-500/15 text-rose-400 border border-rose-500/30">Overdue</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "Critical":
        return <span className="text-rose-400 font-semibold text-xs">● Critical</span>;
      case "High":
        return <span className="text-amber-400 font-semibold text-xs">● High</span>;
      case "Medium":
        return <span className="text-blue-400 text-xs">● Medium</span>;
      default:
        return <span className="text-muted-foreground text-xs">● Low</span>;
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Download verified task completion reports and operational metrics across Thenam ERP."
        actions={
          <div className="flex items-center gap-2">
            {activeTab === "task-completion" ? (
              <>
                {isAdmin && (
                  <Button
                    variant="outline"
                    className="rounded-xl gap-1.5 cursor-pointer text-xs border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/60 font-semibold shadow-xs"
                    onClick={() => setIsEmailDialogOpen(true)}
                  >
                    <Mail className="h-4 w-4 text-primary" />
                    Email Report
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="rounded-xl gap-1.5 cursor-pointer text-xs"
                  onClick={handleDownloadExcel}
                  disabled={isExcelDownloading}
                >
                  {isExcelDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                  )}
                  Download Excel
                </Button>
                <Button
                  className="rounded-xl gradient-royal text-white gap-1.5 cursor-pointer text-xs"
                  onClick={handleDownloadPDF}
                  disabled={isPdfDownloading}
                >
                  {isPdfDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4" />
                  )}
                  Download PDF
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" className="rounded-xl gap-1.5 cursor-pointer text-xs" onClick={() => handleExportCSV("Financial_Report_Excel")}>
                  <FileSpreadsheet className="h-4 w-4" /> Export CSV / Excel
                </Button>
                <Button className="rounded-xl gradient-royal text-white gap-1.5 cursor-pointer text-xs" onClick={() => handleExportCSV("Executive_Summary_PDF")}>
                  <FileDown className="h-4 w-4" /> Export Report
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* ── MODULE TAB SWITCHER ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-border/80 pb-3 mb-6">
        <button
          onClick={() => setActiveTab("task-completion")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === "task-completion"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Task Completion Report
          {taskReport?.summary && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-background/20 font-bold">
              {taskReport.summary.completedTasks}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("financial")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === "financial"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Activity className="w-4 h-4" />
          Financial & Operational Overview
        </button>
      </div>

      {/* ── TAB 1: TASK COMPLETION REPORT ────────────────────────────────────── */}
      {activeTab === "task-completion" && (
        <div className="space-y-6">
          {/* Employee Branding & Meta Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-card to-slate-900 border border-border shadow-elevated relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider font-bold text-primary">
                    Thenam Software Solutions
                  </span>
                  <span className="text-border">·</span>
                  <span className="text-xs text-muted-foreground">Confidential Employee Task Report</span>
                </div>
                <h2 className="text-xl font-bold text-foreground mt-1 flex items-center gap-2">
                  {taskReport?.employee?.name || user?.name || "Employee"}
                  <Badge variant="outline" className="text-xs font-normal border-primary/30 text-primary">
                    {taskReport?.employee?.role || user?.role || "Staff"}
                  </Badge>
                </h2>
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-2">
                  <span className="flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-primary" />
                    <strong>ID:</strong> {taskReport?.employee?.employeeId || "EMP-000"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                    <strong>Department:</strong> {taskReport?.employee?.department || user?.department || "General"}
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <strong>Access:</strong> Authenticated Self Report
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs gap-1.5"
                  onClick={handleDownloadExcel}
                  disabled={isExcelDownloading}
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Excel
                </Button>
                <Button
                  size="sm"
                  className="rounded-xl gradient-royal text-white text-xs gap-1.5"
                  onClick={handleDownloadPDF}
                  disabled={isPdfDownloading}
                >
                  <FileDown className="w-4 h-4" /> PDF Report
                </Button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="mt-5 pt-4 border-t border-border/60 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3 rounded-xl bg-background/50 border border-border/40 text-center">
                <div className="text-[11px] text-muted-foreground">Total Assigned</div>
                <div className="text-lg font-bold text-foreground mt-0.5">
                  {taskReport?.summary?.totalTasks || 0}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-background/50 border border-border/40 text-center">
                <div className="text-[11px] text-muted-foreground">Completed</div>
                <div className="text-lg font-bold text-emerald-400 mt-0.5">
                  {taskReport?.summary?.completedTasks || 0}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-background/50 border border-border/40 text-center">
                <div className="text-[11px] text-muted-foreground">In Progress</div>
                <div className="text-lg font-bold text-blue-400 mt-0.5">
                  {taskReport?.summary?.inProgressTasks || 0}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-background/50 border border-border/40 text-center">
                <div className="text-[11px] text-muted-foreground">Pending</div>
                <div className="text-lg font-bold text-slate-300 mt-0.5">
                  {taskReport?.summary?.pendingTasks || 0}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-background/50 border border-border/40 text-center">
                <div className="text-[11px] text-muted-foreground">Overdue</div>
                <div className="text-lg font-bold text-rose-400 mt-0.5">
                  {taskReport?.summary?.overdueTasks || 0}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-background/50 border border-border/40 text-center">
                <div className="text-[11px] text-muted-foreground">Points Earned</div>
                <div className="text-lg font-bold text-amber-400 mt-0.5 flex items-center justify-center gap-1">
                  <Award className="w-4 h-4 fill-amber-400 text-amber-400" />
                  {taskReport?.summary?.totalPoints || 0}
                </div>
              </div>
            </div>
          </div>

          {/* Filtering Controls */}
          <SectionCard title="Task Report Table" description="Comprehensive log of tasks assigned, completed dates, remarks, and point earnings">
            <div className="flex flex-col gap-3 mb-5">
              {/* Row 1: Search & Status / Priority */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search task name or description..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 rounded-xl border-border text-xs h-9 bg-card"
                  />
                </div>

                <div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-card text-xs text-foreground focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Completed">Completed</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Pending">Pending</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>

                <div>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-card text-xs text-foreground focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Priorities</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Date Range, Sort & Reset */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-center">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground shrink-0">From:</span>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded-xl border-border text-xs h-9 bg-card"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground shrink-0">To:</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded-xl border-border text-xs h-9 bg-card"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground shrink-0">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full h-9 px-2 rounded-xl border border-border bg-card text-xs text-foreground focus:outline-none cursor-pointer"
                  >
                    <option value="completedDate">Completion Date</option>
                    <option value="points">Points Earned</option>
                    <option value="dueDate">Due Date</option>
                    <option value="assignedDate">Assigned Date</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-3 rounded-xl text-xs flex-1"
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  >
                    {sortOrder === "desc" ? "Newest First ↓" : "Oldest First ↑"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2 rounded-xl text-xs text-muted-foreground"
                    onClick={handleResetFilters}
                    title="Reset all filters"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Table Content */}
            {isTaskReportLoading ? (
              <div className="py-20 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span>Loading your task completion report...</span>
              </div>
            ) : !taskReport?.tasks || taskReport.tasks.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">No tasks found</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    No task records match your current filter parameters.
                  </p>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl text-xs mt-2" onClick={handleResetFilters}>
                  Reset Filters
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-muted/60 border-b border-border text-muted-foreground font-semibold">
                      <th className="py-3 px-3">Task Name</th>
                      <th className="py-3 px-3">Assigned Date</th>
                      <th className="py-3 px-3">Due Date</th>
                      <th className="py-3 px-3">Completed Date</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Priority</th>
                      <th className="py-3 px-3">Assigned By</th>
                      <th className="py-3 px-3">Duration</th>
                      <th className="py-3 px-3">Remarks</th>
                      <th className="py-3 px-3 text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 bg-card">
                    {taskReport.tasks.map((task: any) => (
                      <tr key={task.taskId} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-3 max-w-[200px]">
                          <div className="font-semibold text-foreground truncate" title={task.taskName}>
                            {task.taskName}
                          </div>
                          {task.description && (
                            <div className="text-[11px] text-muted-foreground truncate" title={task.description}>
                              {task.description}
                            </div>
                          )}
                          <div className="text-[10px] text-primary mt-0.5">
                            {task.project || "General"}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                          {task.assignedDate
                            ? new Date(task.assignedDate).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "—"}
                        </td>
                        <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                          {task.dueDate
                            ? new Date(task.dueDate).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "—"}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {task.completedDate ? (
                            <span className="text-emerald-400 font-medium">
                              {new Date(task.completedDate).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {getStatusBadge(task.status)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {getPriorityBadge(task.priority)}
                        </td>
                        <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                          {task.assignedBy}
                        </td>
                        <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                          {task.completionDuration || "—"}
                        </td>
                        <td className="py-3 px-3 text-muted-foreground max-w-[150px] truncate" title={task.completionRemarks}>
                          {task.completionRemarks || "—"}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          {task.pointsEarned > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20 text-[11px]">
                              <Award className="w-3 h-3 fill-amber-400 text-amber-400" />
                              +1 pt
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">0 pts</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ── TAB 2: FINANCIAL & OPERATIONAL OVERVIEW ───────────────────────────── */}
      {activeTab === "financial" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Revenue"
              value={isSumLoading ? "..." : `₹${(summary?.walletBalance || 0).toLocaleString()}`}
              delta="—"
              tone="royal"
              icon={<TrendingUp className="h-5 w-5" />}
              index={0}
            />
            <StatCard
              label="Monthly Profit Margin"
              value={isSumLoading || !summary?.walletBalance ? "..." : `${Math.round(((summary.monthProfit || 0) / Math.max(1, summary.walletBalance)) * 100)}%`}
              delta="—"
              tone="emerald"
              icon={<Percent className="h-5 w-5" />}
              index={1}
            />
            <StatCard
              label="Active Ventures"
              value={isStatsLoading ? "..." : String(stats?.activeVentures || ventures?.length || 0)}
              delta="—"
              tone="gold"
              icon={<PieChart className="h-5 w-5" />}
              index={2}
            />
            <StatCard
              label="Completed Projects"
              value={isStatsLoading ? "..." : String(stats?.completedProjects || 0)}
              delta="—"
              tone="royal"
              icon={<Activity className="h-5 w-5" />}
              index={3}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard title="Monthly report" description="Revenue vs Expenses monthly breakdown">
              {isChartLoading ? (
                <div className="h-[300px] flex items-center justify-center text-xs text-muted-foreground">Loading revenue data...</div>
              ) : (
                <div className="h-[300px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData?.revenueSeries || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="month" tick={{ fill: 'currentColor' }} tickLine={false} axisLine={false} className="text-xs text-muted-foreground" />
                      <YAxis tickFormatter={(v) => `₹${v}`} tick={{ fill: 'currentColor' }} tickLine={false} axisLine={false} className="text-xs text-muted-foreground" />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderRadius: '12px' }} />
                      <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Project Delivery" description="Project status distribution">
              {projectStatusData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-xs text-muted-foreground">No project data recorded</div>
              ) : (
                <div className="h-[300px] w-full mt-4 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={projectStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {projectStatusData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderRadius: '12px' }} />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard title="Report library" description="Generate & export recurring reports">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {reportTypes.map((r) => (
                <div key={r} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-4 card-hover">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r}</p>
                    <p className="text-xs text-muted-foreground">Generated automatically · Live</p>
                  </div>
                  <Button variant="ghost" size="sm" className="gap-1 cursor-pointer" onClick={() => handleExportCSV(r.replace(/\s+/g, '_'))}>
                    <FileDown className="h-4 w-4" /> Download
                  </Button>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* Send Employee Report Email Dialog */}
      <SendReportEmailDialog
        isOpen={isEmailDialogOpen}
        onClose={() => setIsEmailDialogOpen(false)}
      />

      <Toaster />
    </PageContainer>
  );
}
