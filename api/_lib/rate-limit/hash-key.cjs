'use strict';

const crypto = require('crypto');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEV_ONLY_PEPPER = 'rate-limit-dev-pepper-do-not-use-on-vercel';

function isValidUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

function isVercelRuntime() {
  return process.env.VERCEL === '1';
}

function getRateLimitPepper() {
  const explicit = process.env.RATE_LIMIT_KEY_PEPPER?.trim();
  if (explicit) return explicit;
  const jwt = process.env.JWT_SECRET?.trim();
  if (jwt) return jwt.slice(0, 32);
  if (isVercelRuntime()) {
    return DEV_ONLY_PEPPER;
  }
  return DEV_ONLY_PEPPER;
}

function normalizePhoneDigits(value) {
  let cleaned = String(value || '').replace(/[\s\-()]/g, '').trim();
  if (cleaned.startsWith('+216')) cleaned = cleaned.substring(4);
  else if (cleaned.startsWith('216')) cleaned = cleaned.substring(3);
  else if (cleaned.startsWith('00216')) cleaned = cleaned.substring(5);
  cleaned = cleaned.replace(/^0+/, '');
  return cleaned.replace(/\D/g, '');
}

/**
 * Normalize segment before hashing (never use raw value in Redis keys).
 * @param {string} dimension
 * @param {string} value
 */
function normalizeSegmentForHash(dimension, value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  switch (dimension) {
    case 'email':
    case 'recipient':
      return raw.toLowerCase();
    case 'phone':
      return normalizePhoneDigits(raw);
    case 'order':
    case 'registration':
    case 'admin':
    case 'ambassador':
    case 'pos_user':
    case 'outlet':
    case 'token':
      if (isValidUuid(raw)) return raw.toLowerCase();
      return raw.toLowerCase().slice(0, 128);
    case 'device':
      return raw.slice(0, 128);
    case 'ip':
    default:
      return raw.slice(0, 128);
  }
}

function hashRateLimitSegment(value, dimension) {
  const dim = dimension || 'ip';
  const normalized = normalizeSegmentForHash(dim, value);
  const pepper = getRateLimitPepper();
  return crypto
    .createHash('sha256')
    .update(`${pepper}:${dim}:${normalized}`)
    .digest('hex')
    .slice(0, 32);
}

/**
 * @param {{ route: string, dimension: string, segmentHash: string }} parts
 */
function buildRateLimitKey(parts) {
  const route = String(parts.route || 'unknown').slice(0, 64);
  const dimension = String(parts.dimension || 'ip').slice(0, 32);
  const segmentHash = String(parts.segmentHash || '').slice(0, 32);
  const key = `ae:rl:v1:${route}:${dimension}:${segmentHash}`;
  return key.slice(0, 200);
}

/** Safe audit/log label — never raw identifier. */
function maskSegmentForLog(segmentHash) {
  if (!segmentHash || segmentHash.length < 8) return 'seg:****';
  return `seg:${segmentHash.slice(0, 4)}…${segmentHash.slice(-4)}`;
}

module.exports = {
  UUID_RE,
  isValidUuid,
  getRateLimitPepper,
  normalizeSegmentForHash,
  hashRateLimitSegment,
  buildRateLimitKey,
  maskSegmentForLog,
};
