const Notification = require('../models/Notification');

/**
 * Create a new notification for a user.
 */
const createNotification = async ({
  userId,
  title,
  message,
  type = 'general',
  entityType = null,
  entityId = null,
  relatedId = null,
  relatedType = null,
  actionUrl = null,
  icon = null,
  metadata = {},
  expiresAt = null
}) => {
  try {
    const notif = await Notification.create({
      user: userId,
      title,
      message,
      type,
      entityType,
      entityId,
      relatedId: relatedId || entityId,
      relatedType: relatedType || entityType,
      actionUrl,
      icon,
      metadata,
      expiresAt
    });

    try {
      const { emitToUser } = require('./socketService');
      emitToUser(String(userId), 'notification:new', notif);
    } catch (sockErr) {
      // socket emission should not block
    }

    return notif;
  } catch (err) {
    console.error('Notification creation error:', err.message);
    return null;
  }
};

const getUserIds = async (userId) => {
  const ids = [userId];
  try {
    const { resolveEmployee } = require('../utils/resolveEmployee');
    const emp = await resolveEmployee({ _id: userId });
    if (emp && emp._id && String(emp._id) !== String(userId)) {
      ids.push(emp._id);
    }
  } catch (e) {}
  return ids;
};

const getNotifications = async (userId, unreadOnly = false) => {
  const userIds = await getUserIds(userId);
  const filter = { user: { $in: userIds } };
  if (unreadOnly) filter.isRead = false;
  
  // Exclude expired notifications
  filter.$or = [
    { expiresAt: null },
    { expiresAt: { $gt: new Date() } }
  ];
  
  return Notification.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
};

const markAsRead = async (userId, notificationId) => {
  const userIds = await getUserIds(userId);
  return Notification.findOneAndUpdate(
    { _id: notificationId, user: { $in: userIds } },
    { isRead: true },
    { new: true }
  );
};

const markAllAsRead = async (userId) => {
  const userIds = await getUserIds(userId);
  return Notification.updateMany(
    { user: { $in: userIds }, isRead: false },
    { isRead: true }
  );
};

const deleteNotification = async (userId, notificationId) => {
  return Notification.findOneAndDelete({ _id: notificationId, user: userId });
};

module.exports = {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
};
