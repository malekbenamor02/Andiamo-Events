/**
 * Shared admin JWT + DB verification (used by misc.js and presale-route-admin-codes).
 * Delegates to centralized verifyAdminSession.
 */
import { verifyAdminSession, hasEffectivePermission } from './admin-authorization.mjs';

export async function verifyAdminAuth(req) {
  const result = await verifyAdminSession(req);
  if (!result.valid) {
    return {
      valid: false,
      error: result.error,
      reason: result.reason,
      details: result.details,
      statusCode: result.statusCode || 401,
    };
  }
  return {
    valid: true,
    admin: result.admin,
    permissions: result.permissions,
    allowedTabs: result.allowedTabs,
    mobileTabs: result.mobileTabs,
    sessionExpiresAt: result.sessionExpiresAt,
    sessionTimeRemaining: result.sessionTimeRemaining,
    requiresPasswordChange: result.requiresPasswordChange,
  };
}

export { hasPermission, hasEffectivePermission } from './admin-authorization.mjs';

/**
 * Returns a 403 payload when auth lacks effective permission, else null.
 * @param {{ permissions?: string[] }} auth — result from verifyAdminAuth when valid
 * @param {string} permissionKey
 */
export function effectivePermissionDenied(auth, permissionKey) {
  if (!hasEffectivePermission(auth?.permissions || [], permissionKey)) {
    return {
      statusCode: 403,
      error: 'Forbidden',
      details: `Permission required: ${permissionKey}`,
      valid: false,
    };
  }
  return null;
}
