'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const root = resolve(__dirname, '../..');

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('server.cjs P0 rate-limit parity (PR-1e)', () => {
  const src = read('server.cjs');

  it('imports Vercel handler forward helper', () => {
    assert.match(src, /server-cjs-vercel-forward\.cjs/);
    assert.match(src, /createVercelHandlerForward/);
  });

  const forwards = [
    ["app.post('/api/admin-login', forwardAdminLogin)", './api/admin-login.js'],
    ["app.post('/api/scanner-login', forwardScanApi)", './api/scan.js'],
    ["app.post('/api/send-email', forwardMiscApi)", './api/misc.js'],
    ["app.post('/api/send-sms', forwardMiscApi)", './api/misc.js'],
    ["app.post('/api/admin/bulk-sms/send', forwardMiscApi)", './api/misc.js'],
    ["app.post('/api/admin-resend-ticket-email', forwardMiscApi)", './api/misc.js'],
    ["app.post('/api/resend-order-completion-email', forwardMiscApi)", './api/misc.js'],
    ["app.post('/api/orders/create', forwardOrdersCreate)", './api/orders-create.js'],
  ];

  for (const [routeLine, modulePath] of forwards) {
    it(`delegates ${routeLine}`, () => {
      assert.match(src, new RegExp(routeLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.match(src, new RegExp(modulePath.replace(/\./g, '\\.')));
    });
  }

  it('ambassador login uses shared handler without express authLimiter', () => {
    const idx = src.indexOf("app.post('/api/ambassador-login'");
    assert.ok(idx >= 0);
    const block = src.slice(idx, idx + 200);
    assert.doesNotMatch(block, /authLimiter/);
    assert.match(block, /handleAmbassadorLogin/);
  });

  it('POS and ClicToPay generate delegate to Vercel handlers', () => {
    assert.match(src, /handlePos\(req, res, next\)/);
    assert.match(src, /clictopay-generate-payment\.js/);
    assert.match(src, /forwardClicToPayConfirm/);
  });

  it('academy routes registered via academyRoutes.cjs', () => {
    assert.match(src, /registerAcademyRoutes\(app/);
  });

  it('ticket QR registered via registerStorageSecurityRoutes', () => {
    assert.match(src, /registerStorageSecurityRoutes\(app/);
  });

  it('does not apply express emailLimiter to send-email', () => {
    assert.doesNotMatch(src, /app\.use\('\/api\/send-email', emailLimiter\)/);
  });

  it('does not apply orderCreateLimiter or resendTicketEmailLimiter on P0 routes', () => {
    assert.doesNotMatch(src, /app\.post\('\/api\/orders\/create', orderCreateLimiter/);
    assert.doesNotMatch(src, /resendTicketEmailLimiter, logSecurityRequest/);
    assert.doesNotMatch(src, /app\.post\('\/api\/admin-login', authLimiter/);
    assert.doesNotMatch(src, /app\.post\('\/api\/scanner-login', scannerLoginLimiter/);
  });
});

describe('no active legacy non-atomic Upstash path for P0', () => {
  it('admin-login-upstash.js delegates to shared enforceRateLimits', async () => {
    const mod = await import('./admin-login-upstash.js');
    assert.equal(typeof mod.checkAdminLoginDistributedLimits, 'function');
    const src = read('api/_lib/admin-login-upstash.js');
    assert.match(src, /enforceRateLimits/);
    const stub = await mod.adminLoginUpstashIncr();
    assert.equal(stub.skipped, true);
  });

  it('upstash.cjs uses atomic Lua EVAL only', () => {
    const src = read('api/_lib/rate-limit/upstash.cjs');
    assert.match(src, /\/eval/);
    assert.doesNotMatch(src, /\/incr\b/i);
    assert.doesNotMatch(src, /\/expire\b/i);
  });

  it('admin-login.js does not import legacy upstash module', () => {
    const src = read('api/admin-login.js');
    assert.doesNotMatch(src, /admin-login-upstash/);
  });
});

describe('compatibility wrappers still load', () => {
  it('admin-login-rate-limit.js exports deprecated no-op helpers', async () => {
    const mod = await import('./admin-login-rate-limit.js');
    assert.equal(typeof mod.getAdminLoginClientIp, 'function');
    assert.equal(mod.checkAdminLoginIpRateLimit(), true);
    assert.equal(mod.checkAdminLoginEmailRateLimit(), true);
  });

  it('scanner-login-rate-limit.cjs exports enforceScannerLoginLimits', () => {
    const mod = require('./scanner-login-rate-limit.cjs');
    assert.equal(typeof mod.enforceScannerLoginLimits, 'function');
    assert.equal(typeof mod.respondToRateLimit, 'function');
  });

  it('server-cjs-vercel-forward.cjs loads', () => {
    const mod = require('./server-cjs-vercel-forward.cjs');
    assert.equal(typeof mod.createVercelHandlerForward, 'function');
  });
});

describe('Phase 2 routes not modified in server.cjs PR-1e patch', () => {
  const src = read('server.cjs');

  it('validate-ticket route still present (unwired for Phase 2)', () => {
    assert.match(src, /validate-ticket|scanner\/validate-ticket/);
  });

  it('no QR_TICKET express limiter on /api/tickets/qr (uses ticket-qr-route.cjs)', () => {
    assert.doesNotMatch(src, /app\.(get|use)\('\/api\/tickets\/qr/);
  });
});
