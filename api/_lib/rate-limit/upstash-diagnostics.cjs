'use strict';

/**
 * Safe diagnostics for Upstash REST — never log secrets or raw URLs/tokens.
 */

function getEnvPresence() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim() || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || '';
  return {
    upstash_url_set: Boolean(url),
    upstash_token_set: Boolean(token),
    url_shape_valid: isUrlShapeValid(url),
  };
}

function isUrlShapeValid(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim();
  if (!u.startsWith('https://')) return false;
  try {
    const parsed = new URL(u);
    return Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * @param {{ httpStatus?: number, data?: { error?: string }, hadNetworkError?: boolean, envPresence?: ReturnType<typeof getEnvPresence> }} input
 */
function categorizeUpstashError(input) {
  const env = input.envPresence || getEnvPresence();
  if (!env.upstash_url_set || !env.upstash_token_set) return 'missing_env';
  if (!env.url_shape_valid) return 'invalid_env_shape';

  if (input.hadNetworkError) return 'redis_network_failed';
  if (input.httpStatus === 401) return 'redis_auth_failed';

  const errMsg = input.data?.error != null ? String(input.data.error) : '';
  if (errMsg) {
    const upper = errMsg.toUpperCase();
    if (upper.includes('WRONGPASS') || upper.includes('NOAUTH') || upper.includes('AUTH')) {
      return 'redis_auth_failed';
    }
    if (upper.includes('ERR')) return 'redis_eval_failed';
    return 'redis_unexpected_response';
  }

  if (input.httpStatus && input.httpStatus >= 400) return 'redis_eval_failed';
  return 'unknown';
}

function getRequestId(req) {
  if (!req?.headers) return null;
  const h = req.headers;
  return (
    h['x-vercel-id'] ||
    h['x-request-id'] ||
    h['x-amzn-trace-id'] ||
    null
  );
}

/**
 * @param {{ route?: string, policy?: string, policyId?: string, dimension?: string, category: string, httpStatus?: number, req?: import('http').IncomingMessage }} ctx
 */
function logRateLimitRedisFailure(ctx) {
  const entry = {
    event: 'rate_limit_redis_failure',
    route: ctx.route || ctx.policy || 'unknown',
    policy: ctx.policyId || ctx.policy || 'unknown',
    dimension: ctx.dimension || 'unknown',
    category: ctx.category || 'unknown',
    ...(ctx.httpStatus != null ? { upstash_http_status: ctx.httpStatus } : {}),
    ...(getRequestId(ctx.req) ? { request_id: String(getRequestId(ctx.req)).slice(0, 128) } : {}),
  };
  console.error('[rate-limit] redis unavailable', JSON.stringify(entry));
}

module.exports = {
  getEnvPresence,
  isUrlShapeValid,
  categorizeUpstashError,
  getRequestId,
  logRateLimitRedisFailure,
};
