'use strict';

const crypto = require('crypto');

const MIN_CRON_SECRET_LENGTH = 16;

/**
 * Extract cron secret from request (header / Bearer only — never query string; leaks in logs).
 */
function getCronSecretFromRequest(req) {
  const headerSecret = req.headers['x-cron-secret'];
  if (headerSecret != null && String(headerSecret).trim() !== '') {
    return String(headerSecret).trim();
  }

  const authHdr = req.headers.authorization || req.headers.Authorization || '';
  if (typeof authHdr === 'string' && authHdr.startsWith('Bearer ')) {
    const bearer = authHdr.slice(7).trim();
    if (bearer) return bearer;
  }

  return null;
}

function timingSafeEqualStrings(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function isCronSecretConfigured() {
  const secret = process.env.CRON_SECRET;
  return typeof secret === 'string' && secret.trim().length >= MIN_CRON_SECRET_LENGTH;
}

/**
 * Middleware: cron jobs must present CRON_SECRET via x-cron-secret or Authorization: Bearer.
 * Returns 503 if CRON_SECRET is missing/too short. Returns 401 on mismatch (no query ?secret=).
 */
function requireCronSecret(req, res, next) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || String(cronSecret).trim().length < MIN_CRON_SECRET_LENGTH) {
    return res.status(503).json({
      error: 'Cron not configured',
      details: `Set CRON_SECRET (min ${MIN_CRON_SECRET_LENGTH} characters) in server environment.`,
    });
  }

  const provided = getCronSecretFromRequest(req);
  if (!provided) {
    return res.status(401).json({
      error: 'Unauthorized',
      details: 'Send CRON_SECRET as header x-cron-secret or Authorization: Bearer <secret>.',
    });
  }

  if (!timingSafeEqualStrings(provided, String(cronSecret).trim())) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
}

module.exports = {
  MIN_CRON_SECRET_LENGTH,
  getCronSecretFromRequest,
  isCronSecretConfigured,
  requireCronSecret,
  timingSafeEqualStrings,
};
