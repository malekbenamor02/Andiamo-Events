/**
 * GET /api/verify-admin — served via api/misc.js on Vercel (serverless count).
 */
import { applyClearAdminTokenCookie } from './clear-admin-token-cookie.js';
import { verifyAdminSession } from './admin-authorization.mjs';

let corsUtils = null;
async function getCorsUtils() {
  if (!corsUtils) {
    corsUtils = await import('../../lib/cors.js');
  }
  return corsUtils;
}

export async function handleVerifyAdmin(req, res) {
  try {
    const { setCORSHeaders, handlePreflight } = await getCorsUtils();

    if (handlePreflight(req, res, { methods: 'GET, OPTIONS', headers: 'Content-Type', credentials: true })) {
      return;
    }

    if (!setCORSHeaders(res, req, { methods: 'GET, OPTIONS', headers: 'Content-Type', credentials: true })) {
      if (req.headers.origin) {
        return res.status(403).json({ error: 'CORS policy: Origin not allowed' });
      }
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const authResult = await verifyAdminSession(req, { res });

    if (!authResult.valid) {
      applyClearAdminTokenCookie(res);
      return res.status(authResult.statusCode || 401).json({
        valid: false,
        error: authResult.error,
        reason: authResult.reason,
      });
    }

    return res.status(200).json({
      valid: true,
      admin: authResult.admin,
      permissions: authResult.permissions,
      allowedTabs: authResult.allowedTabs,
      mobileTabs: authResult.mobileTabs,
      sessionExpiresAt: authResult.sessionExpiresAt,
      sessionTimeRemaining: authResult.sessionTimeRemaining,
      requiresPasswordChange: !!authResult.requiresPasswordChange,
    });
  } catch (e) {
    console.error('handleVerifyAdmin:', e);
    if (!res.headersSent) {
      return res.status(500).json({
        valid: false,
        error: 'verify_admin_failed',
        details: e && e.message ? String(e.message) : 'unknown error',
      });
    }
  }
}
