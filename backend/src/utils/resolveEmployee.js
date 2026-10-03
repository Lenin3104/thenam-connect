const Employee = require('../models/Employee');
const User = require('../models/User');

/**
 * Resolves the corresponding Employee record for an authenticated req.user
 * Handles user being an Employee, or a User referencing an Employee via email, _id, or firebaseUid.
 */
const resolveEmployee = async (user) => {
  if (!user) return null;

  // 1. If user already has employeeId, it is already an Employee document
  if (user.employeeId && user.department) {
    return user;
  }

  const userId = user._id || user.id;

  // 2. Try finding Employee by ID directly
  if (userId) {
    const empById = await Employee.findById(userId);
    if (empById) return empById;
  }

  // 3. Try finding by email (case-insensitive)
  if (user.email) {
    const empByEmail = await Employee.findOne({
      email: new RegExp(`^${user.email.trim()}$`, 'i')
    });
    if (empByEmail) return empByEmail;
  }

  // 4. Try finding by firebaseUid
  if (user.firebaseUid) {
    const empByFirebase = await Employee.findOne({ firebaseUid: user.firebaseUid });
    if (empByFirebase) return empByFirebase;
  }

  // 5. Try finding by matching user field if present
  if (userId) {
    const empByUserId = await Employee.findOne({ user: userId });
    if (empByUserId) return empByUserId;
  }

  return null;
};

module.exports = {
  resolveEmployee
};
