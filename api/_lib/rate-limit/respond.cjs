'use strict';

/**
 * @param {import('http').ServerResponse} res
 * @param {{ retryAfterSec?: number, route?: string, policyId?: string }} opts
 */
function sendRateLimited(res, opts = {}) {
  const retryAfterSec = Math.max(1, Math.floor(Number(opts.retryAfterSec) || 60));
  const route = opts.route || opts.policyId || 'unknown';

  res.setHeader('Retry-After', String(retryAfterSec));
  res.setHeader('X-RateLimit-Policy', String(route).slice(0, 128));
  res.statusCode = 429;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'rate_limited', retryAfter: retryAfterSec }));
}

/**
 * @param {import('http').ServerResponse} res
 */
function sendRateLimitServiceUnavailable(res) {
  res.statusCode = 503;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'service_unavailable' }));
}

/**
 * @param {import('http').ServerResponse} res
 * @param {{ allowed: boolean, statusCode?: number, retryAfterSec?: number, route?: string, policyId?: string }} result
 * @returns {boolean} true when response was sent (blocked)
 */
function respondToRateLimit(res, result) {
  if (result.allowed) return false;
  if (result.statusCode === 503) {
    sendRateLimitServiceUnavailable(res);
  } else {
    sendRateLimited(res, {
      retryAfterSec: result.retryAfterSec || 60,
      route: result.route || result.policyId || 'unknown',
    });
  }
  return true;
}

module.exports = {
  sendRateLimited,
  sendRateLimitServiceUnavailable,
  respondToRateLimit,
};
