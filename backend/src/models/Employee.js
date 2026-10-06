const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      trim: true
    },
    designation: {
      type: String,
      trim: true,
      default: 'Team Member'
    },
    department: {
      type: String,
      required: true,
      trim: true
    },
    role: {
      type: String,
      required: true,
      enum: ['founder', 'admin', 'developer', 'designer', 'analyst', 'finance', 'Founder', 'Admin', 'Developer', 'Designer', 'Analyst', 'Finance'],
      trim: true
    },
    salary: {
      type: Number,
      default: 0
    },
    joiningDate: {
      type: Date,
      default: Date.now
    },
    reportingManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'On leave', 'Terminated'],
      default: 'Active'
    },
    venture: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Venture',
      required: true
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null
    },
    avatar: {
      type: String,
      default: null
    },
    firebaseUid: {
      type: String,
      unique: true,
      sparse: true,
      default: null
    },
    firebaseAuth: {
      type: Boolean,
      default: true
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: { type: String, trim: true }
    },
    documents: [
      {
        name: { type: String },
        url: { type: String },
        uploadedAt: { type: Date, default: Date.now }
      }
    ],
    projects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project'
      }
    ],
    performance: {
      tasksCompleted: { type: Number, default: 0 },
      tasksPending: { type: Number, default: 0 },
      attendancePct: { type: Number, default: 100 },
      projectCount: { type: Number, default: 0 },
      rating: { type: Number, default: 0, min: 0, max: 100 }
    },
    rewardPoints: {
      type: Number,
      default: 0
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual aliases
employeeSchema.virtual('ventureId').get(function () {
  return this.venture;
});

employeeSchema.virtual('teamId').get(function () {
  return this.team;
});

employeeSchema.virtual('photo').get(function () {
  return this.avatar;
});

// Virtual: task count
employeeSchema.virtual('taskCount', {
  ref: 'Task',
  localField: '_id',
  foreignField: 'assignedTo',
  count: true
});

// Indexes
employeeSchema.index({ venture: 1, team: 1 });
employeeSchema.index({ venture: 1, department: 1 });
employeeSchema.index({ status: 1, venture: 1 });

module.exports = mongoose.model('Employee', employeeSchema);

