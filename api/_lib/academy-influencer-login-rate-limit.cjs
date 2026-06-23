'use strict';

/**
 * Failed-login rate limit for POST /api/academy-influencer/login (IP + normalized email).
 * In-memory; resets on cold start (same pattern as admin-login-rate-limit.js).
 */

const failedAttempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED = 5;

function getClientIp(req) {
  return (
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

function rateLimitKey(ip, emailNormalized) {
  return `${ip}|${emailNormalized}`;
}

function isLoginRateLimited(ip, emailNormalized) {
  const key = rateLimitKey(ip, emailNormalized);
  const rec = failedAttempts.get(key);
  if (!rec) return false;
  const now = Date.now();
  if (now > rec.resetAt) {
    failedAttempts.delete(key);
    return false;
  }
  return rec.count >= MAX_FAILED;
}

function recordFailedLogin(ip, emailNormalized) {
  const key = rateLimitKey(ip, emailNormalized);
  const now = Date.now();
  let rec = failedAttempts.get(key);
  if (!rec || now > rec.resetAt) {
    failedAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  rec.count += 1;
}

function clearLoginRateLimit(ip, emailNormalized) {
  failedAttempts.delete(rateLimitKey(ip, emailNormalized));
}

/** @internal test helper */
function _resetLoginRateLimitsForTests() {
  failedAttempts.clear();
}

module.exports = {
  WINDOW_MS,
  MAX_FAILED,
  getClientIp,
  isLoginRateLimited,
  recordFailedLogin,
  clearLoginRateLimit,
  _resetLoginRateLimitsForTests,
};
