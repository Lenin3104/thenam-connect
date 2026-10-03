const asyncHandler = require('../utils/asyncHandler');
const { success, error } = require('../utils/apiResponse');
const aiService = require('../services/aiService');

/**
 * Handle AI Chat messages.
 * POST /api/ai/chat
 */
const chat = asyncHandler(async (req, res) => {
  const { message, history } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return error(res, 'A non-empty message is required', 400);
  }

  try {
    const result = await aiService.processChat(req.user, req.userRole, message.trim(), history || []);
    return success(res, result, 'AI response generated successfully');
  } catch (err) {
    console.error('AI Chat Controller Error:', err);
    return error(res, "Sorry, I'm unable to connect to Thenam AI right now. Please try again.", 500);
  }
});

/**
 * Get role-based suggested quick actions for the chatbot welcome view.
 * GET /api/ai/quick-actions
 */
const getQuickActions = asyncHandler(async (req, res) => {
  const userRole = (req.userRole || req.user?.role || 'developer').toLowerCase();
  const isManagement = ['admin', 'founder', 'manager', 'super admin', 'ceo'].includes(userRole);

  let actions = [];

  if (isManagement) {
    actions = [
      { label: 'Team Tasks', prompt: 'Show team tasks and progress' },
      { label: 'Project Status', prompt: 'What is the current status of our active projects?' },
      { label: 'Pending Tasks', prompt: 'How many tasks are currently pending across the team?' },
      { label: 'Announcements', prompt: 'What announcements were posted recently?' },
      { label: 'Leaderboard', prompt: 'Show current leaderboard rankings' }
    ];
  } else {
    actions = [
      { label: 'My Tasks', prompt: 'What tasks are assigned to me?' },
      { label: 'Pending Tasks', prompt: 'How many tasks are pending?' },
      { label: 'My Projects', prompt: 'What projects am I working on?' },
      { label: 'My Rewards', prompt: 'How many leaderboard points do I have?' },
      { label: 'My Reports', prompt: 'Show my tasks report summary' },
      { label: 'Notifications', prompt: 'Show my recent notifications' }
    ];
  }

  return success(res, { actions, role: userRole });
});

module.exports = {
  chat,
  getQuickActions
};
