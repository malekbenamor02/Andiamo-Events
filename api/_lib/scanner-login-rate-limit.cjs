'use strict';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX = 6;

/** @type {Map<string, { count: number, resetAt: number }>} */
const ipAttempts = new Map();
/** @type {Map<string, { count: number, resetAt: number }>} */
const emailAttempts = new Map();

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function bump(map, key) {
  if (!key) return;
  const now = Date.now();
  let rec = map.get(key);
  if (!rec || now > rec.resetAt) {
    map.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  rec.count += 1;
}

function isBlocked(map, key) {
  if (!key) return false;
  const rec = map.get(key);
  if (!rec) return false;
  if (Date.now() > rec.resetAt) return false;
  return rec.count >= LOGIN_MAX;
}

function isScannerLoginRateLimited(ip, email) {
  return isBlocked(ipAttempts, ip) || isBlocked(emailAttempts, normalizeEmail(email));
}

function recordFailedScannerLogin(ip, email) {
  bump(ipAttempts, ip);
  bump(emailAttempts, normalizeEmail(email));
}

function clearScannerLoginRateLimit(ip, email) {
  if (ip) ipAttempts.delete(ip);
  const em = normalizeEmail(email);
  if (em) emailAttempts.delete(em);
}

module.exports = {
  LOGIN_MAX,
  LOGIN_WINDOW_MS,
  isScannerLoginRateLimited,
  recordFailedScannerLogin,
  clearScannerLoginRateLimit,
  _resetForTests() {
    ipAttempts.clear();
    emailAttempts.clear();
  },
};
