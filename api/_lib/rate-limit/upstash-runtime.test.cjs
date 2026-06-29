'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  getEnvPresence,
  isUrlShapeValid,
  categorizeUpstashError,
  logRateLimitRedisFailure,
} = require('./upstash-diagnostics.cjs');
const {
  setFetchForTests,
  resetFetchForTests,
  incrFixedWindow,
  buildEvalBody,
  parseEvalCount,
} = require('./upstash.cjs');
const { enforceRateLimits } = require('./enforce.cjs');

describe('upstash diagnostics', () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
    resetFetchForTests();
  });

  it('getEnvPresence returns booleans only', () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://eu1-example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'tok';
    const p = getEnvPresence();
    assert.equal(typeof p.upstash_url_set, 'boolean');
    assert.equal(typeof p.upstash_token_set, 'boolean');
    assert.equal(typeof p.url_shape_valid, 'boolean');
    assert.equal(p.upstash_url_set, true);
    assert.equal(p.url_shape_valid, true);
  });

  it('isUrlShapeValid rejects non-https without printing URL', () => {
    assert.equal(isUrlShapeValid('http://bad.example'), false);
    assert.equal(isUrlShapeValid('not-a-url'), false);
    assert.equal(isUrlShapeValid('https://valid.upstash.io'), true);
  });

  it('categorizeUpstashError maps 401 to redis_auth_failed', () => {
    const envPresence = {
      upstash_url_set: true,
      upstash_token_set: true,
      url_shape_valid: true,
    };
    assert.equal(
      categorizeUpstashError({ httpStatus: 401, envPresence }),
      'redis_auth_failed'
    );
  });

  it('buildEvalBody starts with EVAL command', () => {
    const body = JSON.parse(buildEvalBody('ae:rl:v1:test', 60));
    assert.equal(body[0], 'EVAL');
    assert.match(body[1], /INCR/);
    assert.equal(body[2], 1);
    assert.equal(body[3], 'ae:rl:v1:test');
    assert.equal(body[4], '60');
  });

  it('parseEvalCount accepts string results from Upstash', () => {
    assert.equal(parseEvalCount({ result: '3' }), 3);
    assert.equal(parseEvalCount({ result: 2 }), 2);
    assert.equal(Number.isNaN(parseEvalCount({ result: null })), true);
  });

  it('incrFixedWindow fail-closed on missing env', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const res = await incrFixedWindow('k', 5, 60, { onRedisMissing: 'fail-closed' });
    assert.equal(res.allowed, false);
    assert.equal(res.reason, 'redis_missing');
    assert.equal(res.errorCategory, 'missing_env');
  });

  it('incrFixedWindow fail-closed on non-2xx with category', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    setFetchForTests(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: 'WRONGPASS invalid password' }),
    }));
    const res = await incrFixedWindow('k', 5, 60, { onRedisError: 'fail-closed' });
    assert.equal(res.allowed, false);
    assert.equal(res.errorCategory, 'redis_auth_failed');
    assert.equal(res.httpStatus, 401);
  });

  it('incrFixedWindow proceeds on success', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    setFetchForTests(async (url, init) => {
      assert.equal(url, 'https://example.upstash.io');
      const body = JSON.parse(String(init.body));
      assert.equal(body[0], 'EVAL');
      return { ok: true, status: 200, json: async () => ({ result: 1 }) };
    });
    const res = await incrFixedWindow('k', 5, 60);
    assert.equal(res.allowed, true);
    assert.equal(res.count, 1);
  });

  it('enforceRateLimits returns 503 when redis fails', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    process.env.RATE_LIMIT_KEY_PEPPER = 'test-pepper-32-chars-minimum!!!!';
    delete process.env.RATE_LIMIT_GLOBAL_FAIL_OPEN;
    delete process.env.RATE_LIMIT_DISABLED;
    setFetchForTests(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'ERR internal' }),
    }));
    const result = await enforceRateLimits({
      policyId: 'LOGIN_ADMIN',
      segments: { ip: '203.0.113.1' },
    });
    assert.equal(result.allowed, false);
    assert.equal(result.statusCode, 503);
  });

  it('logRateLimitRedisFailure does not include secrets', () => {
    const lines = [];
    const orig = console.error;
    console.error = (...args) => lines.push(args.join(' '));
    try {
      logRateLimitRedisFailure({
        route: 'payment.confirm',
        policyId: 'PAYMENT_CONFIRM',
        dimension: 'ip',
        category: 'redis_auth_failed',
        httpStatus: 401,
      });
    } finally {
      console.error = orig;
    }
    const text = lines.join(' ');
    assert.match(text, /redis unavailable/);
    assert.doesNotMatch(text, /Bearer/);
    assert.doesNotMatch(text, /UPSTASH/);
  });
});

describe('ticket-qr invalid token handler', () => {
  it('handleTicketQrRequest returns 400 for badtoken without throwing', async () => {
    const { handleTicketQrRequest } = require('../ticket-qr-route.cjs');
    const res = {
      statusCode: 0,
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      end(body) {
        this.body = body;
      },
    };
    await handleTicketQrRequest(
      { method: 'GET', url: '/api/tickets/qr/badtoken', headers: {} },
      res,
      null
    );
    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.error, 'Invalid token');
    assert.doesNotMatch(JSON.stringify(body), /badtoken/);
  });
});
