'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const {
  extractPaymentConfirmOrderId,
  extractAcademyConfirmRegistrationId,
  isValidPaymentConfirmOrderId,
  isValidAcademyConfirmRegistrationId,
} = require('./payment-confirm-extract.cjs');
const {
  enforceRateLimits,
  getClientIp,
  setFetchForTests,
  resetFetchForTests,
  hashRateLimitSegment,
  buildRateLimitKey,
} = require('./index.cjs');

const root = resolve(__dirname, '../../..');
function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('payment confirm extract helpers', () => {
  it('extracts orderId from POST body', () => {
    assert.equal(
      extractPaymentConfirmOrderId('POST', { orderId: '550e8400-e29b-41d4-a716-446655440000' }),
      '550e8400-e29b-41d4-a716-446655440000'
    );
    assert.equal(
      extractPaymentConfirmOrderId('POST', { order_id: '550e8400-e29b-41d4-a716-446655440001' }),
      '550e8400-e29b-41d4-a716-446655440001'
    );
  });

  it('extracts orderId from GET query', () => {
    assert.equal(
      extractPaymentConfirmOrderId('GET', {}, '/api/clictopay-confirm-payment?orderId=550e8400-e29b-41d4-a716-446655440000'),
      '550e8400-e29b-41d4-a716-446655440000'
    );
  });

  it('validates UUID format', () => {
    assert.equal(isValidPaymentConfirmOrderId('550e8400-e29b-41d4-a716-446655440000'), true);
    assert.equal(isValidPaymentConfirmOrderId('not-a-uuid'), false);
  });
});

describe('PAYMENT_CONFIRM rate limit behavior', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    process.env.RATE_LIMIT_KEY_PEPPER = 'test-pepper-32-chars-minimum!!!!';
  });

  afterEach(() => {
    process.env = { ...savedEnv };
    resetFetchForTests();
  });

  it('missing orderId: IP bucket only, no order bucket', async () => {
    let evalCalls = 0;
    setFetchForTests(async (_url, init) => {
      evalCalls += 1;
      const body = JSON.parse(String(init.body));
      assert.match(body[3], /^ae:rl:v1:payment\.confirm:ip:/);
      return { ok: true, json: async () => ({ result: 1 }) };
    });

    const req = { headers: {}, socket: { remoteAddress: '203.0.113.10' }, method: 'POST' };
    const ip = getClientIp(req);
    const ipResult = await enforceRateLimits({
      req,
      policyId: 'PAYMENT_CONFIRM',
      segments: { ip },
    });
    assert.equal(ipResult.allowed, true);
    assert.equal(evalCalls, 1);
  });

  it('invalid UUID: order bucket skipped in entrypoint flow', () => {
    const src = read('api/clictopay-confirm-payment.js');
    const invalidIdx = src.indexOf("error: 'invalid_request'");
    const orderRlIdx = src.indexOf('segments: { order: orderId }');
    assert.ok(invalidIdx >= 0);
    assert.ok(orderRlIdx > invalidIdx, '400 returned before order bucket increment');
  });

  it('valid UUID consumes IP + order buckets', async () => {
    const orderId = '550e8400-e29b-41d4-a716-446655440000';
    const dimensions = [];
    setFetchForTests(async (_url, init) => {
      const body = JSON.parse(String(init.body));
      dimensions.push(body[3]);
      return { ok: true, json: async () => ({ result: 1 }) };
    });

    const req = { headers: {}, socket: { remoteAddress: '203.0.113.12' }, method: 'POST' };
    await enforceRateLimits({ req, policyId: 'PAYMENT_CONFIRM', segments: { ip: getClientIp(req) } });
    await enforceRateLimits({ req, policyId: 'PAYMENT_CONFIRM', segments: { order: orderId } });

    assert.equal(dimensions.length, 2);
    assert.match(dimensions[0], /:ip:/);
    assert.match(dimensions[1], /:order:/);
    assert.doesNotMatch(dimensions[1], /550e8400/);
  });

  it('GET and POST share same policy buckets', async () => {
    const policyId = 'PAYMENT_CONFIRM';
    const getId = extractPaymentConfirmOrderId(
      'GET',
      {},
      '/api/clictopay-confirm-payment?orderId=550e8400-e29b-41d4-a716-446655440000'
    );
    const postId = extractPaymentConfirmOrderId('POST', {
      orderId: '550e8400-e29b-41d4-a716-446655440000',
    });
    assert.equal(getId, postId);
    assert.equal(isValidPaymentConfirmOrderId(getId), true);
  });
});

describe('PAYMENT_ACADEMY_CONFIRM malformed/valid registrationId', () => {
  it('missing registrationId fails validation without order bucket semantics', () => {
    assert.equal(extractAcademyConfirmRegistrationId('POST', {}), null);
    assert.equal(isValidAcademyConfirmRegistrationId(null), false);
  });

  it('invalid registration UUID rejected', () => {
    assert.equal(isValidAcademyConfirmRegistrationId('bad-id'), false);
  });

  it('valid registration UUID accepted', () => {
    assert.equal(
      isValidAcademyConfirmRegistrationId('550e8400-e29b-41d4-a716-446655440000'),
      true
    );
  });
});

describe('PAYMENT_GENERATE rate limit', () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
    resetFetchForTests();
  });

  it('returns 429 before service-role when over limit', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    process.env.RATE_LIMIT_KEY_PEPPER = 'test-pepper-32-chars-minimum!!!!';

    setFetchForTests(async () => ({
      ok: true,
      json: async () => ({ result: 21 }),
    }));

    const req = { headers: {}, socket: { remoteAddress: '203.0.113.50' }, method: 'POST' };
    const result = await enforceRateLimits({
      req,
      policyId: 'PAYMENT_GENERATE',
      segments: {
        ip: getClientIp(req),
        order: '550e8400-e29b-41d4-a716-446655440000',
      },
    });
    assert.equal(result.allowed, false);
    assert.equal(result.statusCode, 429);

    const src = read('api/clictopay-generate-payment.js');
    const handlerStart = src.indexOf('export default async function handler');
    const handler = src.slice(handlerStart);
    const rlIdx = handler.indexOf("policyId: 'PAYMENT_GENERATE'");
    const dbIdx = handler.indexOf('let dbClient');
    assert.ok(rlIdx >= 0);
    assert.ok(rlIdx < dbIdx);
  });
});

describe('payment confirm entrypoint wiring', () => {
  it('clictopay-confirm-payment.js enforces IP before parse and order after UUID validation', () => {
    const src = read('api/clictopay-confirm-payment.js');
    const handlerStart = src.indexOf('export default async function handler');
    const handler = src.slice(handlerStart);
    const ipIdx = handler.indexOf('segments: { ip: clientIp }');
    const parseIdx = handler.indexOf('extractPaymentConfirmOrderId');
    const invalidIdx = handler.indexOf("error: 'invalid_request'");
    const orderRlIdx = handler.indexOf('segments: { order: orderId }');
    const handlerIdx = handler.indexOf('handleClicToPayConfirmPayment');

    assert.ok(ipIdx >= 0);
    assert.ok(ipIdx < parseIdx, 'IP RL before parse');
    assert.ok(invalidIdx < orderRlIdx, '400 before order bucket');
    assert.ok(orderRlIdx < handlerIdx, 'order RL before handler delegate');
  });

  it('inner confirm handler has no duplicate rate limit enforcement', () => {
    const src = read('api/_lib/clictopay-confirm-payment.cjs');
    assert.doesNotMatch(src, /enforceRateLimits/);
    assert.match(src, /validatedOrderId/);
  });

  it('clictopay-generate-payment.js RL before createServiceRoleClient', () => {
    const src = read('api/clictopay-generate-payment.js');
    const handlerStart = src.indexOf('export default async function handler');
    const handler = src.slice(handlerStart);
    const rlIdx = handler.indexOf("policyId: 'PAYMENT_GENERATE'");
    const dbIdx = handler.indexOf('let dbClient');
    assert.ok(rlIdx >= 0);
    assert.ok(rlIdx < dbIdx);
  });

  it('academyRoutes confirm uses IP-first then registration bucket', () => {
    const src = read('academyRoutes.cjs');
    const start = src.indexOf("app.post('/api/academy/clictopay-confirm-payment'");
    const block = src.slice(start, start + 1200);
    assert.match(block, /PAYMENT_ACADEMY_CONFIRM/);
    assert.match(block, /invalid_request/);
    assert.match(block, /segments: \{ registration: registrationId \}/);
  });

  it('redis keys for payment do not contain raw UUID', () => {
    process.env.RATE_LIMIT_KEY_PEPPER = 'test-pepper-32-chars-minimum!!!!';
    const orderId = '550e8400-e29b-41d4-a716-446655440000';
    const key = buildRateLimitKey({
      route: 'payment.confirm',
      dimension: 'order',
      segmentHash: hashRateLimitSegment(orderId, 'order'),
    });
    assert.doesNotMatch(key, /550e8400/);
  });
});
