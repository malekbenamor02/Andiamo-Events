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

describe('ambassador login rate limits', () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
    process.env.RATE_LIMIT_KEY_PEPPER = 'test-pepper-32-chars-minimum!!!!';
    resetFetchForTests();
  });

  it('enforces IP bucket before phone bucket independently', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

    setFetchForTests(async () => ({
      ok: true,
      json: async () => ({ result: 11 }),
    }));

    const req = { headers: {}, socket: { remoteAddress: '10.0.0.2' }, method: 'POST' };
    const ip = getClientIp(req);
    const ipResult = await enforceRateLimits({
      req,
      policyId: 'LOGIN_AMBASSADOR',
      segments: { ip },
    });
    assert.equal(ipResult.allowed, false);
    assert.equal(ipResult.dimension, 'ip');

    setFetchForTests(async () => ({
      ok: true,
      json: async () => ({ result: 6 }),
    }));

    const phoneResult = await enforceRateLimits({
      req,
      policyId: 'LOGIN_AMBASSADOR',
      segments: { phone: '22123456' },
    });
    assert.equal(phoneResult.allowed, false);
    assert.equal(phoneResult.dimension, 'phone');
  });

  it('does not store raw phone in redis keys', () => {
    process.env.RATE_LIMIT_KEY_PEPPER = 'test-pepper-32-chars-minimum!!!!';
    const key = buildRateLimitKey({
      route: 'login.ambassador',
      dimension: 'phone',
      segmentHash: hashRateLimitSegment('+216 22 999 888', 'phone'),
    });
    assert.doesNotMatch(key, /999/);
    assert.doesNotMatch(key, /216/);
  });

  it('respondToRateLimit sends 429 JSON contract', () => {
    const chunks = [];
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      end(body) {
        chunks.push(body);
      },
    };
    const blocked = respondToRateLimit(res, {
      allowed: false,
      statusCode: 429,
      retryAfterSec: 900,
      route: 'login.ambassador',
    });
    assert.equal(blocked, true);
    assert.equal(res.statusCode, 429);
    const body = JSON.parse(chunks[0]);
    assert.equal(body.error, 'rate_limited');
  });
});
