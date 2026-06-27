'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const root = resolve(__dirname, '../..');

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('admin route auth before service-role DB', () => {
  it('presale admin codes: verifyAdminAuth before createAdminDbClient', () => {
    const src = read('api/_lib/presale-route-admin-codes.js');
    const authIdx = src.indexOf('verifyAdminAuth(req)');
    const dbIdx = src.indexOf('const db = await makeDb(res)');
    assert.ok(authIdx >= 0 && dbIdx > authIdx, 'auth must precede DB client in handlePresaleAdminCodes');
  });

  it('event promo admin codes: verifyAdminAuth before createAdminDbClient', () => {
    const src = read('api/_lib/event-promo-route-admin.js');
    const authIdx = src.indexOf('verifyAdminAuth(req)');
    const dbIdx = src.indexOf('const db = await makeDb(res)');
    assert.ok(authIdx >= 0 && dbIdx > authIdx);
  });

  it('admin logs: verifyAdminAuth before createAdminDbClient', () => {
    const src = read('api/_lib/admin-logs-route.js');
    const authIdx = src.indexOf('verifyAdminAuth(req)');
    const dbIdx = src.indexOf('createAdminDbClient(res)');
    assert.ok(authIdx >= 0 && dbIdx > authIdx);
  });

  it('admin-approve-order: verifyAdminAuth before createAdminDbClient', () => {
    const src = read('api/admin-approve-order.js');
    const authIdx = src.indexOf('verifyAdminAuth(req)');
    const dbIdx = src.indexOf('createAdminDbClient(res)');
    assert.ok(authIdx >= 0 && dbIdx > authIdx);
  });

  it('admin-pos: verifyAdminAuth before getSupabase', () => {
    const src = read('api/admin-pos.js');
    const authIdx = src.lastIndexOf('verifyAdminAuth(req)');
    const dbIdx = src.lastIndexOf('getSupabase()');
    assert.ok(authIdx >= 0 && dbIdx > authIdx);
  });

  it('requireAdmin helper: auth before createServiceRoleClient', () => {
    const src = read('api/_lib/admin-data-route-helpers.js');
    const fn = src.indexOf('export async function requireAdmin');
    const authCall = src.indexOf('verifyAdminAuth(req)', fn);
    const dbCall = src.indexOf('createServiceRoleClient()', fn);
    assert.ok(authCall > fn && dbCall > authCall);
  });
});

describe('admin privileged express routes use service role only', () => {
  it('admin-privileged-app passes supabaseService to admin CRUD', () => {
    const src = read('api/_lib/admin-privileged-app.cjs');
    assert.match(src, /supabaseService/);
    assert.doesNotMatch(src, /supabaseService \|\| supabase/);
  });
});
