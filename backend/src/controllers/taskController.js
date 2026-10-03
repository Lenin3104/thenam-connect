const asyncHandler = require('../utils/asyncHandler');
const { success, created } = require('../utils/apiResponse');
const taskService = require('../services/taskService');

const createTask = asyncHandler(async (req, res) => {
    const task = await taskService.createTask(req.body, req.user.id || req.user._id);
    return created(res, task, 'Task created successfully');
});

const getTasks = asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.venture) filter.venture = req.query.venture;
    if (req.query.project) filter.project = req.query.project;
    if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
    
    const tasks = await taskService.listTasks(filter, req.user);
    return success(res, tasks, 'Tasks retrieved successfully');
});

const getTask = asyncHandler(async (req, res) => {
    const task = await taskService.getTaskById(req.params.id, req.user);
    return success(res, task, 'Task retrieved successfully');
});

const updateTask = asyncHandler(async (req, res) => {
    const task = await taskService.updateTask(req.params.id, req.body, req.user);
    return success(res, task, 'Task updated successfully');
});

const updateTaskStatus = asyncHandler(async (req, res) => {
    const task = await taskService.updateTaskStatus(req.params.id, req.body.status, req.user);
    return success(res, task, 'Task status updated successfully');
});

const deleteTask = asyncHandler(async (req, res) => {
    await taskService.deleteTask(req.params.id, req.user);
    return success(res, null, 'Task deleted successfully');
});

// ── Approval Workflow ─────────────────────────────────────────────────────────

/**
 * Employee submits task for completion approval.
 * POST /api/tasks/:id/submit-completion
 */
const submitCompletion = asyncHandler(async (req, res) => {
    const task = await taskService.submitForCompletion(req.params.id, req.user);
    return success(res, task, 'Task submitted for completion approval');
});

/**
 * Admin approves task completion.
 * POST /api/tasks/:id/approve-completion
 */
const approveCompletion = asyncHandler(async (req, res) => {
    const task = await taskService.approveCompletion(req.params.id, req.user);
    return success(res, task, 'Task completion approved');
});

/**
 * Admin denies task completion with a reason.
 * POST /api/tasks/:id/deny-completion
 * Body: { reason: string }
 */
const denyCompletion = asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const task = await taskService.denyCompletion(req.params.id, req.user, reason);
    return success(res, task, 'Task completion denied');
});

/**
 * Employee completes task directly:
 * PATCH /api/tasks/:id/complete
 */
const completeTask = asyncHandler(async (req, res) => {
    const result = await taskService.completeTask(req.params.id, req.user, req.body.remarks || req.body.completionRemarks);
    return success(res, result, result.message);
});

module.exports = {
    createTask,
    getTasks,
    getTask,
    updateTask,
    updateTaskStatus,
    deleteTask,
    submitCompletion,
    approveCompletion,
    denyCompletion,
    completeTask
};
