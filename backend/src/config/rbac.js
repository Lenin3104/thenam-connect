/**
 * Role-Based Access Control (RBAC) Backend Configuration
 */

const normalizeRole = (role) => {
  if (!role) return 'developer';
  const r = String(role).trim().toLowerCase();

  if (r === 'founder' || r === 'ceo' || r === 'super admin' || r === 'superadmin') return 'founder';
  if (r === 'admin' || r === 'administrator' || r === 'manager') return 'admin';
  if (r === 'developer' || r === 'employee' || r === 'hr' || r === 'staff') return 'developer';
  if (r === 'designer') return 'designer';
  if (r === 'analyst' || r === 'business analyst') return 'analyst';
  if (r === 'finance') return 'finance';

  const validRoles = ['founder', 'admin', 'developer', 'designer', 'analyst', 'finance'];
  if (validRoles.includes(r)) return r;

  return 'developer';
};

const PERMISSIONS = {
  founder: {
    ventures: ['create', 'read', 'update', 'delete'],
    finance: ['create', 'read', 'update', 'delete'],
    team: ['create', 'read', 'update', 'delete'],
    projects: ['create', 'read', 'update', 'delete'],
    tasks: ['create', 'read', 'update', 'delete'],
    settings: ['create', 'read', 'update', 'delete'],
    user_management: ['create', 'read', 'update', 'delete'],
    reports: ['create', 'read', 'update', 'delete', 'send', 'email', 'send_email'],
    company_settings: ['create', 'read', 'update', 'delete'],
    workspace_links: ['create', 'read', 'update', 'delete', 'share']
  },
  admin: {
    ventures: ['create', 'read', 'update', 'delete'],
    finance: ['create', 'read', 'update', 'delete'],
    team: ['create', 'read', 'update', 'delete'],
    projects: ['create', 'read', 'update', 'delete'],
    tasks: ['create', 'read', 'update', 'delete'],
    settings: ['read', 'update'],
    user_management: ['create', 'read', 'update', 'delete'],
    reports: ['create', 'read', 'update', 'delete', 'send', 'email', 'send_email'],
    company_settings: ['read', 'update'],
    workspace_links: ['create', 'read', 'update', 'delete', 'share']
  },
  developer: {
    ventures: ['read'],
    finance: [],
    team: ['read', 'update'],
    projects: ['read', 'update'],
    tasks: ['read', 'update'],
    settings: ['read', 'update'],
    user_management: [],
    reports: ['read'],
    company_settings: [],
    workspace_links: ['read', 'share'] // Can read general workspace links
  },
  designer: {
    ventures: ['read'],
    finance: [],
    team: ['read', 'update'],
    projects: ['read', 'update'],
    tasks: ['read', 'update'],
    settings: ['read', 'update'],
    user_management: [],
    reports: ['read'],
    company_settings: [],
    workspace_links: ['create', 'read', 'update', 'share']
  },
  analyst: {
    ventures: ['read'],
    finance: [],
    team: ['read', 'update'],
    projects: ['read', 'update'],
    tasks: ['read', 'update'],
    settings: ['read', 'update'],
    user_management: [],
    reports: ['read', 'create'],
    company_settings: [],
    workspace_links: ['create', 'read', 'update', 'share']
  },
  finance: {
    ventures: ['read'],
    finance: ['create', 'read', 'update', 'delete'],
    team: ['read'],
    projects: ['read'],
    tasks: [],
    settings: [],
    user_management: [],
    reports: ['create', 'read', 'update'],
    company_settings: [],
    workspace_links: ['read', 'share']
  },
  restricted: {}
};

const checkPermission = (roleRaw, resource, action = 'read') => {
  const role = normalizeRole(roleRaw);
  const resourcePermissions = PERMISSIONS[role]?.[resource] || [];
  return resourcePermissions.includes(action);
};

module.exports = {
  normalizeRole,
  PERMISSIONS,
  checkPermission
};
