const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const healthRoutes = require('./health');
const authRoutes = require('./auth');
const ventureRoutes = require('./ventures');
const financeRoutes = require('./finance');
const employeeRoutes = require('./employees');
const teamRoutes = require('./teams');
const projectRoutes = require('./projects');
const taskRoutes = require('./tasks');
const rewardRoutes = require('./rewards');
const dashboardRoutes = require('./dashboard');
const notificationRoutes = require('./notifications');
const settingsRoutes = require('./settings');
const searchRoutes = require('./search');
const uploadRoutes = require('./upload');
const chatRoutes = require('./chat');
const announcementRoutes = require('./announcements');
const workspaceLinkRoutes = require('./workspaceLinks');
const communicationRoutes = require('./communication');
const reportRoutes = require('./reports');

// Mount sub-routers
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/ventures', ventureRoutes);
router.use('/finance', financeRoutes);
router.use('/employees', employeeRoutes);
router.use('/teams', teamRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/rewards', rewardRoutes);
router.use('/reports', reportRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/notifications', notificationRoutes);
router.use('/settings', settingsRoutes);
router.use('/search', searchRoutes);
router.use('/upload', uploadRoutes);
router.use('/chat', chatRoutes);
router.use('/announcements', announcementRoutes);
router.use('/workspace-links', workspaceLinkRoutes);
router.use('/communication', communicationRoutes);

// Database connection test route
router.get('/db-test', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  if (isConnected) {
    return res.json({
      success: true,
      message: 'MongoDB Connected Successfully'
    });
  } else {
    return res.status(500).json({
      success: false,
      message: 'MongoDB Connection Failed'
    });
  }
});

// API Documentation route
router.get('/docs', (req, res) => {
  return res.json({
    success: true,
    message: 'Thenam ERP API Documentation',
    version: '1.0.0',
    baseUrl: '/api'
  });
});

module.exports = router;
