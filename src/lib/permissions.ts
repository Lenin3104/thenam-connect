export type Role = 'founder' | 'admin' | 'developer' | 'designer' | 'analyst' | 'finance';

export type Resource =
  | 'dashboard'
  | 'admin_security'
  | 'finance'
  | 'ventures'
  | 'projects'
  | 'tasks'
  | 'teams'
  | 'analyst'
  | 'settings'
  | 'designer'
  | 'workspace_links'
  | 'team'
  | 'company_settings'
  | 'user_management';

export type Action = 'create' | 'read' | 'update' | 'delete' | 'manage';

export function normalizeRole(role?: string | null): Role {
  if (!role) return 'developer';
  const r = role.trim().toLowerCase();
  
  if (r === 'founder' || r === 'ceo' || r === 'super admin' || r === 'superadmin') return 'founder';
  if (r === 'admin' || r === 'administrator' || r === 'manager') return 'admin';
  if (r === 'developer' || r === 'employee' || r === 'hr' || r === 'staff') return 'developer';
  if (r === 'designer') return 'designer';
  if (r === 'analyst' || r === 'business analyst') return 'analyst';
  if (r === 'finance') return 'finance';

  return 'developer';
}

export interface PermissionRule {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
  scope?: 'all' | 'assigned' | 'own' | 'none';
}

const ALL = { create: true, read: true, update: true, delete: true, scope: 'all' as const };
const READ_ONLY = { create: false, read: true, update: false, delete: false, scope: 'all' as const };
const OWN_ONLY = { create: false, read: true, update: true, delete: false, scope: 'own' as const };
const NONE = { create: false, read: false, update: false, delete: false, scope: 'none' as const };

export const ROLE_PERMISSIONS: Record<Role, Record<Resource, PermissionRule>> = {
  founder: {
    dashboard: ALL,
    admin_security: ALL,
    finance: ALL,
    ventures: ALL,
    projects: ALL,
    tasks: ALL,
    teams: ALL,
    designer: ALL,
    workspace_links: ALL,
    analyst: ALL,
    settings: ALL,
    team: ALL,
    company_settings: ALL,
    user_management: ALL,
  },
  admin: {
    dashboard: ALL,
    admin_security: ALL,
    finance: ALL,
    ventures: ALL,
    projects: ALL,
    tasks: ALL,
    teams: ALL,
    designer: ALL,
    workspace_links: ALL,
    analyst: ALL,
    settings: ALL,
    team: ALL,
    company_settings: ALL,
    user_management: ALL,
  },
  developer: {
    dashboard: READ_ONLY,
    admin_security: NONE,
    finance: NONE,
    ventures: NONE,
    projects: READ_ONLY,
    tasks: OWN_ONLY,
    teams: NONE,
    designer: NONE,
    workspace_links: READ_ONLY,
    analyst: NONE,
    settings: NONE,
    team: NONE,
    company_settings: NONE,
    user_management: NONE,
  },
  designer: {
    dashboard: READ_ONLY,
    admin_security: NONE,
    finance: NONE,
    ventures: NONE,
    projects: READ_ONLY,
    tasks: OWN_ONLY,
    teams: READ_ONLY,
    designer: ALL,
    workspace_links: ALL,
    analyst: NONE,
    settings: NONE,
    team: READ_ONLY,
    company_settings: NONE,
    user_management: NONE,
  },
  analyst: {
    dashboard: READ_ONLY,
    admin_security: NONE,
    finance: NONE,
    ventures: READ_ONLY,
    projects: READ_ONLY,
    tasks: OWN_ONLY,
    teams: READ_ONLY,
    designer: NONE,
    workspace_links: ALL,
    analyst: ALL,
    settings: NONE,
    team: READ_ONLY,
    company_settings: NONE,
    user_management: NONE,
  },
  finance: {
    dashboard: READ_ONLY,
    admin_security: NONE,
    finance: ALL,
    ventures: READ_ONLY,
    projects: READ_ONLY,
    tasks: NONE,
    teams: READ_ONLY,
    designer: NONE,
    workspace_links: READ_ONLY,
    analyst: NONE,
    settings: NONE,
    team: READ_ONLY,
    company_settings: NONE,
    user_management: NONE,
  },
};

export function hasPermission(
  roleRaw?: string | null,
  resource?: Resource,
  action: Action = 'read'
): boolean {
  if (!resource) return false;
  const role = normalizeRole(roleRaw);
  const rule = ROLE_PERMISSIONS[role]?.[resource];

  if (!rule) return false;
  if (rule.scope === 'none') return false;

  if (action === 'manage') return rule.create && rule.update && rule.delete;
  return rule[action] ?? false;
}

export function canAccessRoute(roleRaw?: string | null, pathname: string = '/'): boolean {
  const role = normalizeRole(roleRaw);
  const path = pathname.split('?')[0].split('#')[0];

  if (path === '/' || path === '') return true; 
  if (path === '/login') return true;

  if (path.startsWith('/admin-security')) return hasPermission(role, 'admin_security', 'read');
  if (path.startsWith('/finance')) return hasPermission(role, 'finance', 'read');
  if (path.startsWith('/ventures')) return hasPermission(role, 'ventures', 'read');
  if (path.startsWith('/designer')) return hasPermission(role, 'designer', 'read');
  if (path.startsWith('/analyst')) return hasPermission(role, 'analyst', 'read');
  if (path.startsWith('/projects')) return hasPermission(role, 'projects', 'read');
  if (path.startsWith('/tasks')) return hasPermission(role, 'tasks', 'read');
  if (path.startsWith('/teams') || path.startsWith('/team')) return hasPermission(role, 'teams', 'read');
  if (path.startsWith('/settings')) return hasPermission(role, 'settings', 'read');

  return true;
}
