const mongoose = require('mongoose');
const Reward = require('../models/Reward');
const Employee = require('../models/Employee');
const Task = require('../models/Task');
const EmployeeReward = require('../models/EmployeeReward');
const AppError = require('../utils/AppError');
const { logActivity } = require('./activityService');
const { resolveEmployee } = require('../utils/resolveEmployee');

/**
 * Automatically records a reward point when a task is completed.
 * Guarantees idempotency and duplicate point protection:
 * If the task has already been rewarded (rewardPointAwarded === true), 0 points are added.
 * Exactly 1 completed task = 1 leaderboard point.
 */
const recordTaskCompletionReward = async (task, employee, remarks = '') => {
  if (!employee) return { pointsAwarded: 0 };

  // Double check if task already has rewardPointAwarded
  if (task.rewardPointAwarded) {
    return {
      pointsAwarded: 0,
      alreadyAwarded: true,
      message: 'Reward point already awarded for this task'
    };
  }

  // Atomically mark task as rewarded
  const updatedTask = await Task.findOneAndUpdate(
    { _id: task._id, rewardPointAwarded: { $ne: true } },
    {
      $set: {
        rewardPointAwarded: true,
        status: 'Completed',
        progress: 100,
        completedDate: task.completedDate || new Date(),
        completionRemarks: remarks || task.completionRemarks || 'Completed'
      }
    },
    { new: true }
  );

  // If null, it was updated concurrently or already rewarded
  if (!updatedTask) {
    return {
      pointsAwarded: 0,
      alreadyAwarded: true,
      message: 'Reward point was already awarded concurrently'
    };
  }

  // Increment points on Employee model
  await Employee.findByIdAndUpdate(employee._id, {
    $inc: {
      rewardPoints: 1,
      'performance.tasksCompleted': 1
    }
  });

  // Upsert into EmployeeReward model
  const achievement = {
    taskId: task._id,
    taskName: task.title,
    completedDate: updatedTask.completedDate,
    points: 1
  };

  const employeeReward = await EmployeeReward.findOneAndUpdate(
    { employeeId: employee._id },
    {
      $set: {
        employeeName: employee.name,
        department: employee.department || 'General',
        updatedAt: new Date()
      },
      $inc: {
        completedTaskCount: 1,
        totalPoints: 1
      },
      $push: {
        recentAchievements: {
          $each: [achievement],
          $slice: -20
        }
      }
    },
    { upsert: true, new: true }
  );

  // Also create a legacy Reward record for audit logging & legacy widgets
  try {
    await Reward.create({
      employee: employee._id,
      title: `Task Completed: ${task.title}`,
      description: `+1 Leaderboard Point for completing "${task.title}"`,
      points: 1,
      type: 'Achievement',
      date: updatedTask.completedDate,
      createdBy: task.assignedBy || null
    });
  } catch (err) {
    console.error('Non-critical: error creating legacy Reward log:', err.message);
  }

  return {
    pointsAwarded: 1,
    alreadyAwarded: false,
    employeeReward,
    task: updatedTask
  };
};

/**
 * Returns the leaderboard with dynamic ranks calculated from points:
 * 1. Total points (descending)
 * 2. Completed task count (descending)
 * 3. Deterministic tie-breaker
 */
const getLeaderboard = async (options = {}) => {
  const { department, search, limit = 50 } = options;

  // Sync / ensure all active employees with completed tasks are reflected in EmployeeReward
  const employees = await Employee.find({ status: 'Active' })
    .populate('venture', 'name gradient key')
    .lean();

  // Load existing EmployeeReward records
  const existingRewards = await EmployeeReward.find().lean();
  const rewardMap = new Map();
  for (const r of existingRewards) {
    rewardMap.set(String(r.employeeId), r);
  }

  // Count actual completed tasks for each employee to guarantee 100% data consistency
  const taskCounts = await Task.aggregate([
    { $match: { status: 'Completed' } },
    { $group: { _id: '$assignedTo', count: { $sum: 1 } } }
  ]);
  const completedMap = new Map();
  for (const t of taskCounts) {
    if (t._id) completedMap.set(String(t._id), t.count);
  }

  // Build unified leaderboard list
  let leaderboardList = [];

  for (const emp of employees) {
    const empIdStr = String(emp._id);
    const completedCount = completedMap.get(empIdStr) || 0;
    const existingRec = rewardMap.get(empIdStr);

    // Consistency rule: 1 completed task = 1 point
    // Points equal maximum of completed tasks or tracked reward points
    const points = Math.max(completedCount, emp.rewardPoints || 0, existingRec?.totalPoints || 0);

    // If EmployeeReward record is out of sync or missing, update it in background
    if (!existingRec || existingRec.totalPoints !== points || existingRec.completedTaskCount !== completedCount) {
      EmployeeReward.findOneAndUpdate(
        { employeeId: emp._id },
        {
          $set: {
            employeeName: emp.name,
            department: emp.department || 'General',
            completedTaskCount: completedCount,
            totalPoints: points,
            updatedAt: new Date()
          }
        },
        { upsert: true }
      ).catch((err) => console.error('Error syncing EmployeeReward:', err.message));
    }

    // Filter by department if requested
    if (department && department !== 'all') {
      if ((emp.department || '').toLowerCase() !== department.toLowerCase()) {
        continue;
      }
    }

    // Filter by search query if requested
    if (search && search.trim()) {
      const q = search.toLowerCase();
      const matchName = emp.name.toLowerCase().includes(q);
      const matchId = (emp.employeeId || '').toLowerCase().includes(q);
      const matchDept = (emp.department || '').toLowerCase().includes(q);
      if (!matchName && !matchId && !matchDept) {
        continue;
      }
    }

    leaderboardList.push({
      employeeId: emp.employeeId || `EMP-${String(emp._id).slice(-4).toUpperCase()}`,
      _id: emp._id,
      name: emp.name,
      avatar: emp.avatar,
      department: emp.department || 'General',
      role: emp.role || 'Member',
      completedTasks: completedCount,
      totalPoints: points,
      venture: emp.venture,
      recentAchievements: existingRec?.recentAchievements || []
    });
  }

  // Sort deterministically:
  // 1. Points (descending)
  // 2. Completed tasks (descending)
  // 3. Alphabetical / ID tie-breaker
  leaderboardList.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    if (b.completedTasks !== a.completedTasks) {
      return b.completedTasks - a.completedTasks;
    }
    return String(a.name).localeCompare(String(b.name));
  });

  // Assign dynamic sequential ranks (1, 2, 3...)
  const rankedLeaderboard = leaderboardList.map((entry, index) => ({
    ...entry,
    rank: index + 1
  }));

  const parsedLimit = parseInt(limit, 10);
  if (!isNaN(parsedLimit) && parsedLimit > 0) {
    return rankedLeaderboard.slice(0, parsedLimit);
  }

  return rankedLeaderboard;
};

/**
 * Returns rewards data for the currently logged-in user / employee:
 * - Current Rank
 * - Total Completed Tasks
 * - Total Points
 * - Recent Achievements
 */
const getMyRewards = async (user) => {
  const employee = await resolveEmployee(user);
  if (!employee) {
    return {
      employee: {
        name: user.name || 'User',
        employeeId: 'EMP-000',
        department: user.department || 'General',
        avatar: user.avatar
      },
      currentRank: 0,
      completedTasks: 0,
      totalPoints: 0,
      recentAchievements: []
    };
  }

  // Get full leaderboard to calculate dynamic rank
  const fullLeaderboard = await getLeaderboard({ limit: 1000 });
  const myIndex = fullLeaderboard.findIndex(
    (item) => String(item._id) === String(employee._id)
  );

  const rank = myIndex !== -1 ? myIndex + 1 : fullLeaderboard.length + 1;
  const myData = myIndex !== -1 ? fullLeaderboard[myIndex] : null;

  // Retrieve actual recent completed tasks for achievements
  const recentCompletedTasks = await Task.find({
    assignedTo: employee._id,
    status: 'Completed'
  })
    .sort({ completedDate: -1, updatedAt: -1 })
    .limit(10)
    .lean();

  const achievements = recentCompletedTasks.map((t) => ({
    taskId: t._id,
    taskName: t.title,
    completedDate: t.completedDate || t.updatedAt,
    points: 1
  }));

  return {
    employee: {
      _id: employee._id,
      name: employee.name,
      employeeId: employee.employeeId,
      department: employee.department,
      avatar: employee.avatar
    },
    currentRank: rank,
    completedTasks: myData ? myData.completedTasks : 0,
    totalPoints: myData ? myData.totalPoints : 0,
    recentAchievements: achievements
  };
};

const grantReward = async (data, userId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const employee = await Employee.findById(data.employee).session(session);
    if (!employee) throw new AppError('Employee not found', 404);

    const reward = await Reward.create(
      [
        {
          ...data,
          createdBy: userId
        }
      ],
      { session }
    );

    employee.rewardPoints += data.points;
    await employee.save({ session });

    await session.commitTransaction();

    await logActivity({
      userId,
      action: 'Granted Reward',
      entity: 'Reward',
      entityId: reward[0]._id,
      entityName: reward[0].title
    });

    return reward[0];
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const listRewards = async (filter = {}) => {
  return Reward.find(filter)
    .populate({
      path: 'employee',
      select: 'name avatar department',
      populate: { path: 'venture', select: 'name gradient' }
    })
    .populate('createdBy', 'name')
    .sort({ date: -1, createdAt: -1 })
    .lean();
};

module.exports = {
  recordTaskCompletionReward,
  getLeaderboard,
  getMyRewards,
  grantReward,
  listRewards
};
