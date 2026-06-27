'use strict';

/**
 * DB-backed admin auth for scanner management routes (replaces JWT-only check in scan.js).
 */
async function requireScannerAdminAuth(req, res) {
  const { verifyAdminSession } = await import('./admin-authorization.mjs');
  const { hasEffectivePermission } = await import('../../shared/admin/permissions.mjs');

  const result = await verifyAdminSession(req, { res });
  if (!result.valid) {
    return {
      err: {
        statusCode: result.statusCode || 401,
        body: {
          error: result.error || 'Not authenticated',
          reason: result.reason,
          valid: false,
        },
      },
    };
  }

  if (!hasEffectivePermission(result.permissions, 'scanners:manage')) {
    return {
      err: {
        statusCode: 403,
        body: { error: 'Forbidden', valid: false },
      },
    };
  }

  return {
    admin: result.admin,
    permissions: result.permissions,
  };
}

module.exports = {
  requireScannerAdminAuth,
};
