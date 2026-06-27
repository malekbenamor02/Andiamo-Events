/**
 * Shared admin JWT + DB verification (used by misc.js and presale-route-admin-codes).
 * Delegates to centralized verifyAdminSession.
 */
import { verifyAdminSession } from './admin-authorization.mjs';

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

export { hasPermission } from './admin-authorization.mjs';
