const Announcement = require('../models/Announcement');
const User = require('../models/User');
const Employee = require('../models/Employee');
const asyncHandler = require('../utils/asyncHandler');
const { success, created } = require('../utils/apiResponse');
const { normalizeRole } = require('../config/rbac');
const { emitToAll, emitToUser } = require('../services/socketService');
const { createNotification } = require('../services/notificationService');

const ALLOWED_ANNOUNCEMENT_ROLES = ['admin', 'founder', 'manager', 'super admin', 'hr'];

/**
 * Build query that returns only active, non-expired announcements.
 */
const activeAnnouncementFilter = () => ({
  isActive: true,
  expiresAt: { $gt: new Date() }
});

// @desc  Get all active (non-expired) announcements
// @route GET /api/announcements
// @access Private
const getAnnouncements = asyncHandler(async (req, res) => {
  const userRole = normalizeRole(req.user?.role || '').toLowerCase();
  const userId = req.user._id || req.user.id;
  const isManagement = ALLOWED_ANNOUNCEMENT_ROLES.includes(userRole);

  let filter = {};

  if (!isManagement) {
    const baseFilter = activeAnnouncementFilter();
    
    // Find employee record to check department
    const emp = await Employee.findOne({ email: (req.user?.email || '').toLowerCase() });
    const userDept = emp?.department || req.user?.department;

    const audienceConditions = [
      { targetAudience: 'Everyone' },
      { targetType: 'all' },
      { targetUsers: userId }
    ];

    if (userDept) {
      audienceConditions.push({
        $and: [
          { $or: [{ targetAudience: 'Department' }, { targetType: 'department' }] },
          { department: new RegExp(`^${userDept.trim()}$`, 'i') }
        ]
      });
    }

    filter = {
      $and: [
        baseFilter,
        { $or: audienceConditions }
      ]
    };
  }

  const announcements = await Announcement.find(filter)
    .populate('author', 'name email avatar role')
    .sort({ pinned: -1, createdAt: -1 })
    .lean();

  return success(res, announcements, 'Announcements retrieved successfully');
});

// @desc  Get only active/non-expired announcements (used by popup)
// @route GET /api/announcements/active
// @access Private
const getActiveAnnouncements = asyncHandler(async (req, res) => {
  const userRole = normalizeRole(req.user?.role || '').toLowerCase();
  const userId = req.user._id || req.user.id;
  const isManagement = ALLOWED_ANNOUNCEMENT_ROLES.includes(userRole);

  let filter = activeAnnouncementFilter();

  if (!isManagement) {
    const emp = await Employee.findOne({ email: (req.user?.email || '').toLowerCase() });
    const userDept = emp?.department || req.user?.department;

    const audienceConditions = [
      { targetAudience: 'Everyone' },
      { targetType: 'all' },
      { targetUsers: userId }
    ];

    if (userDept) {
      audienceConditions.push({
        $and: [
          { $or: [{ targetAudience: 'Department' }, { targetType: 'department' }] },
          { department: new RegExp(`^${userDept.trim()}$`, 'i') }
        ]
      });
    }

    filter = {
      $and: [
        filter,
        { $or: audienceConditions }
      ]
    };
  }

  const announcements = await Announcement.find(filter)
    .populate('author', 'name email avatar role')
    .sort({ pinned: -1, createdAt: -1 })
    .lean();

  return success(res, announcements, 'Active announcements retrieved successfully');
});

// @desc  Create announcement and broadcast to permitted users
// @route POST /api/announcements
// @access Private (Admin/Founder/Manager/HR)
const createAnnouncement = asyncHandler(async (req, res) => {
  const effectiveRole = normalizeRole(req.userRole || req.user?.role || '');
  const rawRole = (req.user?.role || '').toLowerCase();
  const isAllowed =
    ['admin', 'founder'].includes(effectiveRole) ||
    ALLOWED_ANNOUNCEMENT_ROLES.includes(rawRole) ||
    ALLOWED_ANNOUNCEMENT_ROLES.includes(effectiveRole);

  if (!isAllowed) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Only Admin, Founder, Manager, and HR can post announcements'
    });
  }

  const {
    title,
    content,
    message,
    pinned,
    priority = 'Normal',
    targetAudience = 'Everyone',
    department = '',
    targetUsers = [],
    targetRoles = [],
    attachments = []
  } = req.body;

  const announcementContent = content || message;

  if (!title || !announcementContent) {
    return res.status(400).json({ success: false, message: 'Announcement title and message are required' });
  }

  let mappedTargetType = 'all';
  if (targetAudience === 'Department' || department) {
    mappedTargetType = 'department';
  } else if (targetAudience === 'Selected Employees' || (targetUsers && targetUsers.length > 0)) {
    mappedTargetType = 'users';
  }

  // Set expiry to 3 days from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 3);

  const announcement = await Announcement.create({
    title: title.trim(),
    content: announcementContent.trim(),
    message: announcementContent.trim(),
    priority,
    targetAudience,
    department: department ? department.trim() : '',
    status: 'Published',
    pinned: Boolean(pinned),
    author: req.user._id || req.user.id,
    createdByName: req.user.name || '',
    isActive: true,
    expiresAt,
    targetType: mappedTargetType,
    targetUsers,
    targetRoles,
    attachments
  });

  try {
    await announcement.populate('author', 'name email avatar role');
  } catch (err) {
    console.warn('[Announcement] Author populate warning:', err.message);
  }

  // ── Realtime broadcast & Notifications ─────────────────────────────────────
  const broadcastPayload = {
    _id: announcement._id,
    id: announcement._id,
    title: announcement.title,
    content: announcement.content,
    message: announcement.content,
    priority: announcement.priority,
    targetAudience: announcement.targetAudience,
    department: announcement.department,
    status: announcement.status,
    pinned: announcement.pinned,
    createdByName: announcement.createdByName,
    author: announcement.author,
    createdAt: announcement.createdAt,
    expiresAt: announcement.expiresAt,
    isActive: announcement.isActive,
    targetType: announcement.targetType,
    attachments: announcement.attachments
  };

  const authorIdStr = String(req.user._id || req.user.id);

  if (mappedTargetType === 'all' || targetAudience === 'Everyone') {
    emitToAll('announcement:new', broadcastPayload);
    console.log(`[Announcement] Broadcasted announcement:new to all: "${announcement.title}"`);

    // Optionally notify all active users
    const allUsers = await User.find({ _id: { $ne: authorIdStr }, status: 'Active' }).select('_id');
    for (const u of allUsers) {
      await createNotification({
        userId: u._id,
        title: `Announcement: ${announcement.title}`,
        message: announcement.content.length > 120 ? announcement.content.slice(0, 117) + '...' : announcement.content,
        type: 'announcement',
        entityType: 'Announcement',
        entityId: announcement._id,
        actionUrl: '/communication',
        icon: 'megaphone'
      });
    }
  } else if (mappedTargetType === 'department') {
    // Find department users
    const deptEmployees = await Employee.find({ department: new RegExp(`^${department.trim()}$`, 'i') });
    const empEmails = deptEmployees.map(e => e.email?.toLowerCase()).filter(Boolean);
    const deptUsers = await User.find({ email: { $in: empEmails } });
    
    // Always include author so author's UI reflects instantly
    const targetUserSet = new Set(deptUsers.map(u => String(u._id)));
    targetUserSet.add(authorIdStr);

    for (const uId of targetUserSet) {
      emitToUser(uId, 'announcement:new', broadcastPayload);
      if (uId !== authorIdStr) {
        await createNotification({
          userId: uId,
          title: `Announcement (${department}): ${announcement.title}`,
          message: announcement.content.length > 120 ? announcement.content.slice(0, 117) + '...' : announcement.content,
          type: 'announcement',
          entityType: 'Announcement',
          entityId: announcement._id,
          actionUrl: '/communication',
          icon: 'megaphone'
        });
      }
    }
  } else if (mappedTargetType === 'users') {
    const targetUserSet = new Set((targetUsers || []).map(id => String(id)));
    targetUserSet.add(authorIdStr);

    for (const uId of targetUserSet) {
      emitToUser(uId, 'announcement:new', broadcastPayload);
      if (uId !== authorIdStr) {
        await createNotification({
          userId: uId,
          title: `Announcement: ${announcement.title}`,
          message: announcement.content.length > 120 ? announcement.content.slice(0, 117) + '...' : announcement.content,
          type: 'announcement',
          entityType: 'Announcement',
          entityId: announcement._id,
          actionUrl: '/communication',
          icon: 'megaphone'
        });
      }
    }
  }

  return created(res, announcement, 'Announcement published successfully');
});

// @desc  Delete announcement (soft-deactivate by default, hard-delete if ?hard=true)
// @route DELETE /api/announcements/:id
// @access Private (Admin/Founder/Manager)
const deleteAnnouncement = asyncHandler(async (req, res) => {
  const effectiveRole = req.userRole || normalizeRole(req.user?.role || '');
  const rawRole = (req.user?.role || '').toLowerCase();
  const isAllowed = ['admin', 'founder'].includes(effectiveRole) || ALLOWED_ANNOUNCEMENT_ROLES.includes(rawRole);

  if (!isAllowed) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Only Admin, Founder, and Manager can delete announcements'
    });
  }

  const hardDelete = req.query.hard === 'true';

  if (hardDelete) {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
  } else {
    // Soft delete: mark inactive
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
  }

  return success(res, null, 'Announcement deleted successfully');
});

module.exports = {
  getAnnouncements,
  getActiveAnnouncements,
  createAnnouncement,
  deleteAnnouncement
};
