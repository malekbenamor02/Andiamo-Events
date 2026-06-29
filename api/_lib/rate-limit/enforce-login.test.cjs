'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const {
  enforceRateLimits,
  getPolicy,
  setFetchForTests,
  resetFetchForTests,
  hashRateLimitSegment,
  buildRateLimitKey,
} = require('./index.cjs');

describe('enforce-login policies', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    process.env.RATE_LIMIT_KEY_PEPPER = 'test-pepper-32-chars-minimum!!!!';
    delete process.env.RATE_LIMIT_GLOBAL_FAIL_OPEN;
    delete process.env.VERCEL;
  });

  afterEach(() => {
    process.env = { ...savedEnv };
    resetFetchForTests();
  });

  const loginPolicies = [
    ['LOGIN_ADMIN', { ip: '203.0.113.1', email: 'admin@test.com' }],
    ['LOGIN_AMBASSADOR', { ip: '203.0.113.2', phone: '22123456' }],
    ['LOGIN_SCANNER', { ip: '203.0.113.3', email: 'scan@test.com' }],
    ['LOGIN_POS', { ip: '203.0.113.4', email: 'pos@test.com' }],
    ['LOGIN_INFLUENCER', { ip: '203.0.113.5', email: 'inf@test.com' }],
  ];

  for (const [policyId, segments] of loginPolicies) {
    it(`${policyId} returns 429 when over limit`, async () => {
      const policy = getPolicy(policyId);
      const max = policy.buckets[0].max;

      setFetchForTests(async () => ({
        ok: true,
        json: async () => ({ result: max + 1 }),
      }));

      const result = await enforceRateLimits({ policyId, segments });
      assert.equal(result.allowed, false);
      assert.equal(result.statusCode, 429);
    });
  }

  it('LOGIN_AMBASSADOR phone-only bucket can be enforced separately from IP', async () => {
    setFetchForTests(async () => ({
      ok: true,
      json: async () => ({ result: 6 }),
    }));

    const result = await enforceRateLimits({
      policyId: 'LOGIN_AMBASSADOR',
      segments: { phone: '22123456' },
    });
    assert.equal(result.allowed, false);
    assert.equal(result.dimension, 'phone');
  });
});

describe('login Redis keys contain no raw PII', () => {
  it('hashes email and phone in key segments', () => {
    process.env.RATE_LIMIT_KEY_PEPPER = 'test-pepper-32-chars-minimum!!!!';
    const emailKey = buildRateLimitKey({
      route: 'login.admin',
      dimension: 'email',
      segmentHash: hashRateLimitSegment('secret@test.com', 'email'),
    });
    const phoneKey = buildRateLimitKey({
      route: 'login.ambassador',
      dimension: 'phone',
      segmentHash: hashRateLimitSegment('+216 22 123 456', 'phone'),
    });
    assert.doesNotMatch(emailKey, /secret/);
    assert.doesNotMatch(phoneKey, /216/);
  });
});
