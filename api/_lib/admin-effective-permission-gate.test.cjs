'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('effectivePermissionDenied', () => {
  it('allows admin with effective pos:manage', async () => {
    const { effectivePermissionDenied } = await import('./admin-verify.js');
    const auth = { permissions: ['pos:manage'] };
    assert.equal(effectivePermissionDenied(auth, 'pos:manage'), null);
  });

  it('denies admin without effective pos:manage', async () => {
    const { effectivePermissionDenied } = await import('./admin-verify.js');
    const auth = { permissions: ['dashboard:view'] };
    const denied = effectivePermissionDenied(auth, 'pos:manage');
    assert.ok(denied);
    assert.equal(denied.statusCode, 403);
    assert.match(denied.details, /pos:manage/);
  });

  it('denies marketing:manage when only pos:manage granted', async () => {
    const { effectivePermissionDenied } = await import('./admin-verify.js');
    const auth = { permissions: ['pos:manage'] };
    const denied = effectivePermissionDenied(auth, 'marketing:manage');
    assert.ok(denied);
    assert.equal(denied.statusCode, 403);
  });

  it('allows super_admin wildcard permissions', async () => {
    const { effectivePermissionDenied } = await import('./admin-verify.js');
    const auth = { permissions: ['*'] };
    assert.equal(effectivePermissionDenied(auth, 'orders:manage'), null);
    assert.equal(effectivePermissionDenied(auth, 'events:manage'), null);
  });

  it('denies tab-restricted admin for orders:manage and events:manage', async () => {
    const { effectivePermissionDenied } = await import('./admin-verify.js');
    const auth = { permissions: ['dashboard:view'] };
    assert.ok(effectivePermissionDenied(auth, 'orders:manage'));
    assert.ok(effectivePermissionDenied(auth, 'events:manage'));
    assert.ok(effectivePermissionDenied(auth, 'marketing:manage'));
  });
});
