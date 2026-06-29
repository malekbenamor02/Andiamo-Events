'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  enforceRateLimits,
  getClientIp,
  respondToRateLimit,
  setFetchForTests,
  resetFetchForTests,
  hashRateLimitSegment,
  buildRateLimitKey,
} = require('./rate-limit/index.cjs');

describe('POS login rate limits', () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
    process.env.RATE_LIMIT_KEY_PEPPER = 'test-pepper-32-chars-minimum!!!!';
    resetFetchForTests();
  });

  it('enforces IP then email buckets for LOGIN_POS', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

    setFetchForTests(async () => ({
      ok: true,
      json: async () => ({ result: 11 }),
    }));

    const req = { headers: {}, socket: { remoteAddress: '10.0.0.3' }, method: 'POST' };
    const ipResult = await enforceRateLimits({
      req,
      policyId: 'LOGIN_POS',
      segments: { ip: getClientIp(req) },
    });
    assert.equal(ipResult.allowed, false);
    assert.equal(ipResult.dimension, 'ip');

    setFetchForTests(async () => ({
      ok: true,
      json: async () => ({ result: 7 }),
    }));

    const emailResult = await enforceRateLimits({
      req,
      policyId: 'LOGIN_POS',
      segments: { email: 'cashier@outlet.test' },
    });
    assert.equal(emailResult.allowed, false);
    assert.equal(emailResult.dimension, 'email');
  });

  it('does not store raw email in redis keys', () => {
    process.env.RATE_LIMIT_KEY_PEPPER = 'test-pepper-32-chars-minimum!!!!';
    const key = buildRateLimitKey({
      route: 'login.pos',
      dimension: 'email',
      segmentHash: hashRateLimitSegment('cashier@outlet.test', 'email'),
    });
    assert.doesNotMatch(key, /cashier/);
    assert.doesNotMatch(key, /@/);
  });

  it('returns 503 when redis missing under fail-closed (Vercel)', async () => {
    process.env.VERCEL = '1';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const req = { headers: {}, socket: { remoteAddress: '10.0.0.3' }, method: 'POST' };
    const result = await enforceRateLimits({
      req,
      policyId: 'LOGIN_POS',
      segments: { ip: '203.0.113.10' },
    });
    assert.equal(result.allowed, false);
    assert.equal(result.statusCode, 503);

    const chunks = [];
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { chunks.push(b); } };
    respondToRateLimit(res, result);
    assert.equal(res.statusCode, 503);
    assert.deepEqual(JSON.parse(chunks[0]), { error: 'service_unavailable' });
  });
});
