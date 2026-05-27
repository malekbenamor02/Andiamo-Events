/**
 * Best-effort IP + email rate limits for POST /api/admin-login (Vercel serverless).
 * Resets on cold start; combine with Upstash (api/lib/admin-login-upstash.js) for distributed limits.
 */

const adminLoginIpAttempts = new Map();
const adminLoginEmailAttempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;

function maxAttempts() {
  const n = Number.parseInt(process.env.ADMIN_LOGIN_MAX_ATTEMPTS || '5', 10);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

export function getAdminLoginClientIp(req) {
  return (
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

function bump(map, key) {
  const now = Date.now();
  const max = maxAttempts();
  let rec = map.get(key);
  if (!rec || now > rec.resetAt) {
    map.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  rec.count += 1;
  if (rec.count > max) return false;
  return true;
}

export function checkAdminLoginIpRateLimit(ip) {
  return bump(adminLoginIpAttempts, `ip:${ip}`);
}

export function checkAdminLoginEmailRateLimit(emailNormalized) {
  return bump(adminLoginEmailAttempts, `em:${emailNormalized}`);
}
