'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  hasPermission,
  resolvePermissions,
  resolveAllowedTabs,
  getDefaultTabKey,
} = require('../../shared/admin/permissions.cjs');
const { ADMIN_TAB_DEFINITIONS } = require('../../shared/admin/tabDefinitions.cjs');

describe('admin permissions', () => {
  it('super_admin has all permissions', () => {
    assert.equal(hasPermission('super_admin', 'events:manage'), true);
    assert.equal(hasPermission('super_admin', 'anything:else'), true);
  });

  it('regular admin lacks super_admin-only permissions', () => {
    assert.equal(hasPermission('admin', 'events:manage'), false);
    assert.equal(hasPermission('admin', 'marketing:manage'), false);
    assert.equal(hasPermission('admin', 'settings:manage'), false);
    assert.equal(hasPermission('admin', 'orders:manage'), true);
    assert.equal(hasPermission('admin', 'pos:manage'), true);
  });

  it('resolveAllowedTabs filters by role', () => {
    const adminTabs = resolveAllowedTabs('admin', ADMIN_TAB_DEFINITIONS);
    assert.ok(adminTabs.includes('overview'));
    assert.ok(adminTabs.includes('online-orders'));
    assert.ok(!adminTabs.includes('events'));
    assert.ok(!adminTabs.includes('settings'));

    const superTabs = resolveAllowedTabs('super_admin', ADMIN_TAB_DEFINITIONS);
    assert.ok(superTabs.includes('events'));
    assert.ok(superTabs.includes('settings'));
  });

  it('getDefaultTabKey prefers overview', () => {
    assert.equal(getDefaultTabKey(['overview', 'pos']), 'overview');
    assert.equal(getDefaultTabKey(['pos']), 'pos');
  });

  it('resolvePermissions for admin returns explicit list', () => {
    const perms = resolvePermissions('admin');
    assert.ok(perms.includes('applications:manage'));
    assert.ok(!perms.includes('*'));
  });
});
