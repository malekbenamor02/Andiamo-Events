/**
 * Optional distributed rate limits for admin login via Upstash Redis REST.
 * Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (Vercel / env).
 * Fails open on network errors so login still works if Redis is down.
 */

import crypto from 'crypto';

function redisBaseUrl() {
  const u = process.env.UPSTASH_REDIS_REST_URL;
  if (!u) return null;
  return u.replace(/\/$/, '');
}

function redisToken() {
  return process.env.UPSTASH_REDIS_REST_TOKEN || null;
}

function hashSegment(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 48);
}

/**
 * Increment a counter with fixed window: TTL set only on first increment in window.
 * @returns {Promise<{ ok: boolean, count: number }>} ok false when over max
 */
export async function adminLoginUpstashIncr(keySuffix, maxAttempts, ttlSeconds) {
  const base = redisBaseUrl();
  const token = redisToken();
  if (!base || !token) {
    return { ok: true, count: 0, skipped: true };
  }

  const key = `al:rl:${keySuffix}`.slice(0, 200);
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  try {
    const r1 = await fetch(`${base}/pipeline`, {
      method: 'POST',
      headers,
      body: JSON.stringify([['INCR', key]]),
    });
    const data1 = await r1.json();
    if (!r1.ok || !Array.isArray(data1) || data1[0]?.error) {
      return { ok: true, count: 0, skipped: true };
    }
    const count = typeof data1[0]?.result === 'number' ? data1[0].result : NaN;
    if (Number.isNaN(count)) {
      return { ok: true, count: 0, skipped: true };
    }

    if (count === 1) {
      await fetch(`${base}/pipeline`, {
        method: 'POST',
        headers,
        body: JSON.stringify([['EXPIRE', key, String(ttlSeconds)]]),
      }).catch(() => {});
    }

    if (count > maxAttempts) {
      return { ok: false, count };
    }
    return { ok: true, count };
  } catch {
    return { ok: true, count: 0, skipped: true };
  }
}

export async function checkAdminLoginDistributedLimits(clientIp, emailNormalized) {
  const ttl = 15 * 60;
  const max = Number.parseInt(process.env.ADMIN_LOGIN_MAX_ATTEMPTS || '5', 10) || 5;
  const ipKey = `ip:${hashSegment(clientIp)}`;
  const emKey = `em:${hashSegment(emailNormalized)}`;

  const ipRes = await adminLoginUpstashIncr(ipKey, max, ttl);
  if (!ipRes.ok) return { allowed: false, reason: 'ip' };

  const emRes = await adminLoginUpstashIncr(emKey, max, ttl);
  if (!emRes.ok) return { allowed: false, reason: 'email' };

  return { allowed: true };
}
