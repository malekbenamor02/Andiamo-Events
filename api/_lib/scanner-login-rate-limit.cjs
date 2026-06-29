'use strict';

const {
  getClientIp,
  enforceRateLimits,
  respondToRateLimit,
  setFetchForTests,
  resetFetchForTests,
} = require('./rate-limit/index.cjs');

/**
 * Every login attempt consumes LOGIN_SCANNER IP + email buckets (not failure-only).
 * @param {import('http').IncomingMessage} req
 * @param {string} ip
 * @param {string} email normalized email
 */
async function enforceScannerLoginLimits(req, ip, email) {
  return enforceRateLimits({
    req,
    policyId: 'LOGIN_SCANNER',
    segments: { ip, email },
  });
}

module.exports = {
  getClientIp,
  enforceScannerLoginLimits,
  respondToRateLimit,
  setFetchForTests,
  resetFetchForTests,
  _resetForTests() {
    resetFetchForTests();
  },
};
