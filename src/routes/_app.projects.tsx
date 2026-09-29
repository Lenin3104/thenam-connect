import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FolderKanban, Plus, Clock, Trash2, Edit2, Target, Calendar,
  User as UserIcon, Building2, CheckCircle2, ShieldAlert,
  Check, ExternalLink, Paperclip, ChevronRight, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useProjects, useCreateProject, useVentures, useEmployees,
  useUpdateProject, useDeleteProject, useProject, useTask, useCompleteTask
} from "@/lib/api-hooks";
import { useAuthStore } from "@/store/authStore";
import { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { canAccessRoute, hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/rbac/AccessDenied";
import { RoleGuard } from "@/components/rbac/RoleGuard";

export const Route = createFileRoute("/_app/projects")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      projectId: (search.projectId as string) || undefined,
      taskId: (search.taskId as string) || undefined,
    };
  },
  head: () => ({ meta: [{ title: "Projects — Thenam ERP" }] }),
  component: ProjectsPage,
});

const projectStatuses = [
  { key: "Planning", title: "Planning", tint: "royal" },
  { key: "In Progress", title: "In Progress", tint: "gold" },
  { key: "Testing", title: "Testing", tint: "royal" },
  { key: "Completed", title: "Completed", tint: "emerald" },
  { key: "On Hold", title: "On Hold", tint: "royal" },
];

const columnAccent: Record<string, string> = {
  royal: "bg-royal",
  emerald: "bg-emerald",
  gold: "bg-gold",
};

function ProjectsPage() {
  const { user } = useAuthStore();

  // Route Protection Check
  if (!canAccessRoute(user?.role, "/projects")) {
    return <AccessDenied resource="Projects" />;
  }

  const { data: projects, isLoading } = useProjects();
  const { data: ventures } = useVentures();
  const { data: employees } = useEmployees();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const searchParams = Route.useSearch();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(searchParams.projectId || null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(searchParams.taskId || null);
  const [overviewModalOpen, setOverviewModalOpen] = useState(false);

  useEffect(() => {
    if (searchParams.projectId || searchParams.taskId) {
      if (searchParams.projectId) setSelectedProjectId(searchParams.projectId);
      if (searchParams.taskId) setSelectedTaskId(searchParams.taskId);
      setOverviewModalOpen(true);
    }
  }, [searchParams.projectId, searchParams.taskId]);

  const { data: detailProject, isLoading: isProjectLoading, error: projectError } = useProject(selectedProjectId || undefined);
  const { data: detailTask, isLoading: isTaskLoading, error: taskError } = useTask(selectedTaskId || undefined);
  const completeTaskMutation = useCompleteTask();

  useEffect(() => {
    if (detailTask && detailTask.project && !selectedProjectId) {
      const pId = typeof detailTask.project === "object" ? detailTask.project._id : detailTask.project;
      if (pId) setSelectedProjectId(pId);
    }
  }, [detailTask, selectedProjectId]);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ventureId, setVentureId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [budget, setBudget] = useState("10000");
  const [priority, setPriority] = useState("Medium");
  const [status, setStatus] = useState("Planning");
  const [deadline, setDeadline] = useState("");
  const [image, setImage] = useState("");

  const openNew = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setVentureId(ventures && ventures.length > 0 ? ventures[0]._id : "");
    setManagerId("");
    setBudget("10000");
    setPriority("Medium");
    setStatus("Planning");
    setDeadline("");
    setImage("");
    setOpen(true);
  };

  const openEdit = (p: any) => {
    setEditingId(p._id || p.id);
    setName(p.name || "");
    setDescription(p.description || "");
    setVentureId(p.venture?._id || p.venture || "");
    setManagerId(p.manager?._id || p.manager || "");
    setBudget(String(p.budget || 10000));
    setPriority(p.priority || "Medium");
    setStatus(p.status || "Planning");
    setDeadline(p.deadline ? new Date(p.deadline).toISOString().split("T")[0] : "");
    setImage(p.image || "");
    setOpen(true);
  };

  const onDragEnd = (result: any) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    const newStatus = destination.droppableId;
    updateProject.mutate(
      { id: draggableId, data: { status: newStatus } },
      {
        onSuccess: () => toast.success("Project status updated"),
        onError: () => toast.error("Failed to update project status"),
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !ventureId) {
      toast.error("Venture and Project Name are required.");
      return;
    }

    const payload = {
      name,
      description,
      venture: ventureId,
      manager: managerId || null,
      budget: Number(budget),
      priority,
      status,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      image,
    };

    if (editingId) {
      updateProject.mutate(
        { id: editingId, data: payload },
        {
          onSuccess: () => {
            toast.success("Project updated successfully");
            setOpen(false);
          },
          onError: (err: any) => {
            toast.error(err.response?.data?.message || "Failed to update project");
          },
        }
      );
    } else {
      createProject.mutate(payload, {
        onSuccess: () => {
          toast.success("Project created successfully");
          setOpen(false);
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.message || "Failed to create project");
        },
      });
    }
  };

  const handleDelete = (id: string, projName: string) => {
    if (confirm(`Are you sure you want to delete project "${projName}"?`)) {
      deleteProject.mutate(id, {
        onSuccess: () => toast.success("Project deleted successfully"),
        onError: (err: any) => toast.error(err.response?.data?.message || "Failed to delete project"),
      });
    }
  };

  const canEdit = hasPermission(user?.role, "projects", "update");
  const canDelete = hasPermission(user?.role, "projects", "delete");

  return (
    <PageContainer>
      <PageHeader
        title="Projects"
        subtitle="Track work across every stage of delivery."
        actions={
          <RoleGuard resource="projects" action="create">
            <Button className="rounded-xl gradient-royal text-white gap-1.5 cursor-pointer" onClick={openNew}>
              <Plus className="h-4 w-4" /> New project
            </Button>
          </RoleGuard>
        }
      />

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-flow-col auto-cols-[minmax(280px,1fr)] gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-200px)]">
          {projectStatuses.map((col, ci) => {
            const colProjects = projects?.filter((p: any) => p.status === col.key) || [];
            return (
              <motion.div
                key={col.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: ci * 0.05 }}
                className="rounded-2xl border border-border bg-card/60 p-4 flex flex-col"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", columnAccent[col.tint])} />
                  <h3 className="text-sm font-semibold">{col.title}</h3>
                  <Badge variant="secondary" className="ml-auto rounded-full">
                    {isLoading ? "..." : colProjects.length}
                  </Badge>
                </div>

                <Droppable droppableId={col.key}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-[200px]"
                    >
                      {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                          <p className="text-xs text-muted-foreground">Loading...</p>
                        </div>
                      ) : colProjects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                          <FolderKanban className="h-8 w-8 text-muted-foreground opacity-30" />
                          <p className="text-xs text-muted-foreground">No projects yet</p>
                        </div>
                      ) : (
                        colProjects.map((p: any, index: number) => (
                          <Draggable key={p._id || p.id} draggableId={p._id || p.id} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => {
                                  setSelectedProjectId(p._id || p.id);
                                  setSelectedTaskId(null);
                                  setOverviewModalOpen(true);
                                }}
                                className="bg-card border border-border rounded-xl p-3.5 shadow-sm hover:shadow-md hover:border-primary/40 transition-all group cursor-pointer"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="font-medium text-sm text-foreground mb-1 group-hover:text-primary transition-colors">
                                    {p.name}
                                  </h4>
                                  {(canEdit || canDelete) && (
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                      {canEdit && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openEdit(p);
                                          }}
                                          className="p-1 text-muted-foreground hover:text-foreground rounded"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      {canDelete && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(p._id || p.id, p.name);
                                          }}
                                          className="p-1 text-muted-foreground hover:text-rose-500 rounded"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {p.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                                    {p.description}
                                  </p>
                                )}

                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50 text-xs">
                                  <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>
                                      {new Date(p.deadline || p.createdAt || Date.now()).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <div
                                    className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center text-[10px] font-medium text-muted-foreground"
                                    title={p.manager?.name || "Unassigned"}
                                  >
                                    {p.manager?.name?.charAt(0) || "?"}
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </motion.div>
            );
          })}
        </div>
      </DragDropContext>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-background text-foreground border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Project" : "Create New Project"}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {editingId ? "Update project details and progress." : "Add a new project board to track development milestones."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div>
              <Label htmlFor="projName">Project Name *</Label>
              <Input
                id="projName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Website V2"
                className="mt-1.5 rounded-xl border-border"
                required
              />
            </div>

            <div>
              <Label htmlFor="projDesc">Description</Label>
              <Textarea
                id="projDesc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Objectives, scope, milestones..."
                className="mt-1.5 rounded-xl border-border"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="projVenture">Venture *</Label>
                <select
                  id="projVenture"
                  value={ventureId}
                  onChange={(e) => setVentureId(e.target.value)}
                  className="w-full mt-1.5 h-10 px-3 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none"
                  required
                >
                  <option value="">Select Venture</option>
                  {ventures?.map((v: any) => (
                    <option key={v._id || v.id} value={v._id || v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="projManager">Project Manager</Label>
                <select
                  id="projManager"
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  className="w-full mt-1.5 h-10 px-3 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none"
                >
                  <option value="">No Manager</option>
                  {employees?.map((emp: any) => (
                    <option key={emp._id || emp.id} value={emp._id || emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="projBudget">Budget (₹)</Label>
                <Input
                  id="projBudget"
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="mt-1.5 rounded-xl border-border"
                  required
                />
              </div>

              <div>
                <Label htmlFor="projPriority">Priority</Label>
                <select
                  id="projPriority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full mt-1.5 h-10 px-3 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              <div>
                <Label htmlFor="projStatus">Status</Label>
                <select
                  id="projStatus"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full mt-1.5 h-10 px-3 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none"
                >
                  <option value="Planning">Planning</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Testing">Testing</option>
                  <option value="Completed">Completed</option>
                  <option value="On Hold">On Hold</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="projDeadline">Deadline</Label>
              <Input
                id="projDeadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="mt-1.5 rounded-xl border-border"
              />
            </div>

            <div>
              <Label htmlFor="projImage">Project Image / Cover Upload</Label>
              <Input
                id="projImage"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => setImage(reader.result as string);
                    reader.readAsDataURL(file);
                  }
                }}
                className="mt-1.5 rounded-xl border-border file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-primary/20 file:text-primary cursor-pointer"
              />
              {image && (
                <img src={image} alt="Project Cover Preview" className="mt-2 h-16 w-auto rounded-lg border border-border object-cover" />
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" className="rounded-xl" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={editingId ? updateProject.isPending : createProject.isPending}
                className="rounded-xl gradient-royal text-white hover:opacity-90"
              >
                {editingId
                  ? updateProject.isPending
                    ? "Updating..."
                    : "Update Project"
                  : createProject.isPending
                  ? "Creating..."
                  : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* ── PROJECT & TASK OVERVIEW DIALOG (Sections 14-17) ── */}
      <Dialog
        open={overviewModalOpen}
        onOpenChange={(isOpen) => {
          setOverviewModalOpen(isOpen);
          if (!isOpen) {
            setSelectedTaskId(null);
            // Clean URL query parameters smoothly
            window.history.replaceState({}, "", "/projects");
          }
        }}
      >
        <DialogContent className="max-w-3xl bg-background text-foreground border-border rounded-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
          <DialogHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider text-primary border-primary/30 bg-primary/5">
                    {detailTask ? "Project & Task Overview" : "Project Overview"}
                  </Badge>
                  {detailProject?.status && (
                    <Badge variant="secondary" className="text-[10px]">
                      {detailProject.status}
                    </Badge>
                  )}
                  {detailProject?.priority && (
                    <Badge
                      className={`text-[10px] ${
                        detailProject.priority === "Critical" || detailProject.priority === "High"
                          ? "bg-rose-500/15 text-rose-500 border border-rose-500/20"
                          : "bg-amber-500/15 text-amber-500 border border-amber-500/20"
                      }`}
                    >
                      {detailProject.priority} Priority
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-xl font-bold text-foreground">
                  {detailProject?.name || (isProjectLoading ? "Loading project..." : "Project Details")}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Comprehensive delivery and task specifications for this workstream.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Security / IDOR restriction banner */}
          {taskError && (
            <div className="my-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-rose-500">Access Restricted</h4>
                <p className="text-xs text-rose-400/90 mt-0.5">
                  {(taskError as any)?.response?.data?.message ||
                    "You do not have authorization to view this private task. Tasks can only be accessed by the assigned employee or project leads."}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-6 pt-3">
            {/* ── PROJECT OVERVIEW ────────────────────────────────────────── */}
            <div className="rounded-xl border border-border/70 bg-card/50 p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground uppercase tracking-wide">
                <FolderKanban className="h-4 w-4 text-primary" />
                <span>Project Overview</span>
              </div>

              {isProjectLoading ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Loading project details…</p>
              ) : detailProject ? (
                <>
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Description & Objective
                    </span>
                    <p className="text-xs text-foreground/90 leading-relaxed bg-background/50 p-3 rounded-lg border border-border/40 whitespace-pre-wrap">
                      {detailProject.description || "No specific project description or objective provided."}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-background/60 border border-border/40">
                      <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Manager</span>
                      <p className="font-semibold text-foreground mt-0.5 truncate">
                        {detailProject.manager?.name || "Unassigned"}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-background/60 border border-border/40">
                      <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Venture / Dept</span>
                      <p className="font-semibold text-foreground mt-0.5 truncate">
                        {detailProject.venture?.name || "General"}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-background/60 border border-border/40">
                      <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Start Date</span>
                      <p className="font-semibold text-foreground mt-0.5">
                        {new Date(detailProject.startDate || detailProject.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-background/60 border border-border/40">
                      <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Deadline</span>
                      <p className="font-semibold text-foreground mt-0.5">
                        {detailProject.deadline ? new Date(detailProject.deadline).toLocaleDateString() : "No deadline"}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-muted-foreground">Project Progress</span>
                      <span className="text-foreground font-bold">{detailProject.progress || 0}%</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, detailProject.progress || 0))}%` }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground py-2">Select a project to view its overview.</p>
              )}
            </div>

            {/* ── TASK OVERVIEW ───────────────────────────────────────────── */}
            {(selectedTaskId || detailTask) && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-foreground uppercase tracking-wide">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Assigned Task Overview</span>
                  </div>
                  {detailTask?.status && (
                    <Badge
                      className={`text-[10px] font-bold ${
                        detailTask.status === "Completed"
                          ? "bg-emerald-500/20 text-emerald-600 border border-emerald-500/30"
                          : "bg-blue-500/20 text-blue-600 border border-blue-500/30"
                      }`}
                    >
                      {detailTask.status}
                    </Badge>
                  )}
                </div>

                {isTaskLoading ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">Loading task details…</p>
                ) : detailTask ? (
                  <>
                    <div>
                      <h3 className="text-base font-bold text-foreground">{detailTask.title}</h3>
                      <p className="text-xs text-foreground/80 mt-1 leading-relaxed bg-background/80 p-3 rounded-lg border border-border/50 whitespace-pre-wrap">
                        {detailTask.description || "No specific instructions or requirements provided for this task."}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-2.5 rounded-lg bg-background/80 border border-border/40">
                        <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Assigned To</span>
                        <p className="font-semibold text-foreground mt-0.5 truncate">
                          {detailTask.assignedTo?.name || "Unassigned"}
                        </p>
                        {detailTask.assignedTo?.department && (
                          <span className="text-[10px] text-muted-foreground block">{detailTask.assignedTo.department}</span>
                        )}
                      </div>

                      <div className="p-2.5 rounded-lg bg-background/80 border border-border/40">
                        <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Assigned By</span>
                        <p className="font-semibold text-foreground mt-0.5 truncate">
                          {detailTask.assignedBy?.name || "Project Lead"}
                        </p>
                      </div>

                      <div className="p-2.5 rounded-lg bg-background/80 border border-border/40">
                        <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Due Date</span>
                        <p className="font-semibold text-foreground mt-0.5">
                          {detailTask.deadline ? new Date(detailTask.deadline).toLocaleDateString() : "No deadline"}
                        </p>
                      </div>

                      <div className="p-2.5 rounded-lg bg-background/80 border border-border/40">
                        <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Priority</span>
                        <p className="font-semibold text-foreground mt-0.5">{detailTask.priority || "Medium"}</p>
                      </div>
                    </div>

                    {/* Completion / submission requirements */}
                    {detailTask.remarks && (
                      <div className="text-xs p-2.5 rounded-lg bg-background/60 border border-border/40">
                        <span className="text-[10px] text-muted-foreground uppercase block font-semibold mb-1">
                          Submission / Notes
                        </span>
                        <p className="text-foreground">{detailTask.remarks}</p>
                      </div>
                    )}

                    {/* Action button if not completed */}
                    {detailTask.status !== "Completed" && (
                      <div className="pt-2 flex justify-end">
                        <Button
                          disabled={completeTaskMutation.isPending}
                          onClick={() => {
                            completeTaskMutation.mutate(
                              { taskId: detailTask._id, remarks: "Completed from Task Overview" },
                              {
                                onSuccess: () => {
                                  confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
                                  toast.success("Task completed! +1 Reward point awarded 🏆");
                                },
                                onError: (err: any) => {
                                  toast.error(err.response?.data?.message || "Failed to mark task completed");
                                }
                              }
                            );
                          }}
                          className="rounded-xl gradient-emerald text-white text-xs gap-1.5 h-9 px-4 cursor-pointer shadow-md hover:opacity-90"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {completeTaskMutation.isPending ? "Completing..." : "Complete Task & Earn Point"}
                        </Button>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            )}
          </div>

          <DialogFooter className="pt-4 border-t border-border/60">
            <Button
              variant="outline"
              className="rounded-xl text-xs"
              onClick={() => {
                setOverviewModalOpen(false);
                setSelectedTaskId(null);
                window.history.replaceState({}, "", "/projects");
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Toaster />
    </PageContainer>
  );
}
