const mongoose = require('mongoose');

const checklistItemSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    done: { type: Boolean, default: false }
  },
  { _id: true }
);

const commentSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    description: {
      type: String,
      trim: true
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
      index: true
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
      index: true
    },
    venture: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Venture',
      default: null,
      index: true
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
      index: true
    },
    deadline: {
      type: Date,
      index: true
    },
    status: {
      type: String,
      enum: [
        'Pending',
        'In Progress',
        'Review',
        'Pending_Approval',   // Employee submitted; waiting for admin approval
        'Completed',
        'Cancelled'
      ],
      default: 'Pending',
      index: true
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    comments: [commentSchema],
    files: [
      {
        name: { type: String },
        url: { type: String },
        uploadedAt: { type: Date, default: Date.now }
      }
    ],
    checklist: [checklistItemSchema],
    reminder: {
      type: Date,
      default: null
    },
    completedDate: {
      type: Date,
      default: null
    },
    tags: [{ type: String, trim: true }],

    // ── Completion Approval Workflow ────────────────────────────────────────
    submittedForApprovalAt: {
      type: Date,
      default: null
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    approvedByName: {
      type: String,
      default: null
    },
    approvedAt: {
      type: Date,
      default: null
    },
    completionApproved: {
      type: Boolean,
      default: false
    },
    completionDenied: {
      type: Boolean,
      default: false
    },
    deniedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    deniedByName: {
      type: String,
      default: null
    },
    deniedAt: {
      type: Date,
      default: null
    },
    denialReason: {
      type: String,
      trim: true,
      default: null
    },

    // ── Reward & Report Fields ───────────────────────────────────────────────
    rewardPointAwarded: {
      type: Boolean,
      default: false,
      index: true
    },
    completionRemarks: {
      type: String,
      trim: true,
      default: ''
    },
    completionDuration: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual aliases to align with prompt naming conventions
taskSchema.virtual('taskName').get(function () {
  return this.title;
});
taskSchema.virtual('dueDate').get(function () {
  return this.deadline;
});
taskSchema.virtual('assignedDate').get(function () {
  return this.createdAt;
});
taskSchema.virtual('employeeId').get(function () {
  return this.assignedTo;
});
taskSchema.virtual('pointsEarned').get(function () {
  return this.rewardPointAwarded || this.status === 'Completed' ? 1 : 0;
});

// Compound indexes
taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ venture: 1, status: 1 });
taskSchema.index({ deadline: 1, status: 1 });
taskSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Task', taskSchema);
