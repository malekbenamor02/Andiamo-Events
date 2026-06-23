'use strict';

const jwt = require('jsonwebtoken');
const { getServiceDb } = require('./academy-db.cjs');

const INFLUENCER_COOKIE = 'influencerToken';
const INFLUENCER_JWT_TTL = '8h';

function getJwtSecret() {
  return process.env.JWT_SECRET || 'fallback-secret-dev-only';
}

function isProductionEnv() {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    !!process.env.VERCEL_URL
  );
}

function influencerTokenCookieSecure(req) {
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) return false;
  return !!(req.secure || String(req.headers['x-forwarded-proto'] || '').includes('https'));
}

function parseInfluencerToken(req) {
  const cookies = req.headers?.cookie || '';
  const match = cookies.match(/influencerToken=([^;]+)/);
  return match ? match[1] : null;
}

function signInfluencerToken({ influencerId, email }) {
  const secret = getJwtSecret();
  if (!secret || (secret === 'fallback-secret-dev-only' && isProductionEnv())) {
    throw new Error('JWT_SECRET not configured');
  }
  return jwt.sign(
    { type: 'academy_influencer', influencerId, email },
    secret,
    { expiresIn: INFLUENCER_JWT_TTL }
  );
}

function verifyInfluencerToken(token) {
  const secret = getJwtSecret();
  return jwt.verify(token, secret);
}

function setInfluencerTokenCookie(req, res, token) {
  res.cookie(INFLUENCER_COOKIE, token, {
    httpOnly: true,
    secure: influencerTokenCookieSecure(req),
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  });
}

function clearInfluencerTokenCookie(req, res) {
  res.clearCookie(INFLUENCER_COOKIE, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: influencerTokenCookieSecure(req),
  });
}

function sanitizeInfluencerRow(row) {
  if (!row) return null;
  const { password_hash, ...safe } = row;
  return safe;
}

async function loadActiveInfluencerById(db, influencerId) {
  const { data, error } = await db
    .from('academy_influencers')
    .select('*')
    .eq('id', influencerId)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.is_active) return null;
  return data;
}

/**
 * JWT + live DB check on every protected influencer route.
 * Never trust influencerId from query/body.
 */
function requireAcademyInfluencerAuth(req, res, next) {
  (async () => {
    try {
      const token = parseInfluencerToken(req);
      if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      let decoded;
      try {
        decoded = verifyInfluencerToken(token);
      } catch {
        clearInfluencerTokenCookie(req, res);
        return res.status(401).json({ error: 'Not authenticated' });
      }

      if (decoded.type !== 'academy_influencer' || !decoded.influencerId || !decoded.email) {
        clearInfluencerTokenCookie(req, res);
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const db = getServiceDb();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }

      const influencer = await loadActiveInfluencerById(db, decoded.influencerId);
      if (!influencer) {
        clearInfluencerTokenCookie(req, res);
        return res.status(401).json({ error: 'Not authenticated' });
      }

      req.influencer = {
        id: influencer.id,
        email: influencer.email,
        profile: sanitizeInfluencerRow(influencer),
        row: influencer,
      };
      next();
    } catch (e) {
      console.error('requireAcademyInfluencerAuth:', e.message || e);
      return res.status(500).json({ error: 'Authentication error' });
    }
  })();
}

module.exports = {
  INFLUENCER_COOKIE,
  parseInfluencerToken,
  signInfluencerToken,
  verifyInfluencerToken,
  setInfluencerTokenCookie,
  clearInfluencerTokenCookie,
  sanitizeInfluencerRow,
  loadActiveInfluencerById,
  requireAcademyInfluencerAuth,
};
