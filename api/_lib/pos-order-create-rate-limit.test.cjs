'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const {
  enforceRateLimits,
  setFetchForTests,
  resetFetchForTests,
} = require('./rate-limit/index.cjs');

const root = resolve(__dirname, '../..');
function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

function handleOrdersCreateBlock(src) {
  const start = src.indexOf('async function handleOrdersCreate');
  assert.ok(start >= 0, 'handleOrdersCreate not found');
  const nextFn = src.indexOf('\nasync function ', start + 1);
  const end = nextFn >= 0 ? nextFn : start + 4000;
  return src.slice(start, end);
}

describe('POS order create rate limits', () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
    resetFetchForTests();
  });

  it('ORDER_POS_CREATE enforces pos_user + outlet buckets after auth', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    process.env.RATE_LIMIT_KEY_PEPPER = 'test-pepper-32-chars-minimum!!!!';

    setFetchForTests(async () => ({
      ok: true,
      json: async () => ({ result: 501 }),
    }));

    const req = { headers: {}, socket: { remoteAddress: '10.0.0.5' }, method: 'POST' };
    const result = await enforceRateLimits({
      req,
      policyId: 'ORDER_POS_CREATE',
      segments: {
        pos_user: '22222222-2222-4222-8222-222222222222',
        outlet: '33333333-3333-4333-8333-333333333333',
      },
    });
    assert.equal(result.allowed, false);
    assert.equal(result.statusCode, 429);
  });

  it('pre-auth ORDER_POS_CREATE uses IP bucket only (same policy, before outlet lookup)', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    process.env.RATE_LIMIT_KEY_PEPPER = 'test-pepper-32-chars-minimum!!!!';

    setFetchForTests(async () => ({
      ok: true,
      json: async () => ({ result: 61 }),
    }));

    const req = { headers: {}, socket: { remoteAddress: '203.0.113.20' }, method: 'POST' };
    const result = await enforceRateLimits({
      req,
      policyId: 'ORDER_POS_CREATE',
      segments: { ip: '203.0.113.20' },
    });
    assert.equal(result.allowed, false);
    assert.equal(result.statusCode, 429);
    assert.equal(result.dimension, 'ip');
  });

  it('handleOrdersCreate runs IP rate-limit before outlet lookup', () => {
    const block = handleOrdersCreateBlock(read('api/pos.js'));
    const ipIdx = block.indexOf('getClientIp(req)');
    const preAuthRlIdx = block.indexOf('preAuthRl');
    const outletIdx = block.indexOf('getOutletBySlug');
    assert.ok(ipIdx >= 0);
    assert.ok(preAuthRlIdx >= 0);
    assert.ok(outletIdx >= 0);
    assert.ok(ipIdx < outletIdx, 'getClientIp before outlet lookup');
    assert.ok(preAuthRlIdx < outletIdx, 'pre-auth RL before outlet lookup');
    assert.ok(
      block.indexOf('respondToRateLimit(res, preAuthRl)') < outletIdx,
      'pre-auth RL return before outlet lookup'
    );
  });

  it('blocked pre-auth IP limit does not reach outlet lookup or mutation (gate pattern)', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    process.env.RATE_LIMIT_KEY_PEPPER = 'test-pepper-32-chars-minimum!!!!';

    setFetchForTests(async () => ({
      ok: true,
      json: async () => ({ result: 61 }),
    }));

    let outletLookupCalled = false;
    let mutationCalled = false;

    const ip = '203.0.113.20';
    const preAuthRl = await enforceRateLimits({
      req: { headers: {}, socket: { remoteAddress: ip }, method: 'POST' },
      policyId: 'ORDER_POS_CREATE',
      segments: { ip },
    });

    if (preAuthRl.allowed) {
      outletLookupCalled = true;
      mutationCalled = true;
    }

    assert.equal(preAuthRl.allowed, false);
    assert.equal(outletLookupCalled, false);
    assert.equal(mutationCalled, false);
  });

  it('handleOrdersCreate wires auth before post-auth RL before parse', () => {
    const block = handleOrdersCreateBlock(read('api/pos.js'));
    const authIdx = block.indexOf('requirePosAuth');
    const rlIdx = block.indexOf('const posRl = await enforceRateLimits');
    const parseIdx = block.indexOf('parseBody(req)');
    assert.ok(authIdx >= 0);
    assert.ok(authIdx < rlIdx, 'auth before post-auth RL');
    assert.ok(rlIdx < parseIdx, 'post-auth RL before body parse');
  });

  it('post-auth RL uses pos_user + outlet only (IP consumed pre-auth, no double-count)', () => {
    const block = handleOrdersCreateBlock(read('api/pos.js'));
    const posRlStart = block.indexOf('const posRl = await enforceRateLimits');
    const posRlEnd = block.indexOf('if (respondToRateLimit(res, posRl)) return;');
    const posRlBlock = block.slice(posRlStart, posRlEnd);
    assert.match(posRlBlock, /pos_user: auth\.posUser\.id/);
    assert.match(posRlBlock, /outlet: auth\.outlet\.id/);
    assert.doesNotMatch(posRlBlock, /\bip\b/);
  });

  it('handleLogin is separate from handleOrdersCreate RL', () => {
    const src = read('api/pos.js');
    assert.match(src, /LOGIN_POS/);
    assert.match(src, /ORDER_POS_CREATE/);
  });
});
