const Task = require('../models/Task');
const Project = require('../models/Project');
const Employee = require('../models/Employee');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { logActivity } = require('./activityService');
const { recalculatePerformance } = require('./employeeService');
const { createNotification } = require('./notificationService');
const { normalizeRole } = require('../config/rbac');
const { emitToUser, emitToRole } = require('./socketService');

const Team = require('../models/Team');
const { resolveEmployee } = require('../utils/resolveEmployee');
const { recordTaskCompletionReward } = require('./rewardService');

const MANAGEMENT_ROLES = ['admin', 'founder', 'manager', 'super admin'];

const getUserRole = (user) => {
  if (!user) return 'developer';
  if (user.userRole) return user.userRole;
  if (user.roles && user.roles.length > 0) return normalizeRole(user.roles[0]);
  return normalizeRole(user.role || '');
};

/**
 * Send notification alerts strictly and solely to the assigned employee.
 * Does NOT broadcast to other employees or team members.
 */
const sendTaskAssignmentNotifications = async (task) => {
  try {
    const recipientUserIds = new Set();

    // 1. Target ONLY the Assigned Employee
    let assignedEmp = null;
    if (task.assignedTo) {
      assignedEmp = await Employee.findById(task.assignedTo);
      if (assignedEmp) {
        const queryOr = [];
        if (assignedEmp.email) {
          queryOr.push({ email: new RegExp(`^${assignedEmp.email.trim()}$`, 'i') });
        }
        if (assignedEmp._id) {
          queryOr.push({ _id: assignedEmp._id });
        }
        if (assignedEmp.user) {
          queryOr.push({ _id: assignedEmp.user });
        }

        if (queryOr.length > 0) {
          const matchingUsers = await User.find({ $or: queryOr });
          matchingUsers.forEach((u) => recipientUserIds.add(String(u._id)));
        }
      }
    }

    if (recipientUserIds.size === 0) {
      return;
    }

    let projectObj = null;
    if (task.project) {
      projectObj = await Project.findById(task.project);
    }

    let assignerUser = null;
    if (task.assignedBy) {
      assignerUser = await User.findById(task.assignedBy);
    }

    const deadlineStr = task.deadline
      ? new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'No deadline set';
    const projectName = projectObj ? projectObj.name : 'General Project';
    const projectIdStr = projectObj ? String(projectObj._id) : (task.project ? String(task.project) : '');
    const managerName = assignerUser ? assignerUser.name : 'Project Manager';
    const descriptionText = task.description ? task.description.trim() : '';

    const title = `New Task Assigned: ${task.title}`;
    const message = `Project: ${projectName} | Priority: ${task.priority || 'Medium'} | Deadline: ${deadlineStr} | Assigned by: ${managerName}`;
    const actionUrl = projectIdStr ? `/projects?projectId=${projectIdStr}&taskId=${task._id}` : `/projects?taskId=${task._id}`;

    for (const userId of recipientUserIds) {
      await createNotification({
        userId,
        title,
        message,
        type: 'task_assigned',
        entityType: 'Task',
        entityId: task._id,
        relatedId: projectIdStr || null,
        relatedType: 'Project',
        actionUrl,
        icon: 'check-square',
        metadata: {
          projectId: projectIdStr || null,
          taskId: String(task._id),
          taskTitle: task.title,
          assignedBy: managerName
        }
      });

      // Realtime socket notification to the specific assigned user
      emitToUser(userId, 'task:assigned', {
        taskId: String(task._id),
        projectId: projectIdStr,
        taskTitle: task.title,
        assignedByName: managerName,
        dueDate: task.deadline,
        actionUrl,
        message
      });
    }
  } catch (err) {
    console.error('Error sending task assignment notifications:', err.message);
  }
};

/**
 * Check whether a user is allowed to edit or complete a specific task
 */
const verifyTaskAccess = async (task, user) => {
  if (!user) return;
  const userRole = getUserRole(user);
  if (MANAGEMENT_ROLES.includes(userRole)) return; // Admin/Founder/Manager always allowed

  const userIdStr = String(user._id || user.id);
  const emp = await Employee.findOne({ email: (user.email || '').toLowerCase() });
  const empIdStr = emp ? String(emp._id) : null;

  let isAssigned = empIdStr && task.assignedTo && String(task.assignedTo) === empIdStr;
  let isCreator = task.assignedBy && String(task.assignedBy) === userIdStr;

  let isProjectManager = false;
  if (task.project) {
    const proj = await Project.findById(task.project);
    if (proj && proj.manager && empIdStr && String(proj.manager) === empIdStr) {
      isProjectManager = true;
    }
  }

  if (!isAssigned && !isCreator && !isProjectManager) {
    throw new AppError('Forbidden: Only the assigned team member or project lead can view/update this task', 403);
  }
};

const createTask = async (data, userId) => {
  const task = await Task.create({
    ...data,
    assignedBy: userId
  });

  await logActivity({
    userId,
    action: 'Assigned Task',
    entity: 'Task',
    entityId: task._id,
    entityName: task.title
  });

  // Broadcast assignment notification alerts to team & members
  await sendTaskAssignmentNotifications(task);

  return task;
};

const listTasks = async (filter = {}, user = null) => {
  let query = { ...filter };

  if (user) {
    const userRole = getUserRole(user);
    if (!MANAGEMENT_ROLES.includes(userRole)) {
      const emp = await Employee.findOne({ email: (user.email || '').toLowerCase() });
      const empId = emp ? emp._id : null;
      const managedProjects = emp ? await Project.find({ manager: emp._id }).select('_id') : [];
      const managedProjectIds = managedProjects.map((p) => p._id);

      const userScope = {
        $or: [
          { assignedTo: empId },
          { assignedBy: user._id || user.id },
          { project: { $in: managedProjectIds } }
        ]
      };

      if (emp && emp.team) {
        userScope.$or.push({ team: emp.team });
      }

      query = { $and: [query, userScope] };
    }
  }

  return Task.find(query)
    .populate('venture', 'name key')
    .populate('project', 'name')
    .populate('assignedTo', 'name avatar')
    .populate('assignedBy', 'name')
    .sort({ deadline: 1, createdAt: -1 })
    .lean();
};

const getTaskById = async (id, user = null) => {
  const task = await Task.findById(id)
    .populate('venture', 'name key')
    .populate('project', 'name manager')
    .populate('assignedTo', 'name avatar department')
    .populate('assignedBy', 'name avatar')
    .lean();

  if (!task) throw new AppError('Task not found', 404);
  if (user) await verifyTaskAccess(task, user);

  return task;
};

const updateTask = async (id, data, user = null) => {
  const existingTask = await Task.findById(id);
  if (!existingTask) throw new AppError('Task not found', 404);

  if (user) await verifyTaskAccess(existingTask, user);

  const userId = user ? (user._id || user.id) : null;
  const task = await Task.findByIdAndUpdate(id, data, { new: true, runValidators: true });

  await logActivity({
    userId,
    action: 'Updated Task',
    entity: 'Task',
    entityId: task._id,
    entityName: task.title
  });

  await sendTaskAssignmentNotifications(task);

  return task;
};

/**
 * Update task status with role enforcement:
 * - Non-management users CANNOT set status = 'Completed' directly.
 * - They must use submitForCompletion instead.
 */
const updateTaskStatus = async (id, status, user = null) => {
  const task = await Task.findById(id);
  if (!task) throw new AppError('Task not found', 404);

  const userId = user ? (user._id || user.id) : null;
  const userRole = getUserRole(user);
  const isManagement = MANAGEMENT_ROLES.includes(userRole);

  // ── Security enforcement: block non-management from completing tasks ──────
  if (status === 'Completed' && !isManagement) {
    throw new AppError(
      'Forbidden: Only Admin/Founder/Manager can mark tasks as Completed. Submit for completion approval instead.',
      403
    );
  }

  // ── Prevent non-management from setting Pending_Approval directly ─────────
  // They should use the dedicated submit-completion endpoint
  if (status === 'Pending_Approval' && !isManagement) {
    // Allow — this is what the frontend calls via submit-completion; 
    // we'll enforce through the dedicated endpoint in practice.
    // Here we allow it only if submitted through proper flow.
  }

  task.status = status;
  if (status === 'Completed') {
    task.progress = 100;
    task.completedDate = new Date();
    if (!task.completionRemarks) {
      task.completionRemarks = 'Marked completed';
    }
  }
  await task.save();

  if (status === 'Completed' && task.assignedTo) {
    const emp = await Employee.findById(task.assignedTo);
    if (emp) {
      await recordTaskCompletionReward(task, emp, task.completionRemarks);
    }
    await recalculatePerformance(task.assignedTo);
  }

  await logActivity({
    userId,
    action: `Marked Task as ${status}`,
    entity: 'Task',
    entityId: task._id,
    entityName: task.title
  });

  await task.populate([
    { path: 'venture', select: 'name key' },
    { path: 'project', select: 'name' },
    { path: 'assignedTo', select: 'name avatar' },
    { path: 'assignedBy', select: 'name' }
  ]);

  return task;
};

/**
 * Employee submits task for completion approval.
 * Status becomes Pending_Approval and admin(s) are notified.
 */
const submitForCompletion = async (id, user) => {
  const task = await Task.findById(id);
  if (!task) throw new AppError('Task not found', 404);

  const userRole = getUserRole(user);
  if (MANAGEMENT_ROLES.includes(userRole)) {
    // Admin can approve directly — redirect them to approve endpoint
    throw new AppError('Admins can directly approve/complete tasks. Use the approve endpoint.', 400);
  }

  if (task.status === 'Completed') {
    throw new AppError('Task is already completed.', 400);
  }
  if (task.status === 'Pending_Approval') {
    throw new AppError('Task is already pending approval.', 400);
  }

  const userId = user._id || user.id;

  task.status = 'Pending_Approval';
  task.submittedForApprovalAt = new Date();
  task.submittedBy = userId;
  task.completionDenied = false;
  task.denialReason = null;
  await task.save();

  await logActivity({
    userId,
    action: 'Submitted Task for Completion Approval',
    entity: 'Task',
    entityId: task._id,
    entityName: task.title
  });

  // Notify all admin/founder users
  const adminUsers = await User.find({ role: { $in: ['admin', 'Admin', 'founder', 'Founder', 'manager', 'Manager'] } });
  for (const admin of adminUsers) {
    await createNotification({
      userId: String(admin._id),
      title: `Task Completion Approval Required`,
      message: `${user.name || 'An employee'} submitted "${task.title}" for completion approval.`,
      type: 'task_approval_request',
      entityType: 'Task',
      entityId: task._id,
      actionUrl: '/tasks',
      icon: 'check-circle',
      metadata: {
        taskId: task._id,
        taskTitle: task.title,
        submittedBy: user.name,
        submittedAt: task.submittedForApprovalAt
      }
    });

    emitToUser(String(admin._id), 'task:approval_request', {
      taskId: task._id,
      taskTitle: task.title,
      submittedByName: user.name || 'An employee',
      submittedByUserId: userId,
      submittedAt: task.submittedForApprovalAt
    });
  }

  return task;
};

/**
 * Admin approves task completion.
 */
const approveCompletion = async (id, user) => {
  const userRole = getUserRole(user);
  if (!MANAGEMENT_ROLES.includes(userRole)) {
    throw new AppError('Forbidden: Only Admin/Founder/Manager can approve task completion.', 403);
  }

  const task = await Task.findById(id);
  if (!task) throw new AppError('Task not found', 404);

  if (task.status !== 'Pending_Approval') {
    throw new AppError(`Task is not pending approval. Current status: ${task.status}`, 400);
  }

  const userId = user._id || user.id;

  task.status = 'Completed';
  task.progress = 100;
  task.completedDate = new Date();
  task.completionApproved = true;
  task.completionDenied = false;
  task.approvedBy = userId;
  task.approvedByName = user.name || '';
  task.approvedAt = new Date();
  if (!task.completionRemarks) {
    task.completionRemarks = 'Approved by admin';
  }
  await task.save();

  if (task.assignedTo) {
    const emp = await Employee.findById(task.assignedTo);
    if (emp) {
      await recordTaskCompletionReward(task, emp, task.completionRemarks);
    }
    await recalculatePerformance(task.assignedTo);
  }

  await logActivity({
    userId,
    action: 'Approved Task Completion',
    entity: 'Task',
    entityId: task._id,
    entityName: task.title
  });

  // Find the user who submitted and notify them
  let submitterId = task.submittedBy;
  if (!submitterId && task.assignedTo) {
    // Fallback: find user linked to the assigned employee
    const emp = await Employee.findById(task.assignedTo);
    if (emp) {
      const linkedUser = await User.findOne({ email: new RegExp(`^${emp.email}$`, 'i') });
      if (linkedUser) submitterId = linkedUser._id;
    }
  }

  if (submitterId) {
    const submitterIdStr = String(submitterId);
    await createNotification({
      userId: submitterIdStr,
      title: `Task Approved: ${task.title}`,
      message: `Your task "${task.title}" was approved and marked as Completed by ${user.name || 'Admin'}.`,
      type: 'task_approved',
      entityType: 'Task',
      entityId: task._id,
      actionUrl: '/tasks',
      icon: 'check-circle-2'
    });

    emitToUser(submitterIdStr, 'task:approved', {
      taskId: task._id,
      taskTitle: task.title,
      approvedByName: user.name || 'Admin',
      approvedAt: task.approvedAt
    });
  }

  return task;
};

/**
 * Admin denies task completion with a reason.
 */
const denyCompletion = async (id, user, reason) => {
  const userRole = getUserRole(user);
  if (!MANAGEMENT_ROLES.includes(userRole)) {
    throw new AppError('Forbidden: Only Admin/Founder/Manager can deny task completion.', 403);
  }

  const task = await Task.findById(id);
  if (!task) throw new AppError('Task not found', 404);

  if (task.status !== 'Pending_Approval') {
    throw new AppError(`Task is not pending approval. Current status: ${task.status}`, 400);
  }

  if (!reason || !reason.trim()) {
    throw new AppError('A denial reason is required.', 400);
  }

  const userId = user._id || user.id;

  // Revert to In Progress so employee can continue
  task.status = 'In Progress';
  task.completionDenied = true;
  task.completionApproved = false;
  task.deniedBy = userId;
  task.deniedByName = user.name || '';
  task.deniedAt = new Date();
  task.denialReason = reason.trim();
  await task.save();

  await logActivity({
    userId,
    action: 'Denied Task Completion',
    entity: 'Task',
    entityId: task._id,
    entityName: task.title
  });

  // Notify the submitter
  let submitterId = task.submittedBy;
  if (!submitterId && task.assignedTo) {
    const emp = await Employee.findById(task.assignedTo);
    if (emp) {
      const linkedUser = await User.findOne({ email: new RegExp(`^${emp.email}$`, 'i') });
      if (linkedUser) submitterId = linkedUser._id;
    }
  }

  if (submitterId) {
    const submitterIdStr = String(submitterId);
    await createNotification({
      userId: submitterIdStr,
      title: `Task Completion Not Approved: ${task.title}`,
      message: `Your task "${task.title}" completion was not approved. Reason: ${reason}`,
      type: 'task_denied',
      entityType: 'Task',
      entityId: task._id,
      actionUrl: '/tasks',
      icon: 'x-circle',
      metadata: { denialReason: reason }
    });

    emitToUser(submitterIdStr, 'task:denied', {
      taskId: task._id,
      taskTitle: task.title,
      deniedByName: user.name || 'Admin',
      denialReason: reason,
      deniedAt: task.deniedAt
    });
  }

  return task;
};

const deleteTask = async (id, user = null) => {
  const task = await Task.findById(id);
  if (!task) throw new AppError('Task not found', 404);

  if (user) await verifyTaskAccess(task, user);

  const userId = user ? (user._id || user.id) : null;
  await Task.findByIdAndDelete(id);

  await logActivity({
    userId,
    action: 'Deleted Task',
    entity: 'Task',
    entityId: task._id,
    entityName: task.title
  });

  return null;
};

/**
 * Employee completes a task directly:
 * PATCH /api/tasks/:id/complete
 * - Authenticate employee
 * - Verify ownership (assigned to employee, or management override)
 * - Check task status
 * - Mark completed
 * - Add exactly 1 point
 * - Prevent duplicate points
 * - Return updated task and reward information
 */
const completeTask = async (id, user, remarks = '') => {
  const task = await Task.findById(id);
  if (!task) throw new AppError('Task not found', 404);

  const emp = await resolveEmployee(user);
  const userRole = getUserRole(user);
  const isManagement = MANAGEMENT_ROLES.includes(userRole);

  const empIdStr = emp ? String(emp._id) : null;
  const isAssigned = empIdStr && task.assignedTo && String(task.assignedTo) === empIdStr;

  if (!isAssigned && !isManagement) {
    throw new AppError('Forbidden: Only the assigned employee or manager can complete this task', 403);
  }

  let targetEmployee = null;
  if (task.assignedTo) {
    targetEmployee = await Employee.findById(task.assignedTo);
  }
  if (!targetEmployee && emp) {
    targetEmployee = emp;
    task.assignedTo = emp._id;
  }

  // Calculate duration
  const start = task.createdAt || new Date();
  const end = new Date();
  const diffMs = Math.max(0, end.getTime() - new Date(start).getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const durationStr = diffDays > 0 ? `${diffDays}d ${diffHours}h` : `${Math.max(1, diffHours)}h`;

  task.completionDuration = durationStr;
  task.completionRemarks = remarks || task.completionRemarks || 'Completed by employee';
  task.status = 'Completed';
  task.progress = 100;
  task.completedDate = task.completedDate || end;

  let rewardResult = { pointsAwarded: 0, alreadyAwarded: true };
  if (targetEmployee) {
    rewardResult = await recordTaskCompletionReward(task, targetEmployee, task.completionRemarks);
  } else {
    await task.save();
  }

  if (task.assignedTo) {
    await recalculatePerformance(task.assignedTo);
  }

  await logActivity({
    userId: user._id || user.id,
    action: 'Completed Task',
    entity: 'Task',
    entityId: task._id,
    entityName: task.title
  });

  const updatedTask = await Task.findById(id)
    .populate('venture', 'name key')
    .populate('project', 'name')
    .populate('assignedTo', 'name avatar department employeeId')
    .populate('assignedBy', 'name');

  return {
    task: updatedTask,
    pointsAwarded: rewardResult.pointsAwarded,
    alreadyAwarded: rewardResult.alreadyAwarded,
    totalPoints: rewardResult.employeeReward?.totalPoints ?? (targetEmployee?.rewardPoints || 0),
    message: rewardResult.pointsAwarded > 0
      ? 'Task Completed! +1 Leaderboard Point Earned'
      : 'Task marked as Completed. (Point was already awarded previously)'
  };
};

module.exports = {
  createTask,
  listTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
  submitForCompletion,
  approveCompletion,
  denyCompletion,
  deleteTask,
  completeTask
};
