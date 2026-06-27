'use strict';

const jwt = require('jsonwebtoken');

function getJwtSecret() {
  return process.env.JWT_SECRET || 'fallback-secret-dev-only';
}

function parseScannerToken(req) {
  const cookies = req.headers?.cookie || '';
  const match = cookies.match(/scannerToken=([^;]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1].trim());
  } catch {
    return match[1].trim();
  }
}

function verifyScannerJwt(token) {
  const secret = getJwtSecret();
  return jwt.verify(token, secret);
}

function normalizeScannerRole(role) {
  return role === 'supervisor' ? 'supervisor' : 'scanner';
}

/**
 * JWT-only scanner auth (legacy — prefer requireScannerAuthWithDb).
 */
function requireScannerAuthJwt(req) {
  const token = parseScannerToken(req);
  if (!token) {
    return { err: { statusCode: 401, body: { error: 'Not authenticated', reason: 'No token' } } };
  }
  try {
    const d = verifyScannerJwt(token);
    if (d?.type !== 'scanner' || !d?.scannerId) {
      return { err: { statusCode: 401, body: { error: 'Invalid scanner token' } } };
    }
    return {
      scanner: {
        scannerId: d.scannerId,
        email: d.email,
        role: normalizeScannerRole(d.scannerRole),
      },
    };
  } catch {
    return { err: { statusCode: 401, body: { error: 'Invalid or expired scanner token' } } };
  }
}

/**
 * JWT + live DB revalidation. Role comes from DB, not stale JWT.
 * @param {object} req
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {{ clearCookie?: (res: object) => void, res?: object }} [opts]
 */
async function requireScannerAuthWithDb(req, db, opts = {}) {
  const jwtAuth = requireScannerAuthJwt(req);
  if (jwtAuth.err) return jwtAuth;

  const { data: sc, error } = await db
    .from('scanners')
    .select('id, name, email, role, is_active')
    .eq('id', jwtAuth.scanner.scannerId)
    .maybeSingle();

  if (error || !sc || !sc.is_active) {
    if (opts.res && typeof opts.clearCookie === 'function') {
      opts.clearCookie(opts.res);
    }
    return {
      err: {
        statusCode: 401,
        body: { error: 'Invalid or inactive scanner', reason: 'Scanner deactivated or not found' },
      },
    };
  }

  if (sc.id !== jwtAuth.scanner.scannerId) {
    return { err: { statusCode: 401, body: { error: 'Invalid scanner token' } } };
  }

  return {
    scanner: {
      scannerId: sc.id,
      email: sc.email,
      name: sc.name,
      role: normalizeScannerRole(sc.role),
    },
  };
}

function requireSupervisorFromAuth(auth) {
  if (!auth.scanner || auth.scanner.role !== 'supervisor') {
    return { err: { statusCode: 403, body: { error: 'Forbidden', reason: 'Supervisor role required' } } };
  }
  return {};
}

module.exports = {
  parseScannerToken,
  verifyScannerJwt,
  requireScannerAuthJwt,
  requireScannerAuthWithDb,
  requireSupervisorFromAuth,
  normalizeScannerRole,
  getJwtSecret,
};
