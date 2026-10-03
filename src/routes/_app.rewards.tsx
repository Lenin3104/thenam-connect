import { createFileRoute } from "@tanstack/react-router";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { SectionCard } from "@/components/ui-ext/section-card";
import { StatCard } from "@/components/ui-ext/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Trophy, Award, CheckCircle2, Medal, Crown, Star, Flame,
  Search, Filter, Sparkles, UserCheck, Calendar, ArrowUpRight
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useMemo } from "react";
import { useLeaderboard, useMyRewards, useEmployees } from "@/lib/api-hooks";
import { useAuthStore } from "@/store/authStore";
import { canAccessRoute } from "@/lib/permissions";
import { AccessDenied } from "@/components/rbac/AccessDenied";

export const Route = createFileRoute("/_app/rewards")({
  head: () => ({ meta: [{ title: "Rewards & Leaderboard — Thenam ERP" }] }),
  component: RewardsPage,
});

export function RewardsPage() {
  const { user } = useAuthStore();

  // Route Protection Check
  if (!canAccessRoute(user?.role, "/rewards")) {
    return <AccessDenied resource="Rewards" />;
  }

  const userRole = (user?.role || "").toLowerCase();
  const isAdminOrHR = ["admin", "founder", "manager", "super admin", "hr"].includes(userRole);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");

  const { data: myRewards, isLoading: isMyRewardsLoading } = useMyRewards();
  const { data: leaderboard, isLoading: isLeaderboardLoading } = useLeaderboard({
    department: selectedDept !== "all" ? selectedDept : undefined,
    search: searchQuery.trim() || undefined,
  });
  const { data: employees } = useEmployees();

  // Get unique departments for filter
  const departments = useMemo(() => {
    if (!employees) return [];
    const depts = new Set<string>();
    employees.forEach((emp: any) => {
      if (emp.department) depts.add(emp.department);
    });
    return Array.from(depts);
  }, [employees]);

  const topThree = useMemo(() => {
    if (!leaderboard || leaderboard.length === 0) return [];
    return leaderboard.slice(0, 3);
  }, [leaderboard]);

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold shadow-sm">
            <Crown className="w-3.5 h-3.5 fill-amber-400" /> #1 Rank
          </div>
        );
      case 2:
        return (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-300/20 text-slate-300 border border-slate-300/30 text-xs font-bold">
            <Medal className="w-3.5 h-3.5 text-slate-300" /> #2 Rank
          </div>
        );
      case 3:
        return (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-700/20 text-amber-600 border border-amber-700/30 text-xs font-bold">
            <Medal className="w-3.5 h-3.5 text-amber-600" /> #3 Rank
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">
            #{rank}
          </div>
        );
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Rewards & Leaderboard"
        subtitle="Celebrate team achievements, earn leaderboard points, and track completion progress."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="rounded-xl px-3 py-1 text-xs gap-1 border-primary/30 text-primary">
              <Sparkles className="w-3.5 h-3.5" /> 1 Completed Task = 1 Point
            </Badge>
          </div>
        }
      />

      {/* ── MY REWARDS CARD & STATS ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* My Current Standing Card */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-card to-card border border-indigo-500/30 shadow-elevated relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-44 h-44 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-semibold text-indigo-400 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-indigo-400" /> My Reward Standing
              </span>
              {myRewards && getRankBadge(myRewards.currentRank)}
            </div>

            <div className="mt-4 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center font-bold text-xl text-indigo-400 shadow-inner">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : "ME"}
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {myRewards?.employee?.name || user?.name || "Team Member"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {myRewards?.employee?.employeeId || "Employee"} · {myRewards?.employee?.department || user?.department || "Thenam Team"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border/60 grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-xl bg-background/50 border border-border/40">
              <div className="text-xs text-muted-foreground">Current Rank</div>
              <div className="text-xl font-bold text-indigo-400 mt-0.5">
                {isMyRewardsLoading ? "..." : `#${myRewards?.currentRank || 1}`}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-background/50 border border-border/40">
              <div className="text-xs text-muted-foreground">Tasks Done</div>
              <div className="text-xl font-bold text-emerald-400 mt-0.5">
                {isMyRewardsLoading ? "..." : myRewards?.completedTasks || 0}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-background/50 border border-border/40">
              <div className="text-xs text-muted-foreground">Total Points</div>
              <div className="text-xl font-bold text-amber-400 mt-0.5 flex items-center justify-center gap-1">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                {isMyRewardsLoading ? "..." : myRewards?.totalPoints || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Global Summary Stats */}
        <StatCard
          label="Leaderboard Leaders"
          value={String(leaderboard?.length || 0)}
          delta="Active Contenders"
          tone="royal"
          icon={<Trophy className="h-5 w-5" />}
          index={1}
        />
        <StatCard
          label="Top Score Points"
          value={leaderboard && leaderboard.length > 0 ? `${leaderboard[0].totalPoints} pts` : "0 pts"}
          delta={leaderboard && leaderboard.length > 0 ? `Leader: ${leaderboard[0].name}` : "No score yet"}
          tone="gold"
          icon={<Award className="h-5 w-5" />}
          index={2}
        />
      </div>

      {/* ── TOP 3 PODIUM (IF AVAILABLE) ─────────────────────────────────────── */}
      {topThree.length >= 2 && (
        <div className="mt-6">
          <SectionCard title="Hall of Fame — Top Performers" description="Leading team members based on verified task completion points">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {topThree.map((item: any, idx: number) => {
                const isFirst = idx === 0;
                const isSecond = idx === 1;
                const isThird = idx === 2;

                return (
                  <motion.div
                    key={item._id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`p-5 rounded-2xl border relative flex flex-col justify-between transition-all ${
                      isFirst
                        ? "bg-gradient-to-b from-amber-500/10 via-card to-card border-amber-500/40 shadow-lg"
                        : isSecond
                        ? "bg-gradient-to-b from-slate-400/10 via-card to-card border-slate-400/30"
                        : "bg-gradient-to-b from-amber-800/10 via-card to-card border-amber-800/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isFirst && <Crown className="w-5 h-5 text-amber-400 fill-amber-400" />}
                        {isSecond && <Medal className="w-5 h-5 text-slate-300" />}
                        {isThird && <Medal className="w-5 h-5 text-amber-600" />}
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {isFirst ? "1st Place" : isSecond ? "2nd Place" : "3rd Place"}
                        </span>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`text-xs font-bold ${
                          isFirst ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : ""
                        }`}
                      >
                        {item.totalPoints} Points
                      </Badge>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm ${
                          isFirst
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : isSecond
                            ? "bg-slate-300/20 text-slate-200 border border-slate-300/30"
                            : "bg-amber-700/20 text-amber-500 border border-amber-700/30"
                        }`}
                      >
                        {item.name ? item.name.slice(0, 2).toUpperCase() : "EM"}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-foreground">{item.name}</h4>
                        <p className="text-xs text-muted-foreground">{item.department || "General"}</p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Completed Tasks:</span>
                      <span className="font-semibold text-foreground">{item.completedTasks} tasks</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── MAIN CONTENT GRID: LEADERBOARD + RECENT ACHIEVEMENTS ────────────── */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Full Leaderboard Table (2 spans) */}
        <div className="lg:col-span-2 space-y-4">
          <SectionCard
            title="Employee Leaderboard"
            description="Automatic ranking updated instantly upon task completion (1 Task = 1 Point)"
          >
            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employee, ID, or department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 rounded-xl border-border text-xs h-9 bg-card"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="h-9 px-3 rounded-xl border border-border bg-card text-xs text-foreground focus:outline-none cursor-pointer"
                >
                  <option value="all">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>

                {(searchQuery || selectedDept !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 text-xs rounded-xl"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedDept("all");
                    }}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {/* Leaderboard Table */}
            {isLeaderboardLoading ? (
              <div className="py-16 text-center text-sm text-muted-foreground">Loading leaderboard points...</div>
            ) : !leaderboard || leaderboard.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                  <Trophy className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">No leaderboard data found</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tasks marked as completed will automatically populate this leaderboard.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-muted/60 border-b border-border text-muted-foreground font-semibold">
                      <th className="py-3 px-4 w-16 text-center">Rank</th>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4 text-center">Completed Tasks</th>
                      <th className="py-3 px-4 text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 bg-card">
                    {leaderboard.map((row: any) => {
                      const isCurrentUser = (user as any)?._id === row._id || user?.id === row._id;

                      return (
                        <tr
                          key={row._id}
                          className={`hover:bg-muted/30 transition-colors ${
                            isCurrentUser ? "bg-primary/5 font-medium" : ""
                          }`}
                        >
                          <td className="py-3 px-4 text-center">
                            {row.rank === 1 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30 text-xs">
                                1
                              </span>
                            ) : row.rank === 2 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300/20 text-slate-300 font-bold border border-slate-300/30 text-xs">
                                2
                              </span>
                            ) : row.rank === 3 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-amber-600 font-bold border border-amber-700/30 text-xs">
                                3
                              </span>
                            ) : (
                              <span className="text-muted-foreground font-semibold">#{row.rank}</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                                {row.name ? row.name.slice(0, 2).toUpperCase() : "EM"}
                              </div>
                              <div>
                                <div className="font-semibold text-foreground flex items-center gap-1.5">
                                  {row.name}
                                  {isCurrentUser && (
                                    <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.2 rounded-md">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-muted-foreground">{row.employeeId}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-[11px] rounded-lg">
                              {row.department || "General"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-center font-medium">
                            <span className="text-foreground">{row.completedTasks}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1 font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              {row.totalPoints} pts
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right Column: Recent Achievements (1 span) */}
        <div className="space-y-4">
          <SectionCard
            title="Recent Achievements"
            description="Recently completed tasks that generated points"
          >
            {isMyRewardsLoading ? (
              <div className="py-10 text-center text-xs text-muted-foreground">Loading achievements...</div>
            ) : !myRewards?.recentAchievements || myRewards.recentAchievements.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-muted-foreground/60" />
                <p className="text-xs text-muted-foreground">
                  Complete tasks on your Tasks board to earn your first leaderboard points!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {myRewards.recentAchievements.map((ach: any, i: number) => (
                  <motion.div
                    key={ach.taskId || i}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-3.5 rounded-xl bg-card border border-border/80 flex items-start justify-between gap-3 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-400 mt-0.5">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="font-semibold text-xs text-foreground line-clamp-1">{ach.taskName}</h5>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {ach.completedDate
                            ? new Date(ach.completedDate).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "Recently"}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold shrink-0">
                      +1 Point
                    </Badge>
                  </motion.div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Point System Info Card */}
          <div className="p-4 rounded-2xl border border-border bg-muted/30 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-primary" /> Thenam ERP Point Rules
            </h4>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span><strong>1 Completed Task = 1 Point</strong> added directly to your profile.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Duplicate protection ensures reliable, uncheatable leaderboard ranking.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Rankings are tie-broken by total completed tasks and completion timestamp.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
