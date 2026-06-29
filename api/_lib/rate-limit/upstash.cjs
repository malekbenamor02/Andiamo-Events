'use strict';

/**
 * Atomic fixed-window rate limit via Upstash Redis REST EVAL (Lua).
 * Production path MUST NOT use separate INCR + EXPIRE calls.
 *
 * Upstash REST shape (command in JSON body, POST to base URL):
 *   POST {UPSTASH_REDIS_REST_URL}
 *   Authorization: Bearer {UPSTASH_REDIS_REST_TOKEN}
 *   Content-Type: application/json
 *   Body: ["EVAL", luaScript, numKeys, key1, ..., arg1, ...]
 *
 * @see https://upstash.com/docs/redis/features/restapi
 */

const {
  getEnvPresence,
  isUrlShapeValid,
  categorizeUpstashError,
} = require('./upstash-diagnostics.cjs');

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
  const base = redisBaseUrl();
  const token = redisToken();
  return !!(base && token && isUrlShapeValid(base));
}

function buildEvalBody(redisKey, ttlSeconds) {
  const ttl = Math.max(1, Math.floor(Number(ttlSeconds) || 60));
  return JSON.stringify(['EVAL', LUA_INCR_FIXED_WINDOW, 1, redisKey, String(ttl)]);
}

function parseEvalCount(data) {
  if (data == null || data.result == null) return NaN;
  const raw = data.result;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : NaN;
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
  const envPresence = getEnvPresence();

  const base = redisBaseUrl();
  const token = redisToken();
  if (!base || !token || !envPresence.url_shape_valid) {
    const category = !envPresence.upstash_url_set || !envPresence.upstash_token_set
      ? 'missing_env'
      : 'invalid_env_shape';
    if (onRedisMissing === 'fail-open') {
      return { allowed: true, count: 0, skipped: true, reason: 'redis_missing', errorCategory: category };
    }
    return { allowed: false, count: 0, skipped: true, reason: 'redis_missing', errorCategory: category };
  }

  if (!fetchImpl) {
    if (onRedisError === 'fail-open') {
      return { allowed: true, count: 0, skipped: true, reason: 'redis_error', errorCategory: 'unknown' };
    }
    return { allowed: false, count: 0, skipped: true, reason: 'redis_error', errorCategory: 'unknown' };
  }

  const body = buildEvalBody(redisKey, ttlSeconds);

  try {
    const res = await fetchImpl(base, {
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
      const errorCategory = categorizeUpstashError({
        httpStatus: res.status,
        data,
        envPresence,
      });
      if (onRedisError === 'fail-open') {
        return {
          allowed: true,
          count: 0,
          skipped: true,
          reason: 'redis_error',
          errorCategory,
          httpStatus: res.status,
        };
      }
      return {
        allowed: false,
        count: 0,
        skipped: true,
        reason: 'redis_error',
        errorCategory,
        httpStatus: res.status,
      };
    }

    const count = parseEvalCount(data);
    if (!Number.isFinite(count)) {
      const errorCategory = 'redis_unexpected_response';
      if (onRedisError === 'fail-open') {
        return { allowed: true, count: 0, skipped: true, reason: 'redis_error', errorCategory };
      }
      return { allowed: false, count: 0, skipped: true, reason: 'redis_error', errorCategory };
    }

    if (count > max) {
      return { allowed: false, count, skipped: false, reason: 'over_limit' };
    }
    return { allowed: true, count, skipped: false };
  } catch {
    const errorCategory = categorizeUpstashError({ hadNetworkError: true, envPresence });
    if (onRedisError === 'fail-open') {
      return { allowed: true, count: 0, skipped: true, reason: 'redis_error', errorCategory };
    }
    return { allowed: false, count: 0, skipped: true, reason: 'redis_error', errorCategory };
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
  buildEvalBody,
  parseEvalCount,
};
