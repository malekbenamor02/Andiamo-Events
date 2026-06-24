'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  parseRequestCookie,
  resolveMetaFbp,
  resolveMetaFbc,
  buildFbcFromFbclid,
  parseAttributionFromBody,
  resolvePurchaseAttribution,
  isUsableClientIp,
  resolveStoredFbc,
} = require('./attribution.cjs');

test('parseRequestCookie reads cookie values', () => {
  const req = { headers: { cookie: '_fbp=fb.1.abc; _fbc=fb.1.123.clid' } };
  assert.strictEqual(parseRequestCookie(req, '_fbp'), 'fb.1.abc');
  assert.strictEqual(parseRequestCookie(req, '_fbc'), 'fb.1.123.clid');
});

test('resolveMetaFbp prefers body then cookie', () => {
  const req = { headers: { cookie: '_fbp=fb.1.from-cookie' } };
  assert.strictEqual(resolveMetaFbp(req, 'fb.1.from-body'), 'fb.1.from-body');
  assert.strictEqual(resolveMetaFbp(req, null), 'fb.1.from-cookie');
});

test('resolveMetaFbc builds from fbclid when cookie and body missing', () => {
  const req = { headers: { cookie: '' } };
  const fbc = resolveMetaFbc(req, null, 'CLICK_ID_X', null);
  assert.ok(fbc);
  assert.ok(fbc.startsWith('fb.1.'));
  assert.ok(fbc.endsWith('.CLICK_ID_X'));
});

test('resolveMetaFbc extracts fbclid from event source URL', () => {
  const req = { headers: {} };
  const fbc = resolveMetaFbc(
    req,
    null,
    null,
    'https://andiamoevents.com/ambassador?fbclid=URL_CLID'
  );
  assert.ok(fbc?.endsWith('.URL_CLID'));
});

test('parseAttributionFromBody merges cookies and request context', () => {
  const req = {
    headers: {
      cookie: '_fbp=fb.1.cookie-fbp',
      'x-forwarded-for': '203.0.113.5',
      'user-agent': 'Mozilla/5.0',
    },
    get: (name) => (name === 'user-agent' ? 'Mozilla/5.0' : undefined),
  };
  const attr = parseAttributionFromBody(req, {
    metaEventId: 'lead_shared_id',
    metaEventSourceUrl: 'https://example.com/ambassador',
  });

  assert.ok(attr);
  assert.strictEqual(attr.eventId, 'lead_shared_id');
  assert.strictEqual(attr.fbp, 'fb.1.cookie-fbp');
  assert.strictEqual(attr.clientIp, '203.0.113.5');
  assert.strictEqual(attr.clientUserAgent, 'Mozilla/5.0');
});

test('buildFbcFromFbclid uses millisecond timestamp', () => {
  assert.strictEqual(buildFbcFromFbclid('ABC', 1700000000000), 'fb.1.1700000000000.ABC');
});

test('parseAttributionFromBody ignores clientIp unknown', () => {
  const req = {
    headers: {
      'x-forwarded-for': 'unknown',
      'user-agent': 'Mozilla/5.0',
    },
    ip: 'unknown',
    socket: { remoteAddress: 'unknown' },
    get: (name) => (name === 'user-agent' ? 'Mozilla/5.0' : undefined),
  };
  const attr = parseAttributionFromBody(req, {});
  assert.ok(attr);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(attr, 'clientIp'), false);
  assert.strictEqual(attr.clientUserAgent, 'Mozilla/5.0');
});

test('parseAttributionFromBody accepts metaFbclid and builds valid fbc', () => {
  const req = { headers: {}, get: () => undefined };
  const attr = parseAttributionFromBody(req, {
    metaEventId: 'purchase_123',
    metaFbclid: 'AD_CLICK_99',
    metaEventSourceUrl: 'https://example.com/event',
  });
  assert.ok(attr);
  assert.strictEqual(attr.eventId, 'purchase_123');
  assert.ok(attr.fbc);
  assert.ok(attr.fbc.startsWith('fb.1.'));
  assert.ok(attr.fbc.endsWith('.AD_CLICK_99'));
});

test('parseAttributionFromBody uses _fbp cookie fallback at order create', () => {
  const req = {
    headers: {
      cookie: '_fbp=fb.1.cookie-only',
      'user-agent': 'Mozilla/5.0',
    },
    get: (name) => (name === 'user-agent' ? 'Mozilla/5.0' : undefined),
  };
  const attr = parseAttributionFromBody(req, { metaEventId: 'purchase_cookie' });
  assert.ok(attr);
  assert.strictEqual(attr.fbp, 'fb.1.cookie-only');
});

test('parseAttributionFromBody uses _fbc cookie fallback at order create', () => {
  const validFbc = 'fb.1.1700000000000.cookieclid';
  const req = {
    headers: {
      cookie: `_fbc=${validFbc}`,
      'user-agent': 'Mozilla/5.0',
    },
    get: (name) => (name === 'user-agent' ? 'Mozilla/5.0' : undefined),
  };
  const attr = parseAttributionFromBody(req, { metaEventId: 'purchase_fbc_cookie' });
  assert.ok(attr);
  assert.strictEqual(attr.fbc, validFbc);
});

test('resolveStoredFbc drops invalid fbc', () => {
  assert.strictEqual(resolveStoredFbc({ fbc: 'fb.2.bad' }), undefined);
  assert.strictEqual(
    resolveStoredFbc({ fbc: 'fb.1.1700000000000.good' }),
    'fb.1.1700000000000.good'
  );
});

test('isUsableClientIp rejects unknown and empty', () => {
  assert.strictEqual(isUsableClientIp('unknown'), false);
  assert.strictEqual(isUsableClientIp(''), false);
  assert.strictEqual(isUsableClientIp('203.0.113.1'), true);
});

test('resolvePurchaseAttribution prefers stored fbp over cookie', () => {
  const req = {
    headers: { cookie: '_fbp=fb.1.from-cookie' },
  };
  const resolved = resolvePurchaseAttribution({ fbp: 'fb.1.stored' }, req);
  assert.strictEqual(resolved.fbp, 'fb.1.stored');
});

