'use strict';

/**
 * Admin permissions — CJS entry (used by Express middleware).
 * ESM consumers import ./permissions.mjs which re-exports this module.
 */

const ROLE_PERMISSIONS = {
  super_admin: ['*'],
  admin: [
    'dashboard:view',
    'ambassadors:manage',
    'applications:manage',
    'careers:manage',
    'orders:manage',
    'ambassador_sales:manage',
    'pos:manage',
    'consultation_inquiries:view',
  ],
};

function hasPermission(role, permission) {
  if (!role || !permission) return false;
  if (role === 'super_admin') return true;
  const list = ROLE_PERMISSIONS[role];
  if (!list) return false;
  if (list.includes('*')) return true;
  return list.includes(permission);
}

function hasEffectivePermission(permissions, permissionKey) {
  if (!permissionKey || !Array.isArray(permissions) || !permissions.length) return false;
  if (permissions.includes('*')) return true;
  return permissions.includes(permissionKey);
}

function resolvePermissions(role) {
  if (role === 'super_admin') return ['*'];
  if (role === 'admin') return [...ROLE_PERMISSIONS.admin];
  return [];
}

async function resolveEffectivePermissions(role, _dbClient) {
  return resolvePermissions(role);
}

function resolveAllowedTabs(role, tabDefinitions) {
  if (!role) return [];
  return tabDefinitions
    .filter((tab) => hasPermission(role, tab.requiredPermission))
    .map((tab) => tab.key);
}

function getDefaultTabKey(allowedTabs) {
  if (!allowedTabs.length) return 'overview';
  if (allowedTabs.includes('overview')) return 'overview';
  return allowedTabs[0];
}

module.exports = {
  ADMIN_ROLES: ['admin', 'super_admin'],
  ROLE_PERMISSIONS,
  hasPermission,
  hasEffectivePermission,
  resolvePermissions,
  resolveEffectivePermissions,
  resolveAllowedTabs,
  getDefaultTabKey,
};
