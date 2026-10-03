const Task = require('../models/Task');
const Project = require('../models/Project');
const Employee = require('../models/Employee');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Announcement = require('../models/Announcement');
const taskService = require('./taskService');
const rewardService = require('./rewardService');
const { resolveEmployee } = require('../utils/resolveEmployee');
const { normalizeRole, checkPermission, PERMISSIONS } = require('../config/rbac');

const MANAGEMENT_ROLES = ['admin', 'founder', 'manager', 'super admin', 'ceo'];

/**
 * Resolves authenticated user identity and role-based permissions safely.
 */
const getUserContext = async (user, rawRole) => {
  const role = normalizeRole(rawRole || user.userRole || user.role);
  const employee = await resolveEmployee(user);

  return {
    userId: user._id || user.id,
    employeeMongoId: employee ? employee._id : null,
    employeeId: employee ? employee.employeeId : null,
    name: user.name || employee?.name || 'User',
    email: (user.email || employee?.email || '').toLowerCase(),
    role,
    isManagement: MANAGEMENT_ROLES.includes(role),
    department: employee?.department || user.department || 'General',
    permissions: PERMISSIONS[role] || {}
  };
};

/**
 * Classifies query intent based on keywords and user questions.
 */
const detectIntent = (text) => {
  const q = text.toLowerCase();

  if (q.includes('salary') || q.includes('payroll') || q.includes('compensation') || q.includes('paycheck') || q.includes('bank details')) {
    return 'salary_confidential';
  }
  if (q.includes('task') || q.includes('pending') || q.includes('overdue') || q.includes('assigned to me') || q.includes('my work') || q.includes('assignment') || q.includes('todos') || q.includes('to-do')) {
    return 'tasks';
  }
  if (q.includes('project') || q.includes('milestone')) {
    return 'projects';
  }
  if (q.includes('reward') || q.includes('point') || q.includes('leaderboard') || q.includes('rank') || q.includes('badge') || q.includes('score')) {
    return 'rewards';
  }
  if (q.includes('notification') || q.includes('alerts')) {
    return 'notifications';
  }
  if (q.includes('announcement') || q.includes('notice') || q.includes('news')) {
    return 'announcements';
  }
  if (q.includes('report') || q.includes('timesheet') || q.includes('summary')) {
    return 'reports';
  }
  if (q.includes('team') || q.includes('employee') || q.includes('colleague') || q.includes('staff')) {
    return 'team';
  }
  if (q.includes('how to complete') || q.includes('submit task') || q.includes('how do i') || q.includes('what is thenam') || q.includes('help') || q.includes('features')) {
    return 'help_erp';
  }

  return 'general';
};

/**
 * Fetch permitted ERP data according to user role and authorization rules.
 * Never retrieves or leaks unauthorized data.
 */
const fetchAuthorizedErpData = async (userContext, intent, userObj) => {
  const data = {};

  // 1. Task Data
  if (intent === 'tasks' || intent === 'general' || intent === 'reports') {
    if (checkPermission(userContext.role, 'tasks', 'read')) {
      const tasks = await taskService.listTasks({}, userObj);
      const now = new Date();

      data.tasks = {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'Pending').length,
        inProgress: tasks.filter(t => t.status === 'In Progress').length,
        review: tasks.filter(t => t.status === 'Review' || t.status === 'Pending_Approval').length,
        completed: tasks.filter(t => t.status === 'Completed').length,
        overdue: tasks.filter(t => t.deadline && new Date(t.deadline) < now && t.status !== 'Completed').length,
        items: tasks.slice(0, 10).map(t => ({
          id: t._id,
          title: t.title,
          status: t.status,
          priority: t.priority || 'Medium',
          deadline: t.deadline ? new Date(t.deadline).toLocaleDateString() : 'None',
          project: t.project?.name || 'General',
          assignedBy: t.assignedBy?.name || 'Manager'
        }))
      };
    }
  }

  // 2. Project Data
  if (intent === 'projects' || intent === 'general') {
    if (checkPermission(userContext.role, 'projects', 'read')) {
      let projectQuery = {};
      if (!userContext.isManagement && userContext.employeeMongoId) {
        projectQuery = {
          $or: [
            { members: userContext.employeeMongoId },
            { manager: userContext.employeeMongoId }
          ]
        };
      }
      const projects = await Project.find(projectQuery)
        .select('name description status progress deadline priority manager')
        .populate('manager', 'name')
        .sort({ updatedAt: -1 })
        .limit(8)
        .lean();

      data.projects = {
        total: projects.length,
        items: projects.map(p => ({
          id: p._id,
          name: p.name,
          status: p.status || 'Active',
          progress: p.progress || 0,
          deadline: p.deadline ? new Date(p.deadline).toLocaleDateString() : 'None',
          manager: p.manager?.name || 'N/A'
        }))
      };
    }
  }

  // 3. Rewards & Leaderboard Data
  if (intent === 'rewards' || intent === 'general') {
    try {
      const myRewards = await rewardService.getMyRewards(userObj);
      const topLeaderboard = await rewardService.getLeaderboard({ limit: 5 });

      data.rewards = {
        myPoints: myRewards.totalPoints || 0,
        myRank: myRewards.currentRank || 'N/A',
        completedTasks: myRewards.completedTasks || 0,
        recentAchievements: (myRewards.recentAchievements || []).slice(0, 3).map(a => a.taskName),
        topLeaderboard: topLeaderboard.map(l => ({
          rank: l.rank,
          name: l.name,
          points: l.totalPoints,
          department: l.department
        }))
      };
    } catch (e) {
      console.warn('AI rewards fetch non-critical warning:', e.message);
    }
  }

  // 4. Notifications Data
  if (intent === 'notifications' || intent === 'general') {
    const notifs = await Notification.find({ user: userContext.userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    data.notifications = {
      totalUnread: notifs.filter(n => !n.isRead).length,
      items: notifs.map(n => ({
        title: n.title,
        message: n.message,
        isRead: n.isRead,
        time: new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }))
    };
  }

  // 5. Announcements Data
  if (intent === 'announcements' || intent === 'general') {
    const annQuery = {
      isActive: true,
      $or: [
        { targetAudience: 'Everyone' },
        { targetType: 'all' },
        { department: new RegExp(`^${userContext.department}$`, 'i') },
        { targetUsers: userContext.userId }
      ]
    };
    const announcements = await Announcement.find(annQuery)
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();

    data.announcements = announcements.map(a => ({
      title: a.title,
      content: a.content || a.message || '',
      priority: a.priority || 'Normal',
      date: new Date(a.createdAt).toLocaleDateString()
    }));
  }

  return data;
};

/**
 * Synthesizes intelligent rule-based responses using live ERP data.
 * Used whenever external LLM API keys are not provided or as an instant reliable fallback.
 */
const generateDeterministicResponse = (userContext, intent, message, erpData) => {
  const q = message.toLowerCase();
  const name = userContext.name;

  // 1. Confidentiality / Unauthorized Salary Block
  if (intent === 'salary_confidential') {
    if (userContext.role !== 'founder' && userContext.role !== 'finance') {
      return {
        message: `### 🔒 Access Restricted\n\nI cannot display salary, compensation, or confidential financial records. You do not have permission to view this data.\n\nIf you have payroll inquiries, please consult your **Finance Administrator** or **HR Department**.`,
        actions: []
      };
    }
  }

  // 2. Tasks
  if (intent === 'tasks') {
    if (!erpData.tasks) {
      return {
        message: `You currently do not have permission to access tasks in Thenam ERP.`,
        actions: []
      };
    }

    const { total, pending, inProgress, completed, overdue, items } = erpData.tasks;

    if (q.includes('pending') || q.includes('how many pending')) {
      const pendingItems = items.filter(t => t.status === 'Pending' || t.status === 'In Progress');
      return {
        message: `### 📋 Your Pending Tasks\n\nYou currently have **${pending} pending** tasks (and **${inProgress} in progress**).\n\n${
          pendingItems.length > 0
            ? pendingItems.map((t, idx) => `${idx + 1}. **${t.title}** — \`${t.status}\` (Project: ${t.project}, Due: ${t.deadline})`).join('\n')
            : 'No pending tasks found. All caught up! 🎉'
        }`,
        actions: [{ label: 'View Tasks', path: '/tasks' }]
      };
    }

    if (q.includes('overdue')) {
      return {
        message: `### ⚠️ Overdue Tasks\n\nYou currently have **${overdue} overdue task${overdue === 1 ? '' : 's'}**.\n\n${
          overdue > 0
            ? 'Please check your Tasks board to review and complete pending deadlines promptly.'
            : 'Awesome job! You have **0 overdue tasks**.'
        }`,
        actions: [{ label: 'View Tasks', path: '/tasks' }]
      };
    }

    if (q.includes('completed') || q.includes('how many tasks have i completed')) {
      return {
        message: `### ✅ Completed Tasks\n\nYou have completed **${completed} task${completed === 1 ? '' : 's'}** so far!\n\nEach approved completed task grants you **+1 point** on the Thenam ERP Leaderboard.`,
        actions: [
          { label: 'View Tasks', path: '/tasks' },
          { label: 'Open Rewards', path: '/rewards' }
        ]
      };
    }

    // Default task list / summary
    let itemsList = '';
    if (items.length > 0) {
      itemsList = items.map((t, i) => `${i + 1}. **${t.title}** — \`${t.status}\` | Priority: *${t.priority}* | Due: ${t.deadline}`).join('\n');
    } else {
      itemsList = 'No active tasks currently assigned to you.';
    }

    return {
      message: `### 📋 Task Summary for ${name}\n\nHere is your current task overview:\n\n- **Total Tasks:** ${total}\n- **In Progress:** ${inProgress}\n- **Pending:** ${pending}\n- **Completed:** ${completed}\n- **Overdue:** ${overdue}\n\n**Assigned Tasks:**\n${itemsList}`,
      actions: [{ label: 'View All Tasks', path: '/tasks' }]
    };
  }

  // 3. Projects
  if (intent === 'projects') {
    if (!erpData.projects || erpData.projects.total === 0) {
      return {
        message: `### 📁 Projects\n\nYou are not currently assigned to any active projects, or no projects were found in your department.`,
        actions: [{ label: 'Explore Projects', path: '/projects' }]
      };
    }

    const { total, items } = erpData.projects;
    const projectList = items.map((p, i) => `${i + 1}. **${p.name}** — \`${p.status}\` (${p.progress}% completed) | Due: ${p.deadline}`).join('\n');

    return {
      message: `### 📁 Your Projects\n\nYou have **${total}** active project${total === 1 ? '' : 's'}:\n\n${projectList}`,
      actions: [{ label: 'Open Projects', path: '/projects' }]
    };
  }

  // 4. Rewards / Leaderboard
  if (intent === 'rewards') {
    const rewards = erpData.rewards || { myPoints: 0, myRank: 'N/A', completedTasks: 0, topLeaderboard: [] };
    const leaders = (rewards.topLeaderboard || [])
      .map(l => `${l.rank}. **${l.name}** (${l.department}) — **${l.points} pts**`)
      .join('\n');

    return {
      message: `### 🏆 Leaderboard & Rewards\n\n- **Your Total Points:** **${rewards.myPoints}** pts\n- **Current Rank:** **#${rewards.myRank}**\n- **Completed Tasks:** ${rewards.completedTasks}\n\n**Top Performers:**\n${leaders || 'No leaderboard records yet.'}\n\n*Tip: Every completed and approved task awards +1 point to climb the leaderboard!*`,
      actions: [{ label: 'Open Rewards', path: '/rewards' }]
    };
  }

  // 5. Notifications
  if (intent === 'notifications') {
    const notifs = erpData.notifications || { totalUnread: 0, items: [] };
    const notifItems = (notifs.items || []).map((n, i) => `${i + 1}. **${n.title}** (${n.time})\n   ${n.message}`).join('\n');

    return {
      message: `### 🔔 Recent Notifications\n\nYou have **${notifs.totalUnread} unread** notification${notifs.totalUnread === 1 ? '' : 's'}.\n\n${notifItems || 'No recent notifications found.'}`,
      actions: [{ label: 'Open Communication', path: '/communication' }]
    };
  }

  // 6. Announcements
  if (intent === 'announcements') {
    const anns = erpData.announcements || [];
    if (anns.length === 0) {
      return {
        message: `### 📢 Announcements\n\nThere are no active company announcements at this time.`,
        actions: [{ label: 'View Announcements', path: '/communication' }]
      };
    }

    const annList = anns.map(a => `**${a.title}** (${a.date})\n${a.content}`).join('\n\n');
    return {
      message: `### 📢 Recent Announcements\n\n${annList}`,
      actions: [{ label: 'View Announcements', path: '/communication' }]
    };
  }

  // 7. Reports
  if (intent === 'reports') {
    const completedCount = erpData.tasks?.completed || 0;
    const pendingCount = erpData.tasks?.pending || 0;
    const totalCount = erpData.tasks?.total || 0;

    return {
      message: `### 📊 Your Performance & Tasks Report\n\n- **Total Tasks:** ${totalCount}\n- **Completed:** ${completedCount}\n- **Pending:** ${pendingCount}\n- **Department:** ${userContext.department}\n- **Role:** ${userContext.role}\n\nYou can view and download full PDF or Excel task reports from the Reports page.`,
      actions: [{ label: 'Open Reports', path: '/reports' }]
    };
  }

  // 8. ERP Help / FAQs
  if (intent === 'help_erp') {
    if (q.includes('complete a task') || q.includes('how to complete') || q.includes('submit')) {
      return {
        message: `### 💡 How to Complete a Task in Thenam ERP\n\n1. Navigate to **Tasks** or **Projects**.\n2. Open your assigned task details.\n3. Click **Submit for Approval** (or mark as Completed).\n4. Provide optional completion remarks.\n5. Once approved by your manager/admin, you automatically earn **+1 Leaderboard Point**!`,
        actions: [{ label: 'Go to Tasks', path: '/tasks' }]
      };
    }

    return {
      message: `### 🌐 Thenam ERP Connect\n\n**Thenam ERP Connect** is your unified enterprise platform for managing ventures, projects, tasks, teams, finances, communications, rewards, and performance metrics.\n\n**What I can do for you:**\n- 📋 List and filter your assigned tasks\n- 📁 Check project status and milestones\n- 🏆 Show your leaderboard points and rank\n- 🔔 Fetch notifications and company announcements\n- 🧭 Navigate directly to any ERP module`,
      actions: [
        { label: 'View Tasks', path: '/tasks' },
        { label: 'View Projects', path: '/projects' },
        { label: 'Open Rewards', path: '/rewards' }
      ]
    };
  }

  // 9. General Greeting / Fallback
  return {
    message: `Hello ${name}! 👋\n\nI am your **Thenam ERP AI Assistant**. I can help you review your tasks, check active projects, view your leaderboard points, read announcements, and quickly navigate the ERP.\n\nTry asking me:\n- *"What tasks are assigned to me?"*\n- *"How many tasks are pending?"*\n- *"What is my leaderboard rank?"*\n- *"Show my active projects"*`,
    actions: [
      { label: 'My Tasks', path: '/tasks' },
      { label: 'My Projects', path: '/projects' },
      { label: 'My Rewards', path: '/rewards' }
    ]
  };
};

/**
 * Call external AI API (Gemini or OpenAI) with secure context.
 */
const callExternalAiProvider = async ({ provider, apiKey, model, userContext, prompt, history, erpData }) => {
  const sanitizedContext = JSON.stringify({
    user: {
      name: userContext.name,
      role: userContext.role,
      department: userContext.department
    },
    erpData
  }, null, 2);

  const systemInstruction = `You are "Thenam AI", the enterprise intelligent assistant for Thenam ERP Connect.
Current User Context:
- Name: ${userContext.name}
- Role: ${userContext.role}
- Department: ${userContext.department}

ERP Real-Time Data Context:
${sanitizedContext}

STRICT GUIDELINES:
1. ONLY use the provided ERP Real-Time Data Context. Never invent or hallucinate fake tasks, numbers, or records.
2. If data is not present, clearly state that no records were found.
3. Be professional, concise, and helpful. Use headings, bullet points, and status badges where suitable.
4. NEVER reveal confidential credentials, tokens, or unauthorized private employee information (such as salaries).
5. If the user asks to navigate (e.g., "Open tasks"), mention the relevant section clearly.`;

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`;

    const contents = [];
    if (Array.isArray(history)) {
      history.slice(-4).forEach(h => {
        contents.push({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.content }]
        });
      });
    }
    contents.push({
      role: 'user',
      parts: [{ text: `${systemInstruction}\n\nUser Question: ${prompt}` }]
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 600
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidate) throw new Error('Empty response from Gemini');

    return candidate;
  }

  if (provider === 'openai') {
    const url = 'https://api.openai.com/v1/chat/completions';
    const messages = [
      { role: 'system', content: systemInstruction }
    ];

    if (Array.isArray(history)) {
      history.slice(-4).forEach(h => {
        messages.push({
          role: h.role === 'user' ? 'user' : 'assistant',
          content: h.content
        });
      });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages,
        temperature: 0.3,
        max_tokens: 600
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API Error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content;
  }

  throw new Error(`Unsupported AI Provider: ${provider}`);
};

/**
 * Main AI Chat Processor
 */
const processChat = async (user, rawRole, message, history = []) => {
  if (!message || typeof message !== 'string' || !message.trim()) {
    return {
      message: "Please enter a question or query for Thenam AI.",
      actions: []
    };
  }

  const userContext = await getUserContext(user, rawRole);
  const intent = detectIntent(message);

  // Retrieve authorized ERP data
  const erpData = await fetchAuthorizedErpData(userContext, intent, user);

  // Check if AI provider is configured via env
  const apiKey = process.env.AI_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  const rawProvider = (process.env.AI_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : (apiKey ? 'gemini' : 'none'))).toLowerCase();

  let aiText = null;
  let actions = [];

  // Default action shortcuts based on intent
  if (intent === 'tasks') actions.push({ label: 'View Tasks', path: '/tasks' });
  if (intent === 'projects') actions.push({ label: 'Open Projects', path: '/projects' });
  if (intent === 'rewards') actions.push({ label: 'Open Rewards', path: '/rewards' });
  if (intent === 'notifications' || intent === 'announcements') actions.push({ label: 'View Communication', path: '/communication' });
  if (intent === 'reports') actions.push({ label: 'Open Reports', path: '/reports' });

  if (apiKey && (rawProvider === 'gemini' || rawProvider === 'openai')) {
    try {
      aiText = await callExternalAiProvider({
        provider: rawProvider,
        apiKey,
        model: process.env.AI_MODEL,
        userContext,
        prompt: message,
        history,
        erpData
      });
    } catch (err) {
      console.warn('External AI Provider failed, falling back to deterministic ERP engine:', err.message);
    }
  }

  if (!aiText) {
    const deterministic = generateDeterministicResponse(userContext, intent, message, erpData);
    aiText = deterministic.message;
    if (deterministic.actions && deterministic.actions.length > 0) {
      actions = deterministic.actions;
    }
  }

  return {
    message: aiText,
    actions
  };
};

module.exports = {
  getUserContext,
  detectIntent,
  processChat
};
