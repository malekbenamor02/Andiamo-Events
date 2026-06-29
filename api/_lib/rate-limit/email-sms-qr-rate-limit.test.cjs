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
} = require('./index.cjs');

const root = resolve(__dirname, '../../..');
function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

function routeBlock(src, marker, span = 2000) {
  const start = src.indexOf(marker);
  assert.ok(start >= 0, `${marker} not found`);
  return src.slice(start, start + span);
}

describe('email/SMS/resend rate limit wiring (misc.js)', () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
    resetFetchForTests();
  });

  it('send-email: RL before sendTransactionalEmail / nodemailer transport', () => {
    const src = read('api/misc.js');
    const start = src.indexOf("if (path === '/api/send-email' && method === 'POST')");
    const end = src.indexOf('// ============================================', start + 1);
    const block = src.slice(start, end > start ? end : start + 5000);
    const authIdx = block.indexOf('gateAdminPermission');
    const rlIdx = block.indexOf("policyId: 'EMAIL_SEND'");
    const sendIdx = block.indexOf('sendTransactionalEmail');
    assert.ok(authIdx >= 0 && authIdx < rlIdx, 'auth before EMAIL_SEND RL');
    assert.ok(rlIdx < sendIdx, 'EMAIL_SEND RL before provider send');
    assert.match(block, /recipient:/);
    assert.match(block, /admin:/);
  });

  it('send-email: 429 before SMTP when over limit', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    process.env.RATE_LIMIT_KEY_PEPPER = 'test-pepper-32-chars-minimum!!!!';

    setFetchForTests(async () => ({
      ok: true,
      json: async () => ({ result: 4 }),
    }));

    const result = await enforceRateLimits({
      req: { headers: {}, socket: { remoteAddress: '10.0.0.1' }, method: 'POST' },
      policyId: 'EMAIL_SEND',
      segments: {
        admin: '11111111-1111-4111-8111-111111111111',
        recipient: 'user@example.com',
      },
    });
    assert.equal(result.allowed, false);
    assert.equal(result.statusCode, 429);
  });

  it('send-sms: RL before sendSms / batch loop', () => {
    const src = read('api/misc.js');
    const start = src.indexOf("if (path === '/api/send-sms' && method === 'POST')");
    const end = src.indexOf('// ============================================', start + 1);
    const block = src.slice(start, end > start ? end : start + 5000);
    const authIdx = block.indexOf('verifyAdminAuth');
    const rlIdx = block.indexOf("policyId: 'SMS_SEND'");
    const sendIdx = block.indexOf('sendSms(formattedNumber');
    assert.ok(authIdx >= 0 && authIdx < rlIdx, 'auth before SMS_SEND RL');
    assert.ok(rlIdx < sendIdx, 'SMS_SEND RL before provider call');
  });

  it('bulk-sms: admin + IP RL before batch processing', () => {
    const block = routeBlock(read('api/misc.js'), "path === '/api/admin/bulk-sms/send'", 2500);
    const authIdx = block.indexOf('verifyAdminAuth');
    const rlIdx = block.indexOf("policyId: 'SMS_BULK'");
    const batchIdx = block.indexOf('for (const phoneData of phoneNumbers)');
    assert.ok(authIdx >= 0 && authIdx < rlIdx, 'auth before SMS_BULK RL');
    assert.ok(rlIdx < batchIdx, 'SMS_BULK RL before batch loop');
    assert.match(block.slice(rlIdx, rlIdx + 300), /ip: getClientIp\(req\)/);
  });

  it('resend-ticket-email: auth, UUID, email load, RL before full order pipeline', () => {
    const block = routeBlock(
      read('api/misc.js'),
      "path === '/api/admin-resend-ticket-email'",
      3500
    );
    const authIdx = block.indexOf('gateAdminPermission');
    const uuidIdx = block.indexOf('isValidUuid(orderId)');
    const emailFetchIdx = block.indexOf("select('id, user_email')");
    const rlIdx = block.indexOf("policyId: 'EMAIL_RESEND_TICKET'");
    const fullFetchIdx = block.indexOf('Step 1: Verify order exists');
    assert.ok(authIdx < uuidIdx, 'auth before UUID validation');
    assert.ok(uuidIdx < emailFetchIdx, 'UUID validation before email fetch');
    assert.ok(emailFetchIdx < rlIdx, 'email fetch before RL');
    assert.ok(rlIdx < fullFetchIdx, 'RL before full order fetch');
  });

  it('resend-order-completion-email shares EMAIL_RESEND_TICKET path', () => {
    const src = read('api/misc.js');
    assert.match(
      src,
      /path === '\/api\/admin-resend-ticket-email' \|\| path === '\/api\/resend-order-completion-email'/
    );
    assert.match(src, /EMAIL_RESEND_TICKET/);
  });

  it('no raw recipient email, phone, or orderId in redis keys', () => {
    process.env.RATE_LIMIT_KEY_PEPPER = 'test-pepper-32-chars-minimum!!!!';
    const email = 'secret.recipient@example.com';
    const orderId = '22222222-2222-4222-8222-222222222222';
    const adminId = '33333333-3333-4333-8333-333333333333';

    for (const [route, dimension, segment] of [
      ['email.send', 'recipient', email],
      ['email.resend.ticket', 'order', orderId],
      ['email.resend.ticket', 'recipient', email],
      ['email.resend.ticket', 'admin', adminId],
    ]) {
      const key = buildRateLimitKey({
        route,
        dimension,
        segmentHash: hashRateLimitSegment(segment, dimension),
      });
      assert.doesNotMatch(key, /secret\.recipient/);
      assert.doesNotMatch(key, /22222222-2222-4222-8222-222222222222/);
      assert.doesNotMatch(key, /@/);
    }
  });
});

describe('QR ticket rate limit wiring (ticket-qr-route.cjs)', () => {
  const savedEnv = { ...process.env };
  const VALID_TOKEN = '11111111-1111-4111-8111-111111111111';

  afterEach(() => {
    process.env = { ...savedEnv };
    resetFetchForTests();
  });

  it('invalid token returns 400 without rateByIp Map or token RL', () => {
    const src = read('api/_lib/ticket-qr-route.cjs');
    assert.doesNotMatch(src, /rateByIp/);
    assert.doesNotMatch(src, /checkRateLimit/);
    const handler = src.slice(src.indexOf('async function handleTicketQrRequest'));
    const invalidIdx = handler.indexOf("sendJson(res, 400, { error: 'Invalid token' })");
    const rlIdx = handler.indexOf("policyId: 'QR_TICKET'");
    const dbIdx = handler.indexOf('findActiveTicketByToken');
    assert.ok(invalidIdx >= 0);
    assert.ok(invalidIdx < rlIdx, '400 before QR_TICKET RL on invalid token');
    assert.ok(rlIdx < dbIdx, 'RL before DB lookup on valid path');
  });

  it('valid token: IP + token buckets before DB lookup', () => {
    const handler = read('api/_lib/ticket-qr-route.cjs').slice(
      read('api/_lib/ticket-qr-route.cjs').indexOf('async function handleTicketQrRequest')
    );
    const rlIdx = handler.indexOf("policyId: 'QR_TICKET'");
    const getDbIdx = handler.indexOf('getServiceDb ===');
    const dbLookupIdx = handler.indexOf('findActiveTicketByToken');
    assert.ok(rlIdx < getDbIdx, 'RL before getServiceDb call');
    assert.ok(getDbIdx < dbLookupIdx, 'service db after RL');
  });

  it('over-limit returns 429 before DB lookup (gate pattern)', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    process.env.RATE_LIMIT_KEY_PEPPER = 'test-pepper-32-chars-minimum!!!!';

    setFetchForTests(async () => ({
      ok: true,
      json: async () => ({ result: 61 }),
    }));

    let dbLookupCalled = false;
    const rl = await enforceRateLimits({
      req: { headers: {}, socket: { remoteAddress: '203.0.113.44' }, method: 'GET' },
      policyId: 'QR_TICKET',
      segments: { ip: '203.0.113.44', token: VALID_TOKEN },
    });

    if (rl.allowed) {
      dbLookupCalled = true;
    }

    assert.equal(rl.allowed, false);
    assert.equal(rl.statusCode, 429);
    assert.equal(dbLookupCalled, false);
  });

  it('no raw secure_token in redis keys', () => {
    process.env.RATE_LIMIT_KEY_PEPPER = 'test-pepper-32-chars-minimum!!!!';
    const key = buildRateLimitKey({
      route: 'qr.ticket',
      dimension: 'token',
      segmentHash: hashRateLimitSegment(VALID_TOKEN, 'token'),
    });
    assert.doesNotMatch(key, /11111111-1111-4111-8111-111111111111/);
  });

  it('registerTicketQrRoute defers getServiceDb until after validation + RL', () => {
    const src = read('api/_lib/ticket-qr-route.cjs');
    const registerBlock = src.slice(src.indexOf('function registerTicketQrRoute'));
    assert.doesNotMatch(registerBlock, /getServiceDb\(\)/);
    assert.match(registerBlock, /handleTicketQrRequest\(req, res, getServiceDb\)/);
  });
});

describe('PR-1d out-of-scope routes untouched', () => {
  it('misc.js payment and order routes not modified for PR-1d policies', () => {
    const src = read('api/misc.js');
    assert.doesNotMatch(src, /PAYMENT_GENERATE/);
    assert.doesNotMatch(src, /ORDER_CREATE/);
    assert.doesNotMatch(src, /ORDER_AMBASSADOR_ACTION/);
    assert.doesNotMatch(src, /ORDER_POS_CREATE/);
  });
});
