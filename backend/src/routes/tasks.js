const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { protect, canAccess } = require('../middleware/auth');

router.use(protect);

router.route('/')
    .get(canAccess('tasks', 'read'), taskController.getTasks)
    .post(canAccess('tasks', 'create'), taskController.createTask);

router.route('/:id/status')
    .patch(canAccess('tasks', 'update'), taskController.updateTaskStatus)
    .put(canAccess('tasks', 'update'), taskController.updateTaskStatus);

// ── Complete Task (Automatic +1 point, duplicate protected) ───────────────────
router.route('/:id/complete')
    .patch(taskController.completeTask)
    .post(taskController.completeTask);

// ── Approval workflow endpoints ───────────────────────────────────────────────
// Any authenticated user with task:update can submit (service enforces non-admin)
router.post('/:id/submit-completion', canAccess('tasks', 'update'), taskController.submitCompletion);

// Only management can approve or deny (canAccess checks delete = management level)
router.post('/:id/approve-completion', canAccess('tasks', 'delete'), taskController.approveCompletion);
router.post('/:id/deny-completion', canAccess('tasks', 'delete'), taskController.denyCompletion);

router.route('/:id')
    .get(canAccess('tasks', 'read'), taskController.getTask)
    .put(canAccess('tasks', 'update'), taskController.updateTask)
    .delete(canAccess('tasks', 'delete'), taskController.deleteTask);

module.exports = router;
