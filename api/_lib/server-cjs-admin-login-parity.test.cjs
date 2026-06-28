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
  const loginStart = src.indexOf("app.post('/api/admin-login'");
  assert.ok(loginStart >= 0, 'admin-login route must exist');
  const loginBlock = src.slice(loginStart, loginStart + 9000);

  it('includes session_version in JWT sign payload', () => {
    assert.match(loginBlock, /session_version:\s*admin\.session_version/);
  });

  it('rejects inactive admins', () => {
    assert.match(loginBlock, /is_active\s*===\s*false/);
  });

  it('returns requiresPasswordChange in login response', () => {
    assert.match(loginBlock, /requiresPasswordChange:\s*!!admin\.requires_password_change/);
  });

  it('selects session_version and is_active from admins', () => {
    assert.match(loginBlock, /session_version/);
    assert.match(loginBlock, /is_active/);
    assert.match(loginBlock, /requires_password_change/);
  });
});

describe('server.cjs admin logout uses shared handler', () => {
  it('delegates to handleAdminLogout', () => {
    const src = read('server.cjs');
    assert.match(src, /handleAdminLogout/);
    assert.match(src, /admin-logout-http\.js/);
  });
});
