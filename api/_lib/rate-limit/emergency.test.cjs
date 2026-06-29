'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  getEmergencyState,
  enforceRateLimits,
  _resetEmergencyLogsForTests,
} = require('./index.cjs');
const { resetFetchForTests } = require('./upstash.cjs');

describe('emergency rate limit flags', () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
    _resetEmergencyLogsForTests();
    resetFetchForTests();
  });

  it('RATE_LIMIT_GLOBAL_FAIL_OPEN skips enforcement', async () => {
    process.env.RATE_LIMIT_GLOBAL_FAIL_OPEN = '1';
    delete process.env.UPSTASH_REDIS_REST_URL;

    const state = getEmergencyState();
    assert.equal(state.skip, true);
    assert.equal(state.reason, 'global_fail_open');

    const result = await enforceRateLimits({
      policyId: 'LOGIN_ADMIN',
      segments: { ip: '1.2.3.4', email: 'a@b.com' },
    });
    assert.equal(result.allowed, true);
    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'global_fail_open');
  });

  it('RATE_LIMIT_DISABLED rejected in production without reason', () => {
    process.env.RATE_LIMIT_DISABLED = '1';
    process.env.VERCEL_ENV = 'production';
    delete process.env.RATE_LIMIT_DISABLED_REASON;

    const state = getEmergencyState();
    assert.equal(state.skip, false);
  });

  it('RATE_LIMIT_DISABLED allowed in production with reason >= 10 chars', () => {
    process.env.RATE_LIMIT_DISABLED = '1';
    process.env.VERCEL_ENV = 'production';
    process.env.RATE_LIMIT_DISABLED_REASON = 'incident-2026-06-28-ops-approved';

    const state = getEmergencyState();
    assert.equal(state.skip, true);
    assert.equal(state.reason, 'disabled');
  });

  it('RATE_LIMIT_DISABLED allowed in non-production without reason', () => {
    process.env.RATE_LIMIT_DISABLED = '1';
    process.env.VERCEL_ENV = 'preview';
    delete process.env.RATE_LIMIT_DISABLED_REASON;

    const state = getEmergencyState();
    assert.equal(state.skip, true);
    assert.equal(state.reason, 'disabled');
  });
});
