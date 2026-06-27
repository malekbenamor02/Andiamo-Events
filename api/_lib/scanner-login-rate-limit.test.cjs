'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  isScannerLoginRateLimited,
  recordFailedScannerLogin,
  clearScannerLoginRateLimit,
  LOGIN_MAX,
  _resetForTests,
} = require('./scanner-login-rate-limit.cjs');

test.afterEach(() => {
  _resetForTests();
});

test('allows attempts under limit', () => {
  const ip = '203.0.113.1';
  const email = 'scanner@test.com';
  for (let i = 0; i < LOGIN_MAX; i++) {
    assert.strictEqual(isScannerLoginRateLimited(ip, email), false);
    recordFailedScannerLogin(ip, email);
  }
  assert.strictEqual(isScannerLoginRateLimited(ip, email), true);
});

test('clearScannerLoginRateLimit resets counters', () => {
  const ip = '203.0.113.2';
  const email = 'other@test.com';
  for (let i = 0; i < LOGIN_MAX; i++) {
    recordFailedScannerLogin(ip, email);
  }
  assert.strictEqual(isScannerLoginRateLimited(ip, email), true);
  clearScannerLoginRateLimit(ip, email);
  assert.strictEqual(isScannerLoginRateLimited(ip, email), false);
});
