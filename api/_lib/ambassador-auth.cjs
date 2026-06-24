'use strict';

const crypto = require('crypto');

const DEFAULT_IDLE_DAYS = 90;
const DEFAULT_ABSOLUTE_DAYS = 180;
const DEFAULT_ROTATE_DAYS = 7;
const DEFAULT_COOKIE_NAME = '__Host-andiamo_ambassador_session';
const DEV_HTTP_COOKIE_NAME = 'andiamo_ambassador_session';
const TOKEN_BYTES = 32;

const SAFE_AMBASSADOR_FIELDS = [
  'id',
  'full_name',
  'phone',
  'email',
  'status',
  'city',
  'commission_rate',
  'created_at',
  'updated_at',
];

function parsePositiveInt(value, fallback) {
  const n = parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getIdleDays() {
  return parsePositiveInt(process.env.AMBASSADOR_SESSION_IDLE_DAYS, DEFAULT_IDLE_DAYS);
}

function getAbsoluteDays() {
  return parsePositiveInt(process.env.AMBASSADOR_SESSION_ABSOLUTE_DAYS, DEFAULT_ABSOLUTE_DAYS);
}

function getRotateDays() {
  return parsePositiveInt(process.env.AMBASSADOR_SESSION_ROTATE_DAYS, DEFAULT_ROTATE_DAYS);
}

function daysToMs(days) {
  return days * 24 * 60 * 60 * 1000;
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function isRequestSecure(req) {
  if (req.secure) return true;
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return proto.includes('https');
}

function allowDefaultDevPepper() {
  if (process.env.VERCEL === '1') return false;
  const v = process.env.AMBASSADOR_ALLOW_DEFAULT_DEV_PEPPER;
  return v === '1' || v === 'true' || String(v).toLowerCase() === 'yes';
}

function getSessionPepper() {
  const explicit =
    process.env.AMBASSADOR_SESSION_PEPPER?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    process.env.TOKEN_PEPPER?.trim();
  if (explicit) return explicit;
  if (process.env.VERCEL === '1') {
    throw new Error('AMBASSADOR_SESSION_PEPPER is required on Vercel');
  }
  if (isProduction() && !allowDefaultDevPepper()) {
    throw new Error('AMBASSADOR_SESSION_PEPPER is required in production');
  }
  return 'dev-only-ambassador-session-pepper-change-me';
}

function getConfiguredCookieName() {
  return (process.env.AMBASSADOR_COOKIE_NAME || DEFAULT_COOKIE_NAME).trim();
}

function resolveCookieName(req) {
  const configured = getConfiguredCookieName();
  const isHostPrefix = configured.startsWith('__Host-');
  if (isHostPrefix && !isRequestSecure(req)) {
    return DEV_HTTP_COOKIE_NAME;
  }
  return configured;
}

function getClientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  if (xff) return xff.slice(0, 128);
  const xr = req.headers['x-real-ip'];
  if (xr) return String(Array.isArray(xr) ? xr[0] : xr).trim().slice(0, 128);
  const ra = req.socket?.remoteAddress || '';
  return String(ra).replace(/^::ffff:/, '').slice(0, 128) || 'unknown';
}

function parseCookie(req, name) {
  const raw = req.headers.cookie || '';
  const parts = raw.split(';');
  for (const p of parts) {
    const idx = p.indexOf('=');
    if (idx === -1) continue;
    const k = p.slice(0, idx).trim();
    if (k === name) {
      try {
        return decodeURIComponent(p.slice(idx + 1).trim());
      } catch {
        return p.slice(idx + 1).trim();
      }
    }
  }
  return null;
}

function parseAmbassadorCookie(req) {
  const configured = getConfiguredCookieName();
  const devName = DEV_HTTP_COOKIE_NAME;
  return parseCookie(req, configured) || (configured !== devName ? parseCookie(req, devName) : null);
}

function hashAmbassadorSessionToken(rawToken) {
  const pepper = getSessionPepper();
  return crypto.createHmac('sha256', pepper).update(String(rawToken)).digest('hex');
}

function generateSessionToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('base64url');
}

function buildSessionCookie(rawToken, maxAgeSec, req) {
  const name = resolveCookieName(req);
  const parts = [
    `${name}=${encodeURIComponent(rawToken)}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSec))}`,
    'SameSite=Lax',
  ];
  if (isProduction() || isRequestSecure(req)) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function clearAmbassadorCookie(req) {
  const configured = getConfiguredCookieName();
  const devName = DEV_HTTP_COOKIE_NAME;
  const names = configured === devName ? [configured] : [configured, devName];
  return names.map(
    (name) => `${name}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
  );
}

function appendSetCookie(res, cookieValue) {
  if (!cookieValue) return;
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', cookieValue);
    return;
  }
  const list = Array.isArray(existing) ? existing.slice() : [existing];
  list.push(cookieValue);
  res.setHeader('Set-Cookie', list);
}

function clearAmbassadorAuth(res, req) {
  for (const c of clearAmbassadorCookie(req)) {
    appendSetCookie(res, c);
  }
}

function pickSafeAmbassador(ambassador) {
  if (!ambassador) return null;
  const safe = {};
  for (const key of SAFE_AMBASSADOR_FIELDS) {
    if (ambassador[key] !== undefined) safe[key] = ambassador[key];
  }
  return safe;
}

function shouldRotateSession(session, now = new Date()) {
  if (!session.rotated_at) return true;
  const rotatedAt = new Date(session.rotated_at);
  const thresholdMs = daysToMs(getRotateDays());
  return now.getTime() - rotatedAt.getTime() >= thresholdMs;
}

function computeRollingExpiresAt(session, now = new Date()) {
  const absolute = new Date(session.absolute_expires_at);
  const idleExpires = new Date(now.getTime() + daysToMs(getIdleDays()));
  return idleExpires.getTime() < absolute.getTime() ? idleExpires : absolute;
}

function cookieMaxAgeSeconds(expiresAt, now = new Date()) {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  return Math.max(0, Math.floor(ms / 1000));
}

function isSessionExpired(session, now = new Date()) {
  const t = now.getTime();
  return (
    !!session.revoked_at ||
    new Date(session.expires_at).getTime() <= t ||
    new Date(session.absolute_expires_at).getTime() <= t
  );
}

async function createAmbassadorSession(db, ambassadorId, req) {
  const now = new Date();
  const rawToken = generateSessionToken();
  const tokenHash = hashAmbassadorSessionToken(rawToken);
  const idleMs = daysToMs(getIdleDays());
  const absoluteMs = daysToMs(getAbsoluteDays());
  const expiresAt = new Date(now.getTime() + idleMs);
  const absoluteExpiresAt = new Date(now.getTime() + absoluteMs);
  const ip = getClientIp(req);
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 512) || null;

  const { data, error } = await db
    .from('ambassador_sessions')
    .insert({
      ambassador_id: ambassadorId,
      token_hash: tokenHash,
      created_at: now.toISOString(),
      last_seen_at: now.toISOString(),
      updated_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      absolute_expires_at: absoluteExpiresAt.toISOString(),
      rotated_at: now.toISOString(),
      user_agent: userAgent,
      ip_address: ip,
      created_by_ip: ip,
    })
    .select('id')
    .single();

  if (error) throw error;

  return {
    rawToken,
    sessionId: data.id,
    expiresAt,
    cookieHeader: buildSessionCookie(rawToken, cookieMaxAgeSeconds(expiresAt, now), req),
  };
}

async function revokeAmbassadorSession(db, sessionId, reason) {
  const now = new Date().toISOString();
  const { error } = await db
    .from('ambassador_sessions')
    .update({
      revoked_at: now,
      revoked_reason: reason || 'revoked',
      updated_at: now,
    })
    .eq('id', sessionId)
    .is('revoked_at', null);
  if (error) throw error;
}

async function revokeAllAmbassadorSessions(db, ambassadorId, reason) {
  const now = new Date().toISOString();
  const { error } = await db
    .from('ambassador_sessions')
    .update({
      revoked_at: now,
      revoked_reason: reason || 'revoked_all',
      updated_at: now,
    })
    .eq('ambassador_id', ambassadorId)
    .is('revoked_at', null);
  if (error) throw error;
}

function sendAmbassadorUnauthorized(res, req, message = 'Unauthorized') {
  clearAmbassadorAuth(res, req);
  res.status(401).json({ error: message, valid: false });
  return null;
}

async function loadAmbassadorById(db, ambassadorId) {
  const { data, error } = await db
    .from('ambassadors')
    .select('*')
    .eq('id', ambassadorId)
    .single();
  if (error || !data) return null;
  return data;
}

function ambassadorAccessDeniedReason(ambassador) {
  if (!ambassador) return 'Ambassador not found';
  if (ambassador.status === 'pending') return 'Your application is under review';
  if (ambassador.status === 'rejected') return 'Your application was not approved';
  if (ambassador.status === 'suspended') return 'Your account is suspended';
  if (ambassador.status !== 'approved') return 'Account not active';
  return null;
}

/**
 * Validate ambassador session cookie and optionally roll/rotate.
 * Returns auth context or null after sending 401.
 */
async function requireAmbassadorAuth(req, res, db) {
  const rawToken = parseAmbassadorCookie(req);
  if (!rawToken) {
    return sendAmbassadorUnauthorized(res, req);
  }

  let tokenHash;
  try {
    tokenHash = hashAmbassadorSessionToken(rawToken);
  } catch {
    return sendAmbassadorUnauthorized(res, req);
  }

  const { data: session, error: sessionError } = await db
    .from('ambassador_sessions')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (sessionError || !session) {
    return sendAmbassadorUnauthorized(res, req);
  }

  const now = new Date();
  if (isSessionExpired(session, now)) {
    await revokeAmbassadorSession(db, session.id, 'expired').catch(() => {});
    return sendAmbassadorUnauthorized(res, req, 'Session expired');
  }

  const ambassador = await loadAmbassadorById(db, session.ambassador_id);
  const denied = ambassadorAccessDeniedReason(ambassador);
  if (denied) {
    await revokeAmbassadorSession(db, session.id, denied).catch(() => {});
    return sendAmbassadorUnauthorized(res, req, denied);
  }

  const newExpiresAt = computeRollingExpiresAt(session, now);
  let activeRawToken = rawToken;
  let activeTokenHash = tokenHash;
  let rotatedAt = session.rotated_at || now.toISOString();

  if (shouldRotateSession(session, now)) {
    activeRawToken = generateSessionToken();
    activeTokenHash = hashAmbassadorSessionToken(activeRawToken);
    rotatedAt = now.toISOString();
  }

  const updatePayload = {
    last_seen_at: now.toISOString(),
    updated_at: now.toISOString(),
    expires_at: newExpiresAt.toISOString(),
    token_hash: activeTokenHash,
    rotated_at: rotatedAt,
    ip_address: getClientIp(req),
  };

  const { error: updateError } = await db
    .from('ambassador_sessions')
    .update(updatePayload)
    .eq('id', session.id)
    .eq('token_hash', tokenHash)
    .is('revoked_at', null);

  if (updateError) {
    return sendAmbassadorUnauthorized(res, req);
  }

  appendSetCookie(
    res,
    buildSessionCookie(activeRawToken, cookieMaxAgeSeconds(newExpiresAt, now), req)
  );

  return {
    ambassador,
    sessionId: session.id,
    session: {
      ...session,
      expires_at: newExpiresAt.toISOString(),
      last_seen_at: now.toISOString(),
    },
  };
}

function createAmbassadorDbClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  const { createClient } = require('@supabase/supabase-js');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

module.exports = {
  SAFE_AMBASSADOR_FIELDS,
  DEFAULT_IDLE_DAYS,
  DEFAULT_ABSOLUTE_DAYS,
  DEFAULT_ROTATE_DAYS,
  DEFAULT_COOKIE_NAME,
  DEV_HTTP_COOKIE_NAME,
  getIdleDays,
  getAbsoluteDays,
  getRotateDays,
  getSessionPepper,
  getConfiguredCookieName,
  resolveCookieName,
  parseAmbassadorCookie,
  hashAmbassadorSessionToken,
  generateSessionToken,
  buildSessionCookie,
  clearAmbassadorCookie,
  appendSetCookie,
  clearAmbassadorAuth,
  pickSafeAmbassador,
  shouldRotateSession,
  computeRollingExpiresAt,
  cookieMaxAgeSeconds,
  isSessionExpired,
  createAmbassadorSession,
  revokeAmbassadorSession,
  revokeAllAmbassadorSessions,
  requireAmbassadorAuth,
  createAmbassadorDbClient,
  getClientIp,
};
