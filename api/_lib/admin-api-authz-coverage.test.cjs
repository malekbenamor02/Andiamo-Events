'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const root = resolve(__dirname, '../..');

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

function blockBetween(src, startMarker, endMarker, maxLen = 6000) {
  const start = src.indexOf(startMarker);
  assert.ok(start >= 0, `missing marker: ${startMarker}`);
  const end = endMarker ? src.indexOf(endMarker, start + startMarker.length) : -1;
  return src.slice(start, end > start ? end : start + maxLen);
}

describe('critical Vercel handlers exist in misc dispatch', () => {
  const misc = read('api/misc.js');
  const missing = read('api/_lib/admin-missing-routes-http.js');

  it('misc imports and dispatches handleAdminMissingRoutes', () => {
    assert.match(misc, /handleAdminMissingRoutes/);
    assert.match(misc, /admin-missing-routes-http\.js/);
  });

  for (const route of [
    '/api/admin/cancel-order',
    '/api/admin/reject-order',
    '/api/admin/payment-options',
    '/api/admin/ambassador-sales/overview',
    '/api/admin/ambassador-sales/logs',
  ]) {
    it(`missing routes module handles ${route}`, () => {
      assert.match(missing, new RegExp(route.replace(/\//g, '\\/')));
      assert.match(missing, /gateAdminPermission|verifyAdminAuth/);
    });
  }

  it('cancel-order uses orders:manage before createAdminDbClient', () => {
    const block = blockBetween(missing, 'async function handleAdminCancelOrder', 'async function handleAdminRejectOrder');
    const gateIdx = block.indexOf("gateAdminPermission(req, res, 'orders:manage')");
    const dbIdx = block.indexOf('await createAdminDbClient(res)');
    assert.ok(gateIdx >= 0 && dbIdx > gateIdx);
  });

  it('payment-options PUT uses settings:manage', () => {
    const block = blockBetween(missing, 'async function handleAdminPaymentOptionsPut', 'async function handleAmbassadorSalesOverview');
    assert.match(block, /gateAdminPermission\(req, res, 'settings:manage'\)/);
  });

  it('payment-options GET uses settings:manage before createAdminDbClient', () => {
    const block = blockBetween(missing, 'async function handleAdminPaymentOptionsGet', 'async function handleAdminPaymentOptionsPut');
    const gateIdx = block.indexOf("gateAdminPermission(req, res, 'settings:manage')");
    const dbIdx = block.indexOf('await createAdminDbClient(res)');
    assert.ok(gateIdx >= 0 && dbIdx > gateIdx);
  });
});

describe('misc.js inline admin routes — effective permission gates', () => {
  const misc = read('api/misc.js');

  const routes = [
    ["path === '/api/send-email'", 'marketing:manage'],
    ["path === '/api/admin/events'", 'events:manage'],
    ["path === '/api/admin/passes/create'", 'events:manage'],
    ["path.startsWith('/api/admin/passes/') && method === 'GET'", 'events:manage'],
    ["path.endsWith('/stock')", 'events:manage'],
    ["'/api/admin-skip-ambassador-confirmation'", 'orders:manage'],
    ["'/api/admin/update-order-email'", 'orders:manage'],
    ["'/api/admin/update-order-notes'", 'orders:manage'],
    ['admin-resend-ticket-email', 'orders:manage'],
    ["'/api/admin-remove-order'", 'orders:manage'],
    ["'/api/admin/ambassador-sales/orders'", 'ambassador_sales:manage'],
    ["'/api/admin/order-expiration-settings'", 'settings:manage'],
    ["'/api/admin/aio-events-submissions'", 'marketing:manage'],
    ["'/api/admin/consultation-inquiries'", 'consultation_inquiries:view'],
    ["'/api/admin/csp-reports'", 'logs:view'],
  ];

  for (const [marker, perm] of routes) {
    it(`${marker} → ${perm}`, () => {
      const block = blockBetween(misc, marker, null, 2500);
      assert.match(
        block,
        new RegExp(`gateAdminPermission\\(req, res, '${perm.replace(/:/g, '\\:')}'\\)`),
        `expected gateAdminPermission for ${perm}`
      );
    });
  }

  it('cron auto-reject uses authorizeCronOrAdminPermission orders:manage', () => {
    const block = blockBetween(misc, "'/api/auto-reject-expired-orders'", "'/api/auto-fail-pending-online-orders'");
    assert.match(block, /authorizeCronOrAdminPermission\(req, res, 'orders:manage'\)/);
  });
});

describe('special route fixes', () => {
  it('audit-log POST requires admins:manage', () => {
    const src = read('api/_lib/admin-audit-logs-routes.cjs');
    assert.match(src, /\/api\/admin\/audit-log.*requireAdminPermission\('admins:manage'\)/s);
  });

  it('media upload/delete require settings:manage', () => {
    const storage = read('api/_lib/register-storage-security-routes.cjs');
    assert.match(storage, /\/api\/admin\/media\/upload.*requireAdminPermission\('settings:manage'\)/s);
    assert.match(storage, /\/api\/admin\/media\/delete.*requireAdminPermission\('settings:manage'\)/s);
  });

  it('career application detail requires careers:manage', () => {
    const src = read('careerRoutes.cjs');
    assert.match(
      src,
      /\/api\/admin\/careers\/applications\/:id.*requireAdminPermission\('careers:manage'\)/s
    );
  });
});

describe('server.cjs parity', () => {
  const server = read('server.cjs');

  it('scanner admin routes use scanners:manage not super_admin', () => {
    assert.match(server, /\/api\/admin\/scanners.*requireAdminPermission\('scanners:manage'\)/s);
    assert.match(server, /\/api\/admin\/official-invitations.*requireSuperAdmin/s);
  });

  it('SMS routes require cron secret or orders:manage', () => {
    assert.match(server, /send-order-confirmation-sms.*requireCronSecretOrAdminPermission\('orders:manage'\)/s);
    assert.match(server, /send-ambassador-order-sms.*requireCronSecretOrAdminPermission\('orders:manage'\)/s);
    assert.match(server, /generate-qr-code.*requireCronSecretOrAdminPermission\('orders:manage'\)/s);
  });

  it('server payment-options GET uses settings:manage', () => {
    assert.match(server, /\/api\/admin\/payment-options.*requireAdminPermission\('settings:manage'\)/s);
  });

  it('sms-balance uses marketing:manage', () => {
    assert.match(server, /\/api\/sms-balance.*requireAdminPermission\('marketing:manage'\)/s);
  });
});

describe('regression — no role-static HTTP authorization', () => {
  const files = [
    'api/misc.js',
    'api/admin-pos.js',
    'api/admin-approve-order.js',
    'api/_lib/admin-missing-routes-http.js',
  ];

  for (const file of files) {
    it(`${file} has no hasPermission(auth.admin.role`, () => {
      const src = read(file);
      assert.doesNotMatch(src, /hasPermission\s*\(\s*auth(?:Result)?\.admin/);
    });
  }
});
