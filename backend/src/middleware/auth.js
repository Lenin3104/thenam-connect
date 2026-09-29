const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Employee = require('../models/Employee');
const { normalizeRole, checkPermission } = require('../config/rbac');

// Authentication middleware - verifies JWT token
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkeyforthenamerp2026');
      
      let user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        user = await Employee.findById(decoded.id).select('-password');
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Not authorized, user not found'
        });
      }

      req.user = user;
      
      const headerRole = req.headers['x-active-role'];
      const normalizedHeaderRole = headerRole ? normalizeRole(headerRole) : null;
      let primaryRole = (user.roles && user.roles.length > 0) ? user.roles[0] : (user.role || '');
      if (!primaryRole || primaryRole === 'employee' || primaryRole === 'developer') {
        const emp = await Employee.findOne({ email: (user.email || '').toLowerCase() });
        if (emp && emp.role) {
          primaryRole = emp.role;
        }
      }
      if (!primaryRole) primaryRole = user.role || 'developer';
      
      if (normalizedHeaderRole && user.roles && user.roles.map(r => normalizeRole(r)).includes(normalizedHeaderRole)) {
        primaryRole = normalizedHeaderRole;
      }

      req.userRole = normalizeRole(primaryRole);
      
      // Attach the active/resolved role onto req.user so downstream services can access it
      req.user.userRole = req.userRole;

      return next();
    } catch (error) {
      console.error('Auth verification error:', error);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed'
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token provided'
    });
  }
};

const requireAuth = protect;

// Middleware to require specific role(s)
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const normalizedUserRole = req.userRole;
    const normalizedAllowedRoles = roles.map(r => normalizeRole(r));

    if (!normalizedAllowedRoles.includes(normalizedUserRole)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access requires role ${roles.join(' or ')}`
      });
    }

    next();
  };
};

const requireAnyRole = requireRole;
const authorize = requireRole;

// Middleware to check resource access permission
const canAccess = (resource, action = 'read') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const userRole = req.userRole;
    const isAllowed = checkPermission(userRole, resource, action);

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: ${userRole} role cannot ${action} ${resource}`
      });
    }

    next();
  };
};

module.exports = {
  protect,
  requireAuth,
  requireRole,
  requireAnyRole,
  authorize,
  canAccess
};
