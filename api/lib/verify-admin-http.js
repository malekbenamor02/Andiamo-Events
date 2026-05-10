/**
 * GET /api/verify-admin — served via api/misc.js on Vercel (serverless count).
 */
import { applyClearAdminTokenCookie } from './clear-admin-token-cookie.js';
import { agentDebugLog } from './agent-debug-log.js';

let corsUtils = null;
async function getCorsUtils() {
  if (!corsUtils) {
    corsUtils = await import('../../lib/cors.js');
  }
  return corsUtils;
}

async function verifyAdminAuth(req) {
  try {
    const cookies = req.headers.cookie || '';
    const cookieMatch = cookies.match(/adminToken=([^;]+)/);
    const token = cookieMatch ? cookieMatch[1] : null;

    if (!token) {
      return {
        valid: false,
        error: 'No authentication token provided',
        statusCode: 401
      };
    }

    const jwt = await import('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-dev-only';

    const isProduction = process.env.NODE_ENV === 'production' ||
                         process.env.VERCEL === '1' ||
                         !!process.env.VERCEL_URL;

    if (!jwtSecret || jwtSecret === 'fallback-secret-dev-only') {
      if (isProduction) {
        return {
          valid: false,
          error: 'Server configuration error: JWT_SECRET not set',
          statusCode: 500
        };
      }
    }

    let decoded;
    try {
      decoded = jwt.default.verify(token, jwtSecret);
    } catch (jwtError) {
      return {
        valid: false,
        error: 'Invalid or expired token',
        reason: jwtError.name === 'TokenExpiredError'
          ? 'Token expired - session ended'
          : jwtError.message,
        statusCode: 401
      };
    }

    if (!decoded.id || !decoded.email || !decoded.role) {
      return {
        valid: false,
        error: 'Invalid token payload',
        statusCode: 401
      };
    }

    if (decoded.role !== 'admin' && decoded.role !== 'super_admin') {
      return {
        valid: false,
        error: 'Invalid admin role',
        statusCode: 403
      };
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return {
        valid: false,
        error: 'Supabase not configured',
        statusCode: 500
      };
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const { data: admin, error: dbError } = await supabase
      .from('admins')
      .select('id, email, name, role, is_active')
      .eq('id', decoded.id)
      .eq('email', decoded.email)
      .eq('is_active', true)
      .single();

    if (dbError || !admin) {
      return {
        valid: false,
        error: 'Admin not found or inactive',
        statusCode: 401
      };
    }

    if (admin.role !== decoded.role) {
      return {
        valid: false,
        error: 'Admin role mismatch',
        statusCode: 401
      };
    }

    const tokenExpiration = decoded.exp ? decoded.exp * 1000 : null;
    const timeRemaining = tokenExpiration
      ? Math.max(0, Math.floor((tokenExpiration - Date.now()) / 1000))
      : 0;

    return {
      valid: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role
      },
      sessionExpiresAt: tokenExpiration,
      sessionTimeRemaining: timeRemaining
    };

  } catch (error) {
    console.error('Auth middleware error:', error);
    return {
      valid: false,
      error: 'Authentication error',
      details: error.message,
      statusCode: 500
    };
  }
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

    const authResult = await verifyAdminAuth(req);

    // #region agent log
    agentDebugLog({
      runId: 'pre-fix',
      hypothesisId: 'H1-H2',
      location: 'verify-admin-http.js:after-auth',
      message: 'verify-admin auth result',
      data: {
        valid: !!authResult.valid,
        statusCode: authResult.statusCode ?? null,
        errSlug: authResult.error ? String(authResult.error).slice(0, 80) : null,
      },
    });
    // #endregion

    if (!authResult.valid) {
      applyClearAdminTokenCookie(res);
      return res.status(authResult.statusCode || 401).json({
        valid: false,
        error: authResult.error,
        reason: authResult.reason
      });
    }

    return res.status(200).json({
      valid: true,
      admin: authResult.admin,
      sessionExpiresAt: authResult.sessionExpiresAt,
      sessionTimeRemaining: authResult.sessionTimeRemaining
    });
  } catch (e) {
    // #region agent log
    agentDebugLog({
      runId: 'pre-fix',
      hypothesisId: 'H1',
      location: 'verify-admin-http.js:catch',
      message: 'handleVerifyAdmin threw',
      data: { name: e?.name, msg: e?.message ? String(e.message).slice(0, 200) : 'unknown' },
    });
    // #endregion
    console.error('handleVerifyAdmin:', e);
    if (!res.headersSent) {
      return res.status(500).json({
        valid: false,
        error: 'verify_admin_failed',
        details: e && e.message ? String(e.message) : 'unknown error'
      });
    }
  }
}
