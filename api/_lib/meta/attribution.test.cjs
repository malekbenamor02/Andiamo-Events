'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  parseRequestCookie,
  resolveMetaFbp,
  resolveMetaFbc,
  buildFbcFromFbclid,
  parseAttributionFromBody,
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
