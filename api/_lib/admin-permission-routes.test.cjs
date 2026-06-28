'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const root = resolve(__dirname, '../..');

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('super-admin-only routes enforce role before DB access', () => {
  it('order-qr-tickets: super_admin check before createAdminDbClient', () => {
    const src = read('api/misc.js');
    const blockStart = src.indexOf("path === '/api/admin/order-qr-tickets'");
    assert.ok(blockStart >= 0, 'order-qr-tickets route must exist');
    const blockEnd = src.indexOf('// GET /api/admin/ambassador-sales', blockStart);
    const block = src.slice(blockStart, blockEnd > blockStart ? blockEnd : blockStart + 4000);
    const roleIdx = block.indexOf("role !== 'super_admin'");
    const dbIdx = block.indexOf('createAdminDbClient(res)');
    assert.ok(roleIdx >= 0, 'must check super_admin role');
    assert.ok(dbIdx > roleIdx, 'DB client must come after super_admin check');
  });

  it('official-invitations: verifySuperAdmin before createAdminDbClient', () => {
    const src = read('api/misc.js');
    const blockStart = src.indexOf("path === '/api/admin/official-invitations' && method === 'GET'");
    assert.ok(blockStart >= 0);
    const blockEnd = src.indexOf('// POST /api/admin/official-invitations/create', blockStart);
    const block = src.slice(blockStart, blockEnd > blockStart ? blockEnd : blockStart + 3000);
    const authIdx = block.indexOf('verifySuperAdmin(req)');
    const dbIdx = block.indexOf('createAdminDbClient(res)');
    assert.ok(authIdx >= 0 && dbIdx > authIdx);
  });

  it('official-invitations create: verifySuperAdmin before DB', () => {
    const src = read('api/misc.js');
    const blockStart = src.indexOf("path === '/api/admin/official-invitations/create'");
    assert.ok(blockStart >= 0);
    const block = src.slice(blockStart, blockStart + 5000);
    const authIdx = block.indexOf('verifySuperAdmin(req)');
    const dbIdx = block.indexOf('createAdminDbClient(res)');
    assert.ok(authIdx >= 0 && dbIdx > authIdx);
  });

  it('admin/admins routes: super_admin role gate in admin-admins-routes', () => {
    const src = read('api/_lib/admin-admins-routes.cjs');
    assert.match(src, /super_admin/);
    assert.match(src, /writeTabAccessAudit/);
  });
});

describe('effective permission gates on admin API handlers', () => {
  function assertNoRoleStaticPermission(src, label) {
    assert.doesNotMatch(
      src,
      /hasPermission\s*\(\s*auth(?:Result)?\.admin\??\.(?:role|admin\?\.role)/,
      `${label} must not use role-static hasPermission on auth.admin.role`
    );
  }

  it('admin-pos.js uses effectivePermissionDenied for pos:manage', () => {
    const src = read('api/admin-pos.js');
    assert.match(src, /effectivePermissionDenied\(auth,\s*'pos:manage'\)/);
    assertNoRoleStaticPermission(src, 'admin-pos.js');
  });

  it('admin-approve-order.js uses effectivePermissionDenied for orders:manage', () => {
    const src = read('api/admin-approve-order.js');
    assert.match(src, /effectivePermissionDenied\(authResult,\s*'orders:manage'\)/);
    assertNoRoleStaticPermission(src, 'admin-approve-order.js');
  });

  it('misc.js SMS routes use marketing:manage effective gate', () => {
    const src = read('api/misc.js');
    const bulkBlock = src.slice(
      src.indexOf("path === '/api/admin/bulk-sms/send'"),
      src.indexOf("path === '/api/admin/bulk-sms/send'") + 1200
    );
    const sendBlock = src.slice(
      src.indexOf("path === '/api/send-sms'"),
      src.indexOf("path === '/api/send-sms'") + 1200
    );
    const balanceBlock = src.slice(
      src.indexOf("path === '/api/sms-balance'"),
      src.indexOf("path === '/api/sms-balance'") + 1200
    );
    assert.match(bulkBlock, /effectivePermissionDenied\(authResult,\s*'marketing:manage'\)/);
    assert.match(sendBlock, /effectivePermissionDenied\(authResult,\s*'marketing:manage'\)/);
    assert.match(balanceBlock, /effectivePermissionDenied\(authResult,\s*'marketing:manage'\)/);
    const marketingGate = src.slice(
      src.indexOf('const marketingAdminPath'),
      src.indexOf('const marketingAdminPath') + 800
    );
    assert.match(marketingGate, /hasEffectivePermission\(marketingAuth\.permissions/);
  });

  it('presale-route-admin-codes.js uses events:manage not presale:manage', () => {
    const src = read('api/_lib/presale-route-admin-codes.js');
    assert.match(src, /effectivePermissionDenied\(auth,\s*'events:manage'\)/);
    assert.doesNotMatch(src, /presale:manage/);
  });

  it('event-promo-route-admin.js uses events:manage effective gate', () => {
    const src = read('api/_lib/event-promo-route-admin.js');
    assert.match(src, /effectivePermissionDenied\(auth,\s*'events:manage'\)/);
    assert.match(src, /requireEventsManage/);
    assert.doesNotMatch(src, /requireSuperAdmin/);
  });

  it('admin-logs-route.js uses logs:view effective gate', () => {
    const src = read('api/_lib/admin-logs-route.js');
    assert.match(src, /effectivePermissionDenied\(authResult,\s*'logs:view'\)/);
    assertNoRoleStaticPermission(src, 'admin-logs-route.js');
  });
});

describe('server.cjs admin DB hardening', () => {
  it('has no supabaseService || supabase fallback', () => {
    const src = read('server.cjs');
    assert.doesNotMatch(src, /supabaseService\s*\|\|\s*supabase/);
    assert.doesNotMatch(src, /supabase\s*\|\|\s*supabaseService/);
  });

  it('defines requireServiceRoleDb fail-closed helper', () => {
    const src = read('server.cjs');
    assert.match(src, /function requireServiceRoleDb/);
    assert.match(src, /503/);
  });
});
