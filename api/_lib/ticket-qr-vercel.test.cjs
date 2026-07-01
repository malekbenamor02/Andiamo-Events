'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function rawRes() {
  return {
    statusCode: 0,
    headersSent: false,
    headers: {},
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    end(body) {
      this.body = body;
      this.headersSent = true;
    },
  };
}

function expressRes() {
  const r = rawRes();
  r.status = (code) => {
    r.statusCode = code;
    return r;
  };
  r.json = (body) => {
    r.body = JSON.stringify(body);
    r.headersSent = true;
    return r;
  };
  return r;
}

describe('ticket-qr Vercel routing', () => {
  it('vercel.json routes QR to dedicated function, not misc.js', () => {
    const cfg = JSON.parse(read('vercel.json'));
    const rule = cfg.rewrites.find((r) => r.source === '/api/tickets/qr/:secureToken');
    assert.ok(rule);
    assert.equal(rule.destination, '/api/tickets/qr/[secureToken]');
    assert.notEqual(rule.destination, '/api/misc.js');
  });

  it('dedicated entrypoint file exists', () => {
    assert.ok(fs.existsSync(path.join(ROOT, 'api/tickets/qr/[secureToken].js')));
  });

  it('entrypoint documents misc.js rewrite pitfall', () => {
    const src = read('api/tickets/qr/[secureToken].js');
    assert.match(src, /do not route through misc\.js rewrite/i);
    assert.match(src, /handleTicketQrRequest/);
  });
});

describe('ticket-qr invalid token regressions', () => {
  let generateCalls = 0;

  beforeEach(() => {
    generateCalls = 0;
  });

  afterEach(() => {
    delete require.cache[require.resolve('./ticket-qr-route.cjs')];
    delete require.cache[require.resolve('./ticket-qr-generate.cjs')];
  });

  it('raw Vercel res: badtoken → 400, no QR generation', async () => {
    const mod = require('./ticket-qr-route.cjs');
    const res = rawRes();
    await mod.handleTicketQrRequest(
      { method: 'GET', query: { secureToken: 'badtoken' }, headers: {} },
      res,
      null
    );
    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.error, 'Invalid token');
    assert.doesNotMatch(JSON.stringify(body), /badtoken/i);
  });

  it('Express res: badtoken → 400, no QR generation', async () => {
    const mod = require('./ticket-qr-route.cjs');
    const res = expressRes();
    await mod.handleTicketQrRequest(
      { method: 'GET', params: { secureToken: 'badtoken' }, headers: {} },
      res,
      null
    );
    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.error, 'Invalid token');
  });

  it('valid UUID shape with no DB row returns 404 before QR generation', async () => {
    const { setFetchForTests, resetFetchForTests } = require('./rate-limit/upstash.cjs');
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    setFetchForTests(async () => ({ ok: true, json: async () => ({ result: 1 }) }));
    const mockDb = {
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({ data: null }),
        };
      },
    };
    try {
      const token = '00000000-0000-4000-8000-000000000001';
      const mod = require('./ticket-qr-route.cjs');
      const res = rawRes();
      await mod.handleTicketQrRequest(
        { method: 'GET', query: { secureToken: token }, headers: {} },
        res,
        () => mockDb
      );
      assert.equal(res.statusCode, 404);
      const body = JSON.parse(res.body);
      assert.equal(body.error, 'Not found');
      assert.doesNotMatch(JSON.stringify(body), /00000000/);
    } finally {
      resetFetchForTests();
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
    }
  });

  it('sendJson falls back to raw end when express json throws', async () => {
    const mod = require('./ticket-qr-route.cjs');
    const res = {
      statusCode: 0,
      headersSent: false,
      headers: {},
      status() {
        return {
          json() {
            throw new Error('express json broken');
          },
        };
      },
      setHeader(k, v) {
        this.headers[k.toLowerCase()] = v;
      },
      end(body) {
        this.body = body;
        this.headersSent = true;
      },
    };
    await mod.handleTicketQrRequest(
      { method: 'GET', url: '/api/tickets/qr/not-a-uuid', headers: {} },
      res,
      null
    );
    assert.equal(res.statusCode, 400);
    assert.equal(JSON.parse(res.body).error, 'Invalid token');
  });
});
