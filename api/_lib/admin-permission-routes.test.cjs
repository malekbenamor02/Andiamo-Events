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
