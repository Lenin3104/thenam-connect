const mongoose = require('mongoose');

const reportEmailSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    senderName: {
      type: String,
      required: true,
      trim: true
    },
    fromEmail: {
      type: String,
      default: 'admin@thenamsoftwaresolutions.com',
      trim: true
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    recipientEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true
    },
    recipientName: {
      type: String,
      required: true,
      trim: true
    },
    recipientEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      default: '',
      trim: true
    },
    emailHtml: {
      type: String,
      default: ''
    },
    emailText: {
      type: String,
      default: ''
    },
    summary: {
      totalTasks: { type: Number, default: 0 },
      completedTasks: { type: Number, default: 0 },
      inProgressTasks: { type: Number, default: 0 },
      pendingTasks: { type: Number, default: 0 },
      overdueTasks: { type: Number, default: 0 },
      totalPoints: { type: Number, default: 0 }
    },
    department: {
      type: String,
      default: 'General'
    },
    hasPdf: {
      type: Boolean,
      default: false
    },
    hasExcel: {
      type: Boolean,
      default: false
    },
    pdfAttachment: {
      filename: { type: String },
      contentType: { type: String, default: 'application/pdf' },
      data: { type: Buffer },
      size: { type: Number, default: 0 }
    },
    excelAttachment: {
      filename: { type: String },
      contentType: {
        type: String,
        default: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      },
      data: { type: Buffer },
      size: { type: Number, default: 0 }
    },
    status: {
      type: String,
      enum: ['SENT', 'FAILED'],
      default: 'SENT',
      index: true
    },
    errorReason: {
      type: String,
      default: null
    },
    sentAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

reportEmailSchema.index({ recipient: 1, createdAt: -1 });
reportEmailSchema.index({ recipientEmployee: 1, createdAt: -1 });

module.exports = mongoose.model('ReportEmail', reportEmailSchema);
