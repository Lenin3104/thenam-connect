const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      trim: true
    },
    type: {
      type: String,
      enum: [
        'task_assigned',
        'task_completed',
        'task_approval_request',  // Employee submitted for approval
        'task_approved',          // Admin approved the task
        'task_denied',            // Admin denied the task
        'announcement',           // New announcement
        'project_created',
        'money_added',
        'expense_added',
        'employee_joined',
        'reward_given',
        'transfer_completed',
        'revert_request',
        'revert_processed',
        'employee_report_email',
        'general'
      ],
      default: 'general',
      index: true
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    },
    entityType: {
      type: String,
      enum: ['Task', 'Project', 'Transaction', 'Employee', 'Venture', 'Reward', 'Announcement', 'ReportEmail', null],
      default: null
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    // Related item ID (same as entityId, kept for extensibility)
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    relatedType: {
      type: String,
      default: null
    },
    // Front-end navigation target
    actionUrl: {
      type: String,
      default: null
    },
    icon: {
      type: String,
      default: null
    },
    // Extra payload (denial reason, approval notes, etc.)
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    // Optional expiry (for announcement notifications)
    expiresAt: {
      type: Date,
      default: null,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes
notificationSchema.index({ user: 1, isRead: 1 });
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, type: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
