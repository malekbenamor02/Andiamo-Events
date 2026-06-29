'use strict';

const { getClientIp } = require('./client-ip.cjs');
const { hashRateLimitSegment, maskSegmentForLog } = require('./hash-key.cjs');

/**
 * Log rate limit exceeded without PII. Does not log raw IP, email, tokens, or UUIDs.
 * @param {{ route: string, policyId?: string, dimension: string, req?: import('http').IncomingMessage, segmentValue?: string }} ctx
 */
async function logRateLimitExceeded(ctx) {
  const { route, policyId, dimension, req, segmentValue } = ctx;
  const ip = req ? getClientIp(req) : 'unknown';
  const ipHash = hashRateLimitSegment(ip, 'ip');
  const segHash = segmentValue ? hashRateLimitSegment(segmentValue, dimension) : null;

  const entry = {
    event_type: 'rate_limit_exceeded',
    endpoint: route,
    request_method: req?.method || 'unknown',
    request_path: route,
    details: {
      policy: policyId || route,
      dimension,
      ip_hash: maskSegmentForLog(ipHash),
      ...(segHash ? { segment_hash: maskSegmentForLog(segHash) } : {}),
    },
    severity: 'medium',
  };

  console.warn('[rate-limit] exceeded', JSON.stringify(entry.details));
}

module.exports = {
  logRateLimitExceeded,
};
