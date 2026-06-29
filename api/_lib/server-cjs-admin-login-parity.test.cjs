'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const root = resolve(__dirname, '../..');

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('server.cjs admin login parity with Vercel', () => {
  const src = read('server.cjs');

  it('delegates /api/admin-login to api/admin-login.js', () => {
    assert.match(src, /app\.post\('\/api\/admin-login', forwardAdminLogin\)/);
    assert.match(src, /admin-login\.js/);
  });

  it('does not use express authLimiter on admin-login', () => {
    assert.doesNotMatch(src, /app\.post\('\/api\/admin-login', authLimiter/);
  });
});

describe('admin-login.js session parity', () => {
  const handlerSrc = read('api/admin-login.js');
  const loginBlock = handlerSrc.slice(0, 12000);

  it('admin-login handler source is available', () => {
    assert.ok(read('server.cjs').includes('forwardAdminLogin'));
    assert.ok(handlerSrc.length > 0);
  });
  it('includes session_version in JWT sign payload', () => {
    assert.match(loginBlock, /session_version:\s*admin\.session_version/);
  });

  it('rejects inactive admins', () => {
    assert.match(loginBlock, /is_active\s*===\s*false/);
  });

  it('returns requiresPasswordChange in login response', () => {
    assert.match(loginBlock, /requiresPasswordChange:\s*!!admin\.requires_password_change/);
  });
});

describe('admin-login.js uses shared rate-limit module', () => {
  it('imports enforceRateLimits from rate-limit/index.cjs', () => {
    const src = read('api/admin-login.js');
    assert.match(src, /rate-limit\/index\.cjs/);
    assert.match(src, /enforceRateLimits/);
  });
});

describe('server.cjs admin logout uses shared handler', () => {
  it('delegates to handleAdminLogout', () => {
    const src = read('server.cjs');
    assert.match(src, /handleAdminLogout/);
    assert.match(src, /admin-logout-http\.js/);
  });
});
