import { createFileRoute } from "@tanstack/react-router";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui-ext/section-card";
import {
  ClipboardList, Plus, Trash2, Edit2, CheckCircle2, Lock,
  Send, Clock, AlertCircle
} from "lucide-react";
import { useState } from "react";
import {
  useTasks, useCreateTask, useUpdateTaskStatus, useProjects, useEmployees,
  useVentures, useDeleteTask, useUpdateTask,
  useSubmitTaskCompletion, useApproveTaskCompletion, useDenyTaskCompletion,
  useCompleteTask
} from "@/lib/api-hooks";
import confetti from "canvas-confetti";
import { useAuthStore } from "@/store/authStore";
import { Badge } from "@/components/ui/badge";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
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
import { canAccessRoute, hasPermission, normalizeRole } from "@/lib/permissions";
import { AccessDenied } from "@/components/rbac/AccessDenied";
import { RoleGuard } from "@/components/rbac/RoleGuard";

export const Route = createFileRoute("/_app/tasks")({
  head: () => ({ meta: [{ title: "Tasks — Thenam ERP" }] }),
  component: TasksPage,
});

// Status columns visible to all (non-management see Completed as locked)
const ALL_STATUSES = ["Pending", "In Progress", "Review", "Pending_Approval", "Completed"];
const EMPLOYEE_ALLOWED_STATUSES = ["Pending", "In Progress", "Review"]; // Can drag to these
const MANAGEMENT_ROLES = ["admin", "founder", "manager", "super admin"];

export function TasksPage() {
  const { user } = useAuthStore();

  // Route Protection Check
  if (!canAccessRoute(user?.role, "/tasks")) {
    return <AccessDenied resource="Tasks" />;
  }

  const userRole = (user?.role || "").toLowerCase();
  const isManagement = MANAGEMENT_ROLES.includes(userRole);

  const { data: tasks, isLoading } = useTasks();
  const { data: projects } = useProjects();
  const { data: employees } = useEmployees();
  const { data: ventures } = useVentures();

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const updateTaskStatus = useUpdateTaskStatus();
  const deleteTask = useDeleteTask();
  const submitCompletion = useSubmitTaskCompletion();
  const approveCompletion = useApproveTaskCompletion();
  const denyCompletion = useDenyTaskCompletion();
  const completeTask = useCompleteTask();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [ventureId, setVentureId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [status, setStatus] = useState("Pending");
  const [deadline, setDeadline] = useState("");

  // Deny dialog state (inline for admin popup in tasks)
  const [denyDialogOpen, setDenyDialogOpen] = useState(false);
  const [denyTaskId, setDenyTaskId] = useState<string | null>(null);
  const [denyTaskTitle, setDenyTaskTitle] = useState("");
  const [denyReason, setDenyReason] = useState("");

  // Task detail dialog (for "Verify Task")
  const [verifyTask, setVerifyTask] = useState<any | null>(null);

  const handleComplete = (taskId: string, remarks?: string) => {
    completeTask.mutate(
      { taskId, remarks },
      {
        onSuccess: (data: any) => {
          const msg = data?.message || "Task Completed! +1 Leaderboard Point Earned";
          toast.success(msg, {
            icon: "🎉",
            duration: 4000
          });
          try {
            confetti({
              particleCount: 75,
              spread: 65,
              origin: { y: 0.65 }
            });
          } catch (_) {}
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.message || "Failed to complete task");
        }
      }
    );
  };

  const onDragEnd = (result: any) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId;

    if (newStatus === "Completed") {
      handleComplete(draggableId);
      return;
    }

    updateTaskStatus.mutate(
      { id: draggableId, status: newStatus },
      {
        onSuccess: () => toast.success(`Task moved to ${newStatus}`),
        onError: (err: any) => toast.error(err.response?.data?.message || "Failed to update status"),
      }
    );
  };

  const openNew = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setProjectId("");
    setVentureId(ventures && ventures.length > 0 ? ventures[0]._id : "");
    setAssigneeId("");
    setPriority("Medium");
    setStatus("Pending");
    setDeadline("");
    setOpen(true);
  };

  const openEdit = (t: any) => {
    setEditingId(t._id || t.id);
    setTitle(t.title || "");
    setDescription(t.description || "");
    setProjectId(t.project?._id || t.project || "");
    setVentureId(t.venture?._id || t.venture || "");
    setAssigneeId(t.assignedTo?._id || t.assignedTo || "");
    setPriority(t.priority || "Medium");
    setStatus(t.status || "Pending");
    setDeadline(t.deadline ? new Date(t.deadline).toISOString().split("T")[0] : "");
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !ventureId) {
      toast.error("Venture and Task Title are required.");
      return;
    }

    const payload = {
      title,
      description,
      project: projectId || null,
      venture: ventureId,
      assignedTo: assigneeId || null,
      priority,
      status,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
    };

    if (editingId) {
      updateTask.mutate(
        { id: editingId, data: payload },
        {
          onSuccess: () => {
            toast.success("Task updated successfully");
            setOpen(false);
          },
          onError: (err: any) => {
            toast.error(err.response?.data?.message || "Failed to update task");
          },
        }
      );
    } else {
      createTask.mutate(payload, {
        onSuccess: () => {
          toast.success("Task created successfully");
          setOpen(false);
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.message || "Failed to create task");
        },
      });
    }
  };

  const handleStatusChange = (id: string, newStatus: string) => {
    if (newStatus === "Completed") {
      handleComplete(id);
      return;
    }
    updateTaskStatus.mutate(
      { id, status: newStatus },
      {
        onSuccess: () => toast.success(`Task moved to ${newStatus}`),
        onError: (err: any) => toast.error(err.response?.data?.message || "Failed to update status"),
      }
    );
  };

  const handleDelete = (id: string, taskTitle: string) => {
    if (confirm(`Are you sure you want to delete task "${taskTitle}"?`)) {
      deleteTask.mutate(id, {
        onSuccess: () => toast.success("Task deleted successfully"),
        onError: (err: any) => toast.error(err.response?.data?.message || "Failed to delete task"),
      });
    }
  };

  const handleSubmitForCompletion = (taskId: string) => {
    submitCompletion.mutate(taskId, {
      onSuccess: () => toast.success("Task submitted for completion approval!"),
      onError: (err: any) => toast.error(err.response?.data?.message || "Failed to submit task"),
    });
  };

  const handleApprove = (taskId: string) => {
    approveCompletion.mutate(taskId, {
      onSuccess: () => toast.success("Task approved and marked as Completed!"),
      onError: (err: any) => toast.error(err.response?.data?.message || "Failed to approve task"),
    });
  };

  const openDenyDialog = (taskId: string, taskTitle: string) => {
    setDenyTaskId(taskId);
    setDenyTaskTitle(taskTitle);
    setDenyReason("");
    setDenyDialogOpen(true);
  };

  const handleConfirmDeny = () => {
    if (!denyTaskId || !denyReason.trim()) return;
    denyCompletion.mutate(
      { taskId: denyTaskId, reason: denyReason },
      {
        onSuccess: () => {
          toast.success("Task completion denied.");
          setDenyDialogOpen(false);
          setDenyTaskId(null);
        },
        onError: (err: any) => toast.error(err.response?.data?.message || "Failed to deny task"),
      }
    );
  };

  const canCreate = hasPermission(user?.role, "tasks", "create");
  const canEdit = hasPermission(user?.role, "tasks", "update");
  const canDelete = hasPermission(user?.role, "tasks", "delete");

  const getStatusColor = (st: string) => {
    switch (st) {
      case "Pending": return "border-slate-500/30 bg-slate-500/5";
      case "In Progress": return "border-blue-500/30 bg-blue-500/5";
      case "Review": return "border-amber-500/30 bg-amber-500/5";
      case "Pending_Approval": return "border-purple-500/30 bg-purple-500/5";
      case "Completed": return "border-green-500/30 bg-green-500/5";
      default: return "border-border bg-card/60";
    }
  };

  const getStatusLabel = (st: string) => {
    if (st === "Pending_Approval") return "Waiting Approval";
    return st;
  };

  const getStatusBadgeColor = (st: string) => {
    switch (st) {
      case "In Progress": return "bg-blue-500/20 text-blue-400";
      case "Review": return "bg-amber-500/20 text-amber-400";
      case "Pending_Approval": return "bg-purple-500/20 text-purple-400";
      case "Completed": return "bg-green-500/20 text-green-400";
      default: return "bg-slate-500/20 text-slate-400";
    }
  };

  const visibleStatuses = isManagement ? ALL_STATUSES : ALL_STATUSES;

  return (
    <PageContainer>
      <PageHeader
        title="Tasks"
        subtitle="Everything on your plate — timelines, priorities, progress."
        actions={
          <RoleGuard resource="tasks" action="create">
            <Button className="rounded-xl gradient-royal text-white gap-1.5 cursor-pointer" onClick={openNew}>
              <Plus className="h-4 w-4" /> New task
            </Button>
          </RoleGuard>
        }
      />

      <SectionCard title="Task Board">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading tasks...</div>
        ) : !tasks || tasks.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <ClipboardList className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-base">No tasks found</h3>
              <p className="text-sm text-muted-foreground">Create a new task to organize your workflow.</p>
            </div>
            {canCreate && (
              <Button className="rounded-xl gradient-royal text-white gap-1.5 mt-2 cursor-pointer" onClick={openNew}>
                <Plus className="h-4 w-4" /> New task
              </Button>
            )}
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              {visibleStatuses.map((st) => {
                const statusTasks = tasks.filter((t: any) => t.status === st);
                const isPendingApproval = st === "Pending_Approval";

                return (
                  <Droppable
                    key={st}
                    droppableId={st}
                    isDropDisabled={false}
                  >
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`rounded-2xl border p-4 flex flex-col min-h-[340px] transition-colors ${getStatusColor(st)}`}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {isPendingApproval && (
                              <Clock className="h-3 w-3 text-purple-400" />
                            )}
                            <h3 className="text-sm font-semibold">{getStatusLabel(st)}</h3>
                          </div>
                          <Badge variant="secondary" className="rounded-full">
                            {statusTasks.length}
                          </Badge>
                        </div>

                        <div className="space-y-3 flex-1 overflow-y-auto min-h-[200px]">
                          {statusTasks.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-6">
                              No tasks in {getStatusLabel(st)}
                            </p>
                          ) : (
                            statusTasks.map((t: any, index: number) => {
                              const taskId = t._id || t.id;
                              return (
                                <Draggable
                                  key={taskId}
                                  draggableId={taskId}
                                  index={index}
                                  isDragDisabled={false}
                                >
                                  {(draggableProvided, snapshot) => (
                                    <div
                                      ref={draggableProvided.innerRef}
                                      {...draggableProvided.draggableProps}
                                      {...draggableProvided.dragHandleProps}
                                      className={`p-3 bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow group flex flex-col justify-between cursor-grab active:cursor-grabbing ${snapshot.isDragging ? "ring-2 ring-primary shadow-lg" : ""}`}
                                    >
                                      <div>
                                        <div className="flex items-start justify-between gap-1">
                                          <h4 className="font-medium text-sm text-foreground">{t.title}</h4>
                                          {(canEdit || canDelete) && (
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                              {canEdit && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    openEdit(t);
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
                                                    handleDelete(taskId, t.title);
                                                  }}
                                                  className="p-1 text-muted-foreground hover:text-rose-500 rounded"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              )}
                                            </div>
                                          )}
                                        </div>

                                        {t.description && (
                                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{t.description}</p>
                                        )}

                                        {/* Assignee */}
                                        {t.assignedTo?.name && (
                                          <p className="text-[10px] text-muted-foreground mt-1">
                                            👤 {t.assignedTo.name}
                                          </p>
                                        )}

                                        {/* Denial reason */}
                                        {t.completionDenied && t.denialReason && (
                                          <div className="mt-1.5 text-[10px] bg-rose-500/10 border border-rose-500/20 rounded-lg px-2 py-1 text-rose-400">
                                            <span className="font-semibold">Denied:</span> {t.denialReason}
                                          </div>
                                        )}
                                      </div>

                                      <div className="mt-3 pt-2 border-t border-border/50 flex flex-col gap-2">
                                        {/* Status select — all statuses available */}
                                        <div className="flex items-center justify-between text-xs">
                                          <select
                                            value={t.status}
                                            onChange={(e) => handleStatusChange(taskId, e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-[11px] bg-muted/60 border border-border rounded-md px-1.5 py-0.5 text-foreground focus:outline-none"
                                          >
                                            {ALL_STATUSES.map((s) => (
                                              <option key={s} value={s}>
                                                {getStatusLabel(s)}
                                              </option>
                                            ))}
                                          </select>

                                          <Badge
                                            variant="outline"
                                            className={`text-[10px] rounded-md ${
                                              t.priority === "Critical"
                                                ? "text-rose-500 border-rose-500/30"
                                                : t.priority === "High"
                                                ? "text-amber-500 border-amber-500/30"
                                                : "text-muted-foreground"
                                            }`}
                                          >
                                            {t.priority || "Medium"}
                                          </Badge>
                                        </div>

                                        {/* Complete Task button with +1 point reward */}
                                        {t.status !== "Completed" && (
                                          <Button
                                            size="sm"
                                            className="w-full h-6 text-[10px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white gap-1 cursor-pointer shadow-sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleComplete(taskId);
                                            }}
                                            disabled={completeTask.isPending}
                                          >
                                            <CheckCircle2 className="w-2.5 h-2.5" />
                                            Complete Task (+1 pt)
                                          </Button>
                                        )}

                                        {/* Admin Approve/Deny for Pending_Approval tasks */}
                                        {isManagement && t.status === "Pending_Approval" && (
                                          <div className="flex gap-1">
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="flex-1 h-6 text-[10px] rounded-lg text-rose-400 hover:bg-rose-500/10 border border-rose-500/20"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openDenyDialog(taskId, t.title);
                                              }}
                                            >
                                              Deny
                                            </Button>
                                            <Button
                                              size="sm"
                                              className="flex-1 h-6 text-[10px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleApprove(taskId);
                                              }}
                                              disabled={approveCompletion.isPending}
                                            >
                                              <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                                              Approve
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              );
                            })
                          )}
                          {provided.placeholder}
                        </div>
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
          </DragDropContext>
        )}
      </SectionCard>

      {/* Create / Edit Task Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-background text-foreground border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Task" : "Create New Task"}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {editingId ? "Update task information and assignments." : "Add a new task to your team workflow."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div>
              <Label htmlFor="taskTitle">Task Title *</Label>
              <Input
                id="taskTitle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Design Landing Page"
                className="mt-1.5 rounded-xl border-border"
                required
              />
            </div>

            <div>
              <Label htmlFor="taskDesc">Description</Label>
              <Textarea
                id="taskDesc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed instructions or acceptance criteria..."
                className="mt-1.5 rounded-xl border-border"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="taskVenture">Venture *</Label>
                <select
                  id="taskVenture"
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
                <Label htmlFor="taskProject">Project</Label>
                <select
                  id="taskProject"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full mt-1.5 h-10 px-3 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none"
                >
                  <option value="">No Project</option>
                  {projects
                    ?.filter((p: any) => !ventureId || p.venture?._id === ventureId || p.venture === ventureId)
                    .map((p: any) => (
                      <option key={p._id || p.id} value={p._id || p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="taskAssignee">Assignee</Label>
                <select
                  id="taskAssignee"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full mt-1.5 h-10 px-3 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none"
                >
                  <option value="">Unassigned</option>
                  {employees?.map((emp: any) => (
                    <option key={emp._id || emp.id} value={emp._id || emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="taskPriority">Priority</Label>
                <select
                  id="taskPriority"
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
                <Label htmlFor="taskStatus">Status</Label>
                <select
                  id="taskStatus"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full mt-1.5 h-10 px-3 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none"
                >
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Review">Review</option>
                  {isManagement && <option value="Completed">Completed</option>}
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="taskDeadline">Deadline</Label>
              <Input
                id="taskDeadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="mt-1.5 rounded-xl border-border"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" className="rounded-xl" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={editingId ? updateTask.isPending : createTask.isPending}
                className="rounded-xl gradient-royal text-white hover:opacity-90"
              >
                {editingId
                  ? updateTask.isPending ? "Updating..." : "Update Task"
                  : createTask.isPending ? "Creating..." : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deny Completion Dialog */}
      <Dialog open={denyDialogOpen} onOpenChange={setDenyDialogOpen}>
        <DialogContent className="max-w-sm bg-background text-foreground border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-rose-400">Deny Completion</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Why are you denying completion of "{denyTaskTitle}"?
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={denyReason}
            onChange={(e) => setDenyReason(e.target.value)}
            placeholder="Enter reason for denial..."
            className="rounded-xl border-border min-h-[80px]"
          />
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setDenyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-rose-500 text-white hover:bg-rose-600"
              onClick={handleConfirmDeny}
              disabled={!denyReason.trim() || denyCompletion.isPending}
            >
              {denyCompletion.isPending ? "Denying..." : "Deny Completion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify Task Dialog */}
      <Dialog open={!!verifyTask} onOpenChange={() => setVerifyTask(null)}>
        <DialogContent className="max-w-lg bg-background text-foreground border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>
          {verifyTask && (
            <div className="space-y-3 text-sm">
              <div><span className="font-semibold">Title:</span> {verifyTask.title}</div>
              <div><span className="font-semibold">Description:</span> {verifyTask.description || "—"}</div>
              <div><span className="font-semibold">Assigned to:</span> {verifyTask.assignedTo?.name || "Unassigned"}</div>
              <div><span className="font-semibold">Priority:</span> {verifyTask.priority}</div>
              <div><span className="font-semibold">Status:</span> {getStatusLabel(verifyTask.status)}</div>
              <div><span className="font-semibold">Progress:</span> {verifyTask.progress}%</div>
              {verifyTask.deadline && (
                <div><span className="font-semibold">Deadline:</span> {new Date(verifyTask.deadline).toLocaleDateString()}</div>
              )}
              {verifyTask.submittedForApprovalAt && (
                <div><span className="font-semibold">Submitted at:</span> {new Date(verifyTask.submittedForApprovalAt).toLocaleString()}</div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setVerifyTask(null)}>Close</Button>
            {isManagement && verifyTask?.status === "Pending_Approval" && (
              <>
                <Button
                  className="rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                  variant="ghost"
                  onClick={() => {
                    setVerifyTask(null);
                    openDenyDialog(verifyTask._id || verifyTask.id, verifyTask.title);
                  }}
                >
                  Deny
                </Button>
                <Button
                  className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => {
                    handleApprove(verifyTask._id || verifyTask.id);
                    setVerifyTask(null);
                  }}
                >
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </PageContainer>
  );
}
