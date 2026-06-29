'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const {
  enforceRateLimits,
  setFetchForTests,
  resetFetchForTests,
  hashRateLimitSegment,
  buildRateLimitKey,
} = require('./rate-limit/index.cjs');

const root = resolve(__dirname, '../..');
function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('ambassador order action rate limits', () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
    resetFetchForTests();
  });

  it('ORDER_AMBASSADOR_ACTION enforces ambassador + order buckets', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    process.env.RATE_LIMIT_KEY_PEPPER = 'test-pepper-32-chars-minimum!!!!';

    setFetchForTests(async () => ({
      ok: true,
      json: async () => ({ result: 11 }),
    }));

    const req = { headers: {}, socket: { remoteAddress: '10.0.0.1' }, method: 'POST' };
    const result = await enforceRateLimits({
      req,
      policyId: 'ORDER_AMBASSADOR_ACTION',
      segments: {
        ambassador: '11111111-1111-4111-8111-111111111111',
        order: '550e8400-e29b-41d4-a716-446655440000',
      },
    });
    assert.equal(result.allowed, false);
    assert.equal(result.statusCode, 429);
  });

  it('confirm/cancel handlers wire auth before RL before DB mutation', () => {
    const src = read('api/_lib/ambassador-routes.cjs');
    for (const fn of ['handleAmbassadorCancelOrder', 'handleAmbassadorConfirmCash']) {
      const start = src.indexOf(`async function ${fn}`);
      assert.ok(start >= 0, fn);
      const block = src.slice(start, start + 2500);
      const authIdx = block.indexOf('requireAmbassadorAuth');
      const rlIdx = block.indexOf('enforceAmbassadorOrderActionRateLimit');
      const dbIdx = block.indexOf(".from('orders')");
      assert.ok(authIdx < rlIdx, `${fn}: auth before RL`);
      assert.ok(rlIdx < dbIdx, `${fn}: RL before DB`);
    }
  });

  it('does not store raw order UUID in redis keys', () => {
    process.env.RATE_LIMIT_KEY_PEPPER = 'test-pepper-32-chars-minimum!!!!';
    const key = buildRateLimitKey({
      route: 'order.ambassador.action',
      dimension: 'order',
      segmentHash: hashRateLimitSegment('550e8400-e29b-41d4-a716-446655440000', 'order'),
    });
    assert.doesNotMatch(key, /550e8400/);
  });
});
