'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ADMIN_TAB_DEFINITIONS } = require('./tabDefinitions.cjs');
const {
  SENSITIVE_TAB_KEYS,
  resolveAllowedTabsForAdmin,
  resolveMobileTabsForAdmin,
  resolveAdminEffectiveAccess,
  permissionsFromTabs,
  validateAdminTabAccessPayload,
  rowsFromPayload,
  tabAccessSummaryFromRows,
  isExplicitTabConfig,
} = require('./tabAccess.cjs');
const { hasEffectivePermission } = require('./permissions.cjs');
const { resolveAllowedTabs } = require('./permissions.cjs');

const sampleRows = [
  { tab_key: 'overview', show_in_mobile: true, mobile_order: 0 },
  { tab_key: 'events', show_in_mobile: false, mobile_order: null },
  { tab_key: 'pos', show_in_mobile: true, mobile_order: 4 },
];

describe('tabAccess', () => {
  it('no explicit rows — admin uses role defaults', () => {
    const roleTabs = resolveAllowedTabs('admin', ADMIN_TAB_DEFINITIONS);
    const allowed = resolveAllowedTabsForAdmin({ role: 'admin', tabRows: [] }, ADMIN_TAB_DEFINITIONS);
    assert.deepEqual(allowed, roleTabs);
    assert.ok(allowed.includes('overview'));
    assert.ok(!allowed.includes('events'));
  });

  it('no explicit rows — super_admin gets all tabs', () => {
    const { allowedTabs, permissions, mobileTabs } = resolveAdminEffectiveAccess(
      { role: 'super_admin', tabRows: [] },
      ADMIN_TAB_DEFINITIONS
    );
    assert.equal(allowedTabs.length, ADMIN_TAB_DEFINITIONS.length);
    assert.deepEqual(permissions, ['*']);
    assert.ok(mobileTabs.includes('overview'));
    assert.ok(mobileTabs.includes('settings'));
  });

  it('explicit rows — admin gets only configured tabs', () => {
    const { allowedTabs, permissions } = resolveAdminEffectiveAccess(
      { role: 'admin', tabRows: sampleRows },
      ADMIN_TAB_DEFINITIONS
    );
    assert.deepEqual(allowedTabs, ['overview', 'events', 'pos']);
    assert.ok(permissions.includes('dashboard:view'));
    assert.ok(permissions.includes('events:manage'));
    assert.ok(permissions.includes('pos:manage'));
    assert.ok(!permissions.includes('*'));
  });

  it('super_admin ignores explicit rows', () => {
    const allowed = resolveAllowedTabsForAdmin(
      { role: 'super_admin', tabRows: sampleRows },
      ADMIN_TAB_DEFINITIONS
    );
    assert.equal(allowed.length, ADMIN_TAB_DEFINITIONS.length);
  });

  it('mobile tabs from explicit rows', () => {
    const allowed = resolveAllowedTabsForAdmin({ role: 'admin', tabRows: sampleRows }, ADMIN_TAB_DEFINITIONS);
    const mobile = resolveMobileTabsForAdmin(
      { role: 'admin', allowedTabs: allowed, tabRows: sampleRows },
      ADMIN_TAB_DEFINITIONS
    );
    assert.deepEqual(mobile, ['overview', 'pos']);
  });

  it('rejects unknown tab keys', () => {
    const result = validateAdminTabAccessPayload(
      { role: 'admin', allowed_tab_keys: ['overview', 'not-a-tab'], mobile_tab_keys: [] },
      ADMIN_TAB_DEFINITIONS
    );
    assert.equal(result.ok, false);
    assert.match(result.error, /Unknown tab key/);
  });

  it('rejects duplicate tab keys', () => {
    const result = validateAdminTabAccessPayload(
      { role: 'admin', allowed_tab_keys: ['overview', 'overview'], mobile_tab_keys: [] },
      ADMIN_TAB_DEFINITIONS
    );
    assert.equal(result.ok, false);
    assert.match(result.error, /Duplicate/);
  });

  it('rejects mobile tabs not in allowed tabs', () => {
    const result = validateAdminTabAccessPayload(
      { role: 'admin', allowed_tab_keys: ['overview'], mobile_tab_keys: ['events'] },
      ADMIN_TAB_DEFINITIONS
    );
    assert.equal(result.ok, false);
    assert.match(result.error, /Mobile tab must be included/);
  });

  it('rejects sensitive tabs for admin role', () => {
    for (const key of SENSITIVE_TAB_KEYS) {
      const result = validateAdminTabAccessPayload(
        { role: 'admin', allowed_tab_keys: ['overview', key], mobile_tab_keys: ['overview'] },
        ADMIN_TAB_DEFINITIONS
      );
      assert.equal(result.ok, false, `expected reject for ${key}`);
      assert.match(result.error, /Sensitive tab/);
    }
  });

  it('null allowed_tab_keys clears explicit config', () => {
    const result = validateAdminTabAccessPayload(
      { role: 'admin', allowed_tab_keys: null },
      ADMIN_TAB_DEFINITIONS
    );
    assert.equal(result.ok, true);
    assert.equal(result.clearConfig, true);
    assert.deepEqual(result.rows, []);
  });

  it('hasEffectivePermission respects wildcard and explicit list', () => {
    assert.equal(hasEffectivePermission(['*'], 'events:manage'), true);
    assert.equal(hasEffectivePermission(['dashboard:view'], 'events:manage'), false);
    assert.equal(hasEffectivePermission(['dashboard:view'], 'dashboard:view'), true);
  });

  it('permissionsFromTabs derives from allowed tabs', () => {
    const perms = permissionsFromTabs('admin', ['overview', 'pos'], ADMIN_TAB_DEFINITIONS);
    assert.ok(perms.includes('dashboard:view'));
    assert.ok(perms.includes('pos:manage'));
    assert.ok(!perms.includes('events:manage'));
  });

  it('tabAccessSummaryFromRows', () => {
    const summary = tabAccessSummaryFromRows(sampleRows, ADMIN_TAB_DEFINITIONS);
    assert.equal(summary.is_explicit, true);
    assert.deepEqual(summary.allowed_tab_keys, ['overview', 'events', 'pos']);
    assert.deepEqual(summary.mobile_tab_keys, ['overview', 'pos']);
  });

  it('rowsFromPayload sets show_in_mobile correctly', () => {
    const rows = rowsFromPayload(['overview', 'events'], ['overview'], ADMIN_TAB_DEFINITIONS);
    assert.equal(rows.length, 2);
    const overview = rows.find((r) => r.tab_key === 'overview');
    const events = rows.find((r) => r.tab_key === 'events');
    assert.equal(overview.show_in_mobile, true);
    assert.equal(events.show_in_mobile, false);
    assert.equal(overview.mobile_order, 0);
    assert.equal(events.mobile_order, 1);
  });

  it('rowsFromPayload omits null mobile_order for tabs without order', () => {
    const rows = rowsFromPayload(['academy'], ['academy'], ADMIN_TAB_DEFINITIONS);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].show_in_mobile, true);
    assert.equal(rows[0].mobile_order, 5);
  });

  it('isExplicitTabConfig', () => {
    assert.equal(isExplicitTabConfig([]), false);
    assert.equal(isExplicitTabConfig(null), false);
    assert.equal(isExplicitTabConfig(sampleRows), true);
  });
});
