const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    // Legacy 'message' alias
    message: {
      type: String,
      trim: true
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdByName: {
      type: String,
      trim: true
    },
    pinned: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    // Automatically set to createdAt + 3 days
    expiresAt: {
      type: Date,
      index: true
    },
    // 'all' | 'users' | 'roles' | 'department'
    targetType: {
      type: String,
      enum: ['all', 'users', 'roles', 'department'],
      default: 'all'
    },
    targetAudience: {
      type: String,
      default: 'Everyone' // 'Everyone' | 'Department' | 'Selected Employees'
    },
    priority: {
      type: String,
      enum: ['Normal', 'Important', 'Urgent', 'Low', 'Medium', 'High'],
      default: 'Normal'
    },
    department: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      default: 'Published'
    },
    attachments: [
      {
        name: String,
        url: String,
        type: { type: String },
        size: Number
      }
    ],
    // When targetType = 'users', list of user IDs
    targetUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    // When targetType = 'roles', list of role strings
    targetRoles: [{ type: String }]
  },
  {
    timestamps: true
  }
);

// Pre-save: sync message <-> content aliases and auto-set expiresAt
announcementSchema.pre('save', function (next) {
  if (this.content && !this.message) this.message = this.content;
  else if (this.message && !this.content) this.content = this.message;

  if (!this.expiresAt) {
    const d = new Date(this.createdAt || Date.now());
    d.setDate(d.getDate() + 3);
    this.expiresAt = d;
  }
  next();
});

announcementSchema.index({ createdAt: -1 });
announcementSchema.index({ expiresAt: 1, isActive: 1 });

module.exports = mongoose.model('Announcement', announcementSchema);
