'use strict';

const { describe, it, before, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  hashRateLimitSegment,
  buildRateLimitKey,
  getLuaScriptForTests,
  setFetchForTests,
  resetFetchForTests,
  incrFixedWindow,
  enforceRateLimits,
  getPolicy,
} = require('./index.cjs');

describe('rate-limit upstash Lua EVAL', () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
    resetFetchForTests();
  });

  it('uses POST /eval with Lua script body (not separate INCR+EXPIRE)', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

    /** @type {{ url: string, init: RequestInit } | null} */
    let captured = null;
    setFetchForTests(async (url, init) => {
      captured = { url, init };
      return {
        ok: true,
        json: async () => ({ result: 1 }),
      };
    });

    await incrFixedWindow('ae:rl:v1:test:ip:abc123', 5, 900);

    assert.ok(captured);
    assert.equal(captured.url, 'https://example.upstash.io/eval');
    assert.equal(captured.init.method, 'POST');
    assert.match(String(captured.init.headers?.Authorization), /Bearer test-token/);

    const body = JSON.parse(String(captured.init.body));
    assert.equal(body[0], getLuaScriptForTests());
    assert.equal(body[1], 1);
    assert.equal(body[2], 'ae:rl:v1:test:ip:abc123');
    assert.equal(body[3], '900');
    assert.match(body[0], /INCR/);
    assert.match(body[0], /EXPIRE/);
    assert.doesNotMatch(String(captured.init.body), /pipeline/i);
  });

  it('returns over_limit when count exceeds max', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

    setFetchForTests(async () => ({
      ok: true,
      json: async () => ({ result: 6 }),
    }));

    const res = await incrFixedWindow('ae:rl:v1:test:ip:abc', 5, 900);
    assert.equal(res.allowed, false);
    assert.equal(res.reason, 'over_limit');
    assert.equal(res.count, 6);
  });

  it('fail-closed on redis missing when configured', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const res = await incrFixedWindow('ae:rl:v1:test:ip:abc', 5, 900, {
      onRedisMissing: 'fail-closed',
    });
    assert.equal(res.allowed, false);
    assert.equal(res.reason, 'redis_missing');
  });

  it('fail-open on redis missing when configured', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const res = await incrFixedWindow('ae:rl:v1:test:ip:abc', 5, 900, {
      onRedisMissing: 'fail-open',
    });
    assert.equal(res.allowed, true);
    assert.equal(res.skipped, true);
    assert.equal(res.reason, 'redis_missing');
  });

  it('fail-closed on redis error when configured', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

    setFetchForTests(async () => {
      throw new Error('network');
    });

    const res = await incrFixedWindow('ae:rl:v1:test:ip:abc', 5, 900, {
      onRedisError: 'fail-closed',
    });
    assert.equal(res.allowed, false);
    assert.equal(res.reason, 'redis_error');
  });

  it('fail-open on redis error when configured', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

    setFetchForTests(async () => ({ ok: false, json: async () => ({ error: 'err' }) }));

    const res = await incrFixedWindow('ae:rl:v1:test:ip:abc', 5, 900, {
      onRedisError: 'fail-open',
    });
    assert.equal(res.allowed, true);
    assert.equal(res.reason, 'redis_error');
  });
});

describe('enforceRateLimits integration', () => {
  const savedEnv = { ...process.env };

  before(() => {
    process.env.RATE_LIMIT_KEY_PEPPER = 'test-pepper-32-chars-minimum!!!!';
    delete process.env.RATE_LIMIT_GLOBAL_FAIL_OPEN;
    delete process.env.RATE_LIMIT_DISABLED;
  });

  afterEach(() => {
    process.env = { ...savedEnv };
    process.env.RATE_LIMIT_KEY_PEPPER = 'test-pepper-32-chars-minimum!!!!';
    resetFetchForTests();
  });

  it('returns 429 when policy bucket over limit', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

    setFetchForTests(async () => ({
      ok: true,
      json: async () => ({ result: 11 }),
    }));

    const result = await enforceRateLimits({
      policyId: 'LOGIN_ADMIN',
      segments: { ip: '203.0.113.1', email: 'a@test.com' },
    });

    assert.equal(result.allowed, false);
    assert.equal(result.statusCode, 429);
    assert.equal(result.reason, 'over_limit');
  });
});

describe('buildRateLimitKey', () => {
  it('never contains raw email in key string', () => {
    const email = 'secret.user@example.com';
    const hash = hashRateLimitSegment(email, 'email');
    const key = buildRateLimitKey({ route: 'login.admin', dimension: 'email', segmentHash: hash });
    assert.doesNotMatch(key, /secret/);
    assert.doesNotMatch(key, /@/);
    assert.match(key, /^ae:rl:v1:login\.admin:email:[a-f0-9]{32}$/);
  });
});

describe('policy env overrides', () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('reads RATE_LIMIT_LOGIN_SCANNER_IP_MAX from env', () => {
    process.env.RATE_LIMIT_LOGIN_SCANNER_IP_MAX = '15';
    const policy = getPolicy('LOGIN_SCANNER');
    const ipBucket = policy.buckets.find((b) => b.dimension === 'ip');
    assert.equal(ipBucket.max, 15);
  });

  it('reads RATE_LIMIT_ORDER_POS_CREATE_OUTLET_MAX from env', () => {
    process.env.RATE_LIMIT_ORDER_POS_CREATE_OUTLET_MAX = '999';
    const policy = getPolicy('ORDER_POS_CREATE');
    const outlet = policy.buckets.find((b) => b.dimension === 'outlet');
    assert.equal(outlet.max, 999);
  });
});
