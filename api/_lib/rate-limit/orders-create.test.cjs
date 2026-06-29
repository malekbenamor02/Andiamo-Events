'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const {
  enforceRateLimits,
  setFetchForTests,
  resetFetchForTests,
  getPolicy,
} = require('./index.cjs');

const root = resolve(__dirname, '../../..');
function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('orders-create handler order', () => {
  const src = read('api/orders-create.js');

  it('parses body before createClient / createServiceRoleClient', () => {
    const parseIdx = src.indexOf('parseOrderCreateBody');
    const rlIdx = src.indexOf("policyId: 'ORDER_CREATE'");
    const createIdx = src.indexOf('createClient(');
    assert.ok(parseIdx >= 0);
    assert.ok(parseIdx < createIdx, 'parse before db client');
    assert.ok(rlIdx < createIdx, 'rate limit before db client');
  });

  it('does not use in-memory Map rate limiters', () => {
    assert.doesNotMatch(src, /orderRateByIp/);
    assert.doesNotMatch(src, /orderRateByDevice/);
    assert.doesNotMatch(src, /checkOrderIpRateLimit/);
  });

  it('enforces 256KB body cap', () => {
    assert.match(src, /ORDER_CREATE_BODY_MAX_BYTES = 256 \* 1024/);
    assert.match(src, /tooLarge/);
  });

  it('respondToRateLimit guard returns before createClient when blocked', () => {
    const blockIdx = src.indexOf('if (respondToRateLimit(res, rl)) return');
    const createIdx = src.indexOf('createClient(');
    assert.ok(blockIdx >= 0);
    assert.ok(blockIdx < createIdx);
  });
});

describe('ORDER_CREATE policy buckets', () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
    resetFetchForTests();
  });

  it('enforces IP + email buckets', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    process.env.RATE_LIMIT_KEY_PEPPER = 'test-pepper-32-chars-minimum!!!!';

    setFetchForTests(async () => ({
      ok: true,
      json: async () => ({ result: 11 }),
    }));

    const req = { headers: { 'x-device-id': 'dev-abc' }, socket: { remoteAddress: '10.0.0.1' }, method: 'POST' };
    const result = await enforceRateLimits({
      req,
      policyId: 'ORDER_CREATE',
      segments: { ip: '203.0.113.1', email: 'buyer@test.com', device: 'dev-abc' },
    });
    assert.equal(result.allowed, false);
    assert.equal(result.statusCode, 429);
  });

  it('device bucket is configured fail-open on redis error', () => {
    const policy = getPolicy('ORDER_CREATE');
    const device = policy.buckets.find((b) => b.dimension === 'device');
    assert.equal(device.onRedisError, 'fail-open');
  });
});

describe('service-role not constructed when RL fails (static)', () => {
  it('createClient only appears after respondToRateLimit check in try block', () => {
    const src = read('api/orders-create.js');
    const tryStart = src.indexOf('export default async (req, res) => {');
    const handler = src.slice(tryStart);
    const rlReturn = handler.indexOf('if (respondToRateLimit(res, rl)) return');
    const createClient = handler.indexOf('const dbClient = createClient');
    assert.ok(rlReturn >= 0);
    assert.ok(createClient > rlReturn);
  });
});
