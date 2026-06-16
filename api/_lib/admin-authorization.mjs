/**
 * DB-backed admin session verification — single source of truth for admin auth.
 */
import {
  hasPermission,
  resolveEffectivePermissions,
  resolveAllowedTabs,
} from '../../shared/admin/permissions.mjs';
import { ADMIN_TAB_DEFINITIONS } from '../../shared/admin/tabDefinitions.mjs';

function trimEnvValue(v) {
  if (v == null || typeof v !== 'string') return v;
  return v.trim().replace(/^["']|["']$/g, '');
}

function parseAdminToken(req) {
  const cookies = req.headers?.cookie || '';
  const cookieMatch = cookies.match(/adminToken=([^;]+)/);
  return cookieMatch ? cookieMatch[1] : null;
}

function isProductionEnv() {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    !!process.env.VERCEL_URL
  );
}

function getJwtSecret() {
  return process.env.JWT_SECRET || 'fallback-secret-dev-only';
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {{ clearCookie?: (res: import('http').ServerResponse) => void, res?: import('http').ServerResponse }} [opts]
 */
export async function verifyAdminSession(req, opts = {}) {
  try {
    const token = parseAdminToken(req);
    if (!token) {
      return {
        valid: false,
        error: 'No authentication token provided',
        reason: 'No token provided',
        statusCode: 401,
      };
    }

    const jwtSecret = getJwtSecret();
    if (!jwtSecret || jwtSecret === 'fallback-secret-dev-only') {
      if (isProductionEnv()) {
        return {
          valid: false,
          error: 'Server configuration error: JWT_SECRET not set',
          statusCode: 500,
        };
      }
    }

    const jwt = await import('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.default.verify(token, jwtSecret);
    } catch (jwtError) {
      if (opts.res && typeof opts.res.clearCookie === 'function') {
        opts.res.clearCookie('adminToken', { path: '/' });
      }
      return {
        valid: false,
        error: 'Invalid or expired token',
        reason:
          jwtError.name === 'TokenExpiredError'
            ? 'Token expired - session ended'
            : jwtError.message,
        statusCode: 401,
      };
    }

    if (!decoded.id || !decoded.email || !decoded.role) {
      if (opts.res && typeof opts.res.clearCookie === 'function') {
        opts.res.clearCookie('adminToken', { path: '/' });
      }
      return {
        valid: false,
        error: 'Invalid token payload',
        reason: 'Token payload is invalid',
        statusCode: 401,
      };
    }

    if (decoded.role !== 'admin' && decoded.role !== 'super_admin') {
      return {
        valid: false,
        error: 'Invalid admin role',
        statusCode: 403,
      };
    }

    const supabaseUrl = trimEnvValue(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
    const supabaseKey = trimEnvValue(
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY
    );

    if (!supabaseUrl || !supabaseKey) {
      return {
        valid: false,
        error: 'Supabase not configured',
        statusCode: 500,
      };
    }

    const { createClient } = await import('@supabase/supabase-js');
    const dbClient = createClient(supabaseUrl, supabaseKey);

    const { data: admin, error: dbError } = await dbClient
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
        statusCode: 401,
      };
    }

    if (admin.role !== decoded.role) {
      return {
        valid: false,
        error: 'Admin role mismatch',
        statusCode: 401,
      };
    }

    const tokenExpiration = decoded.exp ? decoded.exp * 1000 : null;
    const timeRemaining = tokenExpiration
      ? Math.max(0, Math.floor((tokenExpiration - Date.now()) / 1000))
      : 0;

    const permissions = await resolveEffectivePermissions(admin.role, dbClient);
    const allowedTabs = resolveAllowedTabs(admin.role, ADMIN_TAB_DEFINITIONS);

    return {
      valid: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
      permissions,
      allowedTabs,
      sessionExpiresAt: tokenExpiration,
      sessionTimeRemaining: timeRemaining,
      /** JWT exp for legacy handlers */
      exp: decoded.exp,
    };
  } catch (error) {
    console.error('verifyAdminSession error:', error);
    return {
      valid: false,
      error: 'Authentication error',
      details: error.message,
      statusCode: 500,
    };
  }
}

export { hasPermission, resolveEffectivePermissions, resolveAllowedTabs };
