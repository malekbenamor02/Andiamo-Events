'use strict';

const { getEmergencyState } = require('./emergency.cjs');
const { getPolicy } = require('./policies.cjs');
const { hashRateLimitSegment, buildRateLimitKey } = require('./hash-key.cjs');
const { incrFixedWindow } = require('./upstash.cjs');
const { logRateLimitExceeded } = require('./audit.cjs');

/**
 * Build explicit buckets from policy + segment map.
 * @param {string} policyId
 * @param {Record<string, string>} segments dimension → raw value (hashed internally)
 */
function bucketsFromPolicy(policyId, segments) {
  const policy = getPolicy(policyId);
  if (!policy) return null;

  return policy.buckets
    .filter((b) => {
      const val = segments[b.dimension];
      return val != null && String(val).trim() !== '';
    })
    .map((b) => ({
      route: policy.route,
      policyId,
      dimension: b.dimension,
      segment: String(segments[b.dimension]),
      max: b.max,
      windowSec: b.windowSec,
      onRedisMissing: b.onRedisMissing,
      onRedisError: b.onRedisError,
    }));
}

/**
 * @param {object} ctx
 * @param {import('http').IncomingMessage} [ctx.req]
 * @param {string} [ctx.policyId]
 * @param {Record<string, string>} [ctx.segments]
 * @param {Array<{ route: string, policyId?: string, dimension: string, segment: string, max: number, windowSec: number, onRedisMissing?: string, onRedisError?: string }>} [ctx.buckets]
 */
async function enforceRateLimits(ctx) {
  const emergency = getEmergencyState();
  if (emergency.skip) {
    return { allowed: true, skipped: true, reason: emergency.reason };
  }

  let buckets = ctx.buckets;
  if (!buckets && ctx.policyId && ctx.segments) {
    buckets = bucketsFromPolicy(ctx.policyId, ctx.segments);
  }
  if (!buckets || buckets.length === 0) {
    return { allowed: true, skipped: true, reason: 'no_buckets' };
  }

  const results = await Promise.all(
    buckets.map(async (bucket) => {
      const segmentHash = hashRateLimitSegment(bucket.segment, bucket.dimension);
      const redisKey = buildRateLimitKey({
        route: bucket.route,
        dimension: bucket.dimension,
        segmentHash,
      });

      const result = await incrFixedWindow(redisKey, bucket.max, bucket.windowSec, {
        onRedisMissing: bucket.onRedisMissing || 'fail-closed',
        onRedisError: bucket.onRedisError || 'fail-closed',
      });

      return { bucket, result, redisKey };
    })
  );

  for (const { bucket, result } of results) {
    if (result.reason === 'redis_missing' && !result.allowed) {
      return {
        allowed: false,
        statusCode: 503,
        reason: 'redis_missing',
        dimension: bucket.dimension,
        policyId: bucket.policyId,
        route: bucket.route,
      };
    }
    if (result.reason === 'redis_error' && !result.allowed) {
      return {
        allowed: false,
        statusCode: 503,
        reason: 'redis_error',
        dimension: bucket.dimension,
        policyId: bucket.policyId,
        route: bucket.route,
      };
    }
    if (result.reason === 'over_limit') {
      if (ctx.req) {
        await logRateLimitExceeded({
          route: bucket.route,
          policyId: bucket.policyId,
          dimension: bucket.dimension,
          req: ctx.req,
          segmentValue: bucket.segment,
        });
      }
      return {
        allowed: false,
        statusCode: 429,
        reason: 'over_limit',
        dimension: bucket.dimension,
        policyId: bucket.policyId,
        route: bucket.route,
        retryAfterSec: bucket.windowSec,
      };
    }
  }

  return { allowed: true, skipped: false };
}

module.exports = {
  enforceRateLimits,
  bucketsFromPolicy,
};
