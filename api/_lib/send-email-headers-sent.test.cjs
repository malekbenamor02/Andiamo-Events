'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const root = resolve(__dirname, '../..');

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

function blockBetween(src, startMarker, endMarker, maxLen = 4000) {
  const start = src.indexOf(startMarker);
  assert.ok(start >= 0, `missing marker: ${startMarker}`);
  const end = endMarker ? src.indexOf(endMarker, start + startMarker.length) : -1;
  return src.slice(start, end > start ? end : start + maxLen);
}

/**
 * Mock response that throws ERR_HTTP_HEADERS_SENT when mutating after body send.
 */
function createStrictResponseMock() {
  const events = [];
  let headersSent = false;

  const res = {
    get headersSent() {
      return headersSent;
    },
    setHeader(name, value) {
      if (headersSent) {
        const err = new Error('Cannot set headers after they are sent to the client');
        err.code = 'ERR_HTTP_HEADERS_SENT';
        throw err;
      }
      events.push({ type: 'setHeader', name, value });
    },
    status(code) {
      if (headersSent) {
        const err = new Error('Cannot set headers after they are sent to the client');
        err.code = 'ERR_HTTP_HEADERS_SENT';
        throw err;
      }
      res.statusCode = code;
      events.push({ type: 'status', code });
      return res;
    },
    json(body) {
      if (headersSent) {
        const err = new Error('Cannot set headers after they are sent to the client');
        err.code = 'ERR_HTTP_HEADERS_SENT';
        throw err;
      }
      headersSent = true;
      res.body = body;
      events.push({ type: 'json', body });
      return res;
    },
    events,
  };

  return res;
}

describe('gateAdminPermission — cookie before response', () => {
  it('clears admin cookie before json when token is missing', async () => {
    const res = createStrictResponseMock();
    const { gateAdminPermission } = await import('./admin-permission-gate-http.js');

    const result = await gateAdminPermission({ headers: {} }, res, 'marketing:manage');

    assert.equal(result, null);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.valid, false);

    const setCookieIdx = res.events.findIndex(
      (e) => e.type === 'setHeader' && e.name === 'Set-Cookie'
    );
    const jsonIdx = res.events.findIndex((e) => e.type === 'json');
    assert.ok(setCookieIdx >= 0, 'Set-Cookie must be applied');
    assert.ok(jsonIdx > setCookieIdx, 'json must follow Set-Cookie');
    assert.equal(res.events.filter((e) => e.type === 'json').length, 1);
  });
});

describe('/api/send-email route — no double response', () => {
  const misc = read('api/misc.js');
  const sendEmailBlock = blockBetween(
    misc,
    "path === '/api/send-email'",
    '// Admin Events CRUD',
    8000
  );

  it('does not call applyClearAdminTokenCookie after gateAdminPermission', () => {
    assert.match(sendEmailBlock, /gateAdminPermission\(req, res, 'marketing:manage'\)/);
    assert.doesNotMatch(
      sendEmailBlock,
      /if \(!authResult\)[\s\S]*applyClearAdminTokenCookie/
    );
    assert.match(sendEmailBlock, /if \(!authResult\) return;/);
  });

  it('success path sends exactly one json response', () => {
    assert.match(sendEmailBlock, /return res\.status\(200\)\.json\(\{ success: true \}\)/);
    const jsonReturns = (sendEmailBlock.match(/\breturn res\.status\(\d+\)\.json/g) || []).length;
    assert.ok(jsonReturns >= 1);
  });

  it('failure catch guards against headers already sent', () => {
    assert.match(sendEmailBlock, /Email sending failed/);
    assert.match(sendEmailBlock, /if \(res\.headersSent\)/);
    assert.match(sendEmailBlock, /return res\.status\(500\)\.json/);
  });
});

describe('applyClearAdminTokenCookie', () => {
  it('sets Set-Cookie before any json on strict mock', async () => {
    const res = createStrictResponseMock();
    const { applyClearAdminTokenCookie } = await import('./clear-admin-token-cookie.js');

    applyClearAdminTokenCookie(res);
    res.status(401).json({ valid: false });

    const setCookieIdx = res.events.findIndex(
      (e) => e.type === 'setHeader' && e.name === 'Set-Cookie'
    );
    const jsonIdx = res.events.findIndex((e) => e.type === 'json');
    assert.ok(setCookieIdx >= 0);
    assert.ok(jsonIdx > setCookieIdx);
    assert.match(res.events[setCookieIdx].value, /adminToken=/);
  });

  it('throws ERR_HTTP_HEADERS_SENT when called after json (reproduces production bug)', async () => {
    const res = createStrictResponseMock();
    const { applyClearAdminTokenCookie } = await import('./clear-admin-token-cookie.js');

    res.status(401).json({ valid: false });

    assert.throws(
      () => applyClearAdminTokenCookie(res),
      (err) => err.code === 'ERR_HTTP_HEADERS_SENT'
    );
  });
});

describe('misc.js outer catch — defensive guard', () => {
  it('checks res.headersSent before sending 500', () => {
    const misc = read('api/misc.js');
    const outerCatch = misc.slice(misc.lastIndexOf('} catch (error) {'));
    assert.match(outerCatch, /API Router Error/);
    assert.match(outerCatch, /if \(res\.headersSent\)/);
  });
});
