'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  enforceScannerLoginLimits,
  setFetchForTests,
  resetFetchForTests,
} = require('./scanner-login-rate-limit.cjs');
const { getPolicy, hashRateLimitSegment, buildRateLimitKey } = require('./rate-limit/index.cjs');

describe('scanner login shared rate limiter', () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
    process.env.RATE_LIMIT_KEY_PEPPER = 'test-pepper-32-chars-minimum!!!!';
    resetFetchForTests();
  });

  it('consumes on every attempt (not failure-only)', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

    let callCount = 0;
    setFetchForTests(async () => {
      callCount += 1;
      return { ok: true, json: async () => ({ result: callCount }) };
    });

    const req = { headers: {}, socket: { remoteAddress: '10.0.0.1' }, method: 'POST' };
    const r1 = await enforceScannerLoginLimits(req, '203.0.113.1', 'scan@test.com');
    assert.equal(r1.allowed, true);
    assert.ok(callCount >= 1);

    const policy = getPolicy('LOGIN_SCANNER');
    const ipMax = policy.buckets.find((b) => b.dimension === 'ip').max;
    setFetchForTests(async () => ({
      ok: true,
      json: async () => ({ result: ipMax + 1 }),
    }));

    const r2 = await enforceScannerLoginLimits(req, '203.0.113.1', 'scan@test.com');
    assert.equal(r2.allowed, false);
    assert.equal(r2.statusCode, 429);
  });

  it('does not put raw email in redis key', () => {
    process.env.RATE_LIMIT_KEY_PEPPER = 'test-pepper-32-chars-minimum!!!!';
    const email = 'hidden-scanner@secret.com';
    const key = buildRateLimitKey({
      route: 'login.scanner',
      dimension: 'email',
      segmentHash: hashRateLimitSegment(email, 'email'),
    });
    assert.doesNotMatch(key, /hidden-scanner/);
    assert.doesNotMatch(key, /@/);
  });
});
