/**
 * HTTP admin auth + effective permission gate for Vercel handlers.
 */
import { verifyAdminAuth, effectivePermissionDenied } from './admin-verify.js';
import { applyClearAdminTokenCookie } from './clear-admin-token-cookie.js';

/**
 * @returns {Promise<object|null>} auth result when allowed; null after response sent
 */
export async function gateAdminPermission(req, res, permissionKey) {
  const authResult = await verifyAdminAuth(req);
  if (!authResult.valid) {
    applyClearAdminTokenCookie(res);
    res.status(authResult.statusCode || 401).json({
      error: authResult.error,
      reason: authResult.reason || 'Authentication failed',
      valid: false,
    });
    return null;
  }
  const denied = effectivePermissionDenied(authResult, permissionKey);
  if (denied) {
    res.status(denied.statusCode).json(denied);
    return null;
  }
  return authResult;
}

/**
 * Cron secret OR admin with effective permission (manual dashboard trigger).
 * @returns {Promise<{ auth: object, via: string }|null>}
 */
export async function authorizeCronOrAdminPermission(req, res, permissionKey) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHdr = req.headers?.authorization || req.headers?.Authorization || '';
    const bearer =
      typeof authHdr === 'string' && authHdr.startsWith('Bearer ') ? authHdr.slice(7).trim() : null;
    const provided =
      req.headers['x-cron-secret'] || bearer || req.query?.secret || req.body?.secret;
    if (provided === cronSecret) {
      return { via: 'cron', auth: null };
    }
  }

  const authResult = await gateAdminPermission(req, res, permissionKey);
  if (!authResult) return null;
  return { via: 'admin', auth: authResult };
}
