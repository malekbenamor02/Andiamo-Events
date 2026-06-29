'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const root = resolve(__dirname, '../..');

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('admin-login.js rate limit wiring', () => {
  const src = read('api/admin-login.js');

  it('uses shared rate-limit module via createRequire', () => {
    assert.match(src, /requireCjs\('\.\/_lib\/rate-limit\/index\.cjs'\)/);
    assert.match(src, /enforceRateLimits/);
    assert.match(src, /respondToRateLimit/);
  });

  it('does not import legacy in-memory or non-atomic upstash limiters', () => {
    assert.doesNotMatch(src, /admin-login-rate-limit\.js/);
    assert.doesNotMatch(src, /admin-login-upstash\.js/);
    assert.doesNotMatch(src, /checkAdminLoginIpRateLimit/);
    assert.doesNotMatch(src, /checkAdminLoginDistributedLimits/);
  });

  it('enforces LOGIN_ADMIN before reCAPTCHA siteverify', () => {
    const rlIdx = src.indexOf('enforceRateLimits');
    const recapIdx = src.indexOf('www.google.com/recaptcha/api/siteverify');
    assert.ok(rlIdx >= 0, 'enforceRateLimits must be present');
    assert.ok(recapIdx >= 0, 'reCAPTCHA verify must be present');
    assert.ok(rlIdx < recapIdx, 'rate limit must run before reCAPTCHA HTTP call');
  });

  it('enforces rate limit before Supabase client creation', () => {
    const rlIdx = src.indexOf('enforceRateLimits');
    const dbIdx = src.indexOf("from('admins')");
    assert.ok(rlIdx < dbIdx, 'rate limit must run before DB lookup');
  });

  it('does not call legacy Map limiters', () => {
    assert.doesNotMatch(src, /checkAdminLoginEmailRateLimit/);
  });
});

describe('admin-login blocked path does not reach bcrypt', () => {
  it('respondToRateLimit returns before createClient when over limit (static guard)', () => {
    const src = read('api/admin-login.js');
    const blockIdx = src.indexOf('if (respondToRateLimit(res, rl)) return');
    const supabaseIdx = src.indexOf('createClient');
    assert.ok(blockIdx >= 0);
    assert.ok(blockIdx < supabaseIdx);
  });
});
