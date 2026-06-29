'use strict';

/**
 * Atomic fixed-window rate limit via Upstash Redis REST EVAL (Lua).
 * Production path MUST NOT use separate INCR + EXPIRE calls.
 *
 * REST shape:
 *   POST {UPSTASH_REDIS_REST_URL}/eval
 *   Authorization: Bearer {UPSTASH_REDIS_REST_TOKEN}
 *   Content-Type: application/json
 *   Body: JSON array [ luaScript, numKeys, ...keys, ...args ]
 *
 * @see https://upstash.com/docs/redis/features/restapi
 */

const LUA_INCR_FIXED_WINDOW = [
  'local c = redis.call("INCR", KEYS[1])',
  'if c == 1 then',
  '  redis.call("EXPIRE", KEYS[1], ARGV[1])',
  'end',
  'return c',
].join('\n');

/** @type {typeof fetch | null} */
let fetchImpl = typeof fetch === 'function' ? fetch : null;

function setFetchForTests(fn) {
  fetchImpl = fn;
}

function resetFetchForTests() {
  fetchImpl = typeof fetch === 'function' ? fetch : null;
}

function redisBaseUrl() {
  const u = process.env.UPSTASH_REDIS_REST_URL;
  if (!u) return null;
  return u.replace(/\/$/, '');
}

function redisToken() {
  return process.env.UPSTASH_REDIS_REST_TOKEN || null;
}

function isRedisConfigured() {
  return !!(redisBaseUrl() && redisToken());
}

/**
 * @param {string} redisKey full Redis key (already ae:rl:v1:…)
 * @param {number} max
 * @param {number} ttlSeconds
 * @param {{ onRedisMissing?: 'fail-open'|'fail-closed', onRedisError?: 'fail-open'|'fail-closed' }} [options]
 */
async function incrFixedWindow(redisKey, max, ttlSeconds, options = {}) {
  const onRedisMissing = options.onRedisMissing || 'fail-closed';
  const onRedisError = options.onRedisError || 'fail-closed';

  const base = redisBaseUrl();
  const token = redisToken();
  if (!base || !token) {
    if (onRedisMissing === 'fail-open') {
      return { allowed: true, count: 0, skipped: true, reason: 'redis_missing' };
    }
    return { allowed: false, count: 0, skipped: true, reason: 'redis_missing' };
  }

  if (!fetchImpl) {
    if (onRedisError === 'fail-open') {
      return { allowed: true, count: 0, skipped: true, reason: 'redis_error' };
    }
    return { allowed: false, count: 0, skipped: true, reason: 'redis_error' };
  }

  const ttl = Math.max(1, Math.floor(Number(ttlSeconds) || 60));
  const body = JSON.stringify([LUA_INCR_FIXED_WINDOW, 1, redisKey, String(ttl)]);

  try {
    const res = await fetchImpl(`${base}/eval`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok || data?.error) {
      if (onRedisError === 'fail-open') {
        return { allowed: true, count: 0, skipped: true, reason: 'redis_error' };
      }
      return { allowed: false, count: 0, skipped: true, reason: 'redis_error' };
    }

    const count = typeof data?.result === 'number' ? data.result : Number(data?.result);
    if (!Number.isFinite(count)) {
      if (onRedisError === 'fail-open') {
        return { allowed: true, count: 0, skipped: true, reason: 'redis_error' };
      }
      return { allowed: false, count: 0, skipped: true, reason: 'redis_error' };
    }

    if (count > max) {
      return { allowed: false, count, skipped: false, reason: 'over_limit' };
    }
    return { allowed: true, count, skipped: false };
  } catch {
    if (onRedisError === 'fail-open') {
      return { allowed: true, count: 0, skipped: true, reason: 'redis_error' };
    }
    return { allowed: false, count: 0, skipped: true, reason: 'redis_error' };
  }
}

function getLuaScriptForTests() {
  return LUA_INCR_FIXED_WINDOW;
}

module.exports = {
  LUA_INCR_FIXED_WINDOW,
  setFetchForTests,
  resetFetchForTests,
  isRedisConfigured,
  incrFixedWindow,
  getLuaScriptForTests,
};
