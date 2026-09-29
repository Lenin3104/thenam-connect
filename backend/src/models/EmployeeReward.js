const mongoose = require('mongoose');

const recentAchievementSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task'
    },
    taskName: {
      type: String,
      required: true,
      trim: true
    },
    completedDate: {
      type: Date,
      default: Date.now
    },
    points: {
      type: Number,
      default: 1
    }
  },
  { _id: true }
);

const employeeRewardSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      unique: true,
      index: true
    },
    employeeName: {
      type: String,
      required: true,
      trim: true
    },
    department: {
      type: String,
      trim: true,
      default: 'General'
    },
    completedTaskCount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalPoints: {
      type: Number,
      default: 0,
      min: 0
    },
    recentAchievements: [recentAchievementSchema]
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Deterministic ranking index: higher points first, then higher completed task count, then earlier update
employeeRewardSchema.index({ totalPoints: -1, completedTaskCount: -1, updatedAt: 1 });

module.exports = mongoose.model('EmployeeReward', employeeRewardSchema);
