'use strict';

const {
  getClientIp,
  enforceRateLimits,
  respondToRateLimit,
  setFetchForTests,
  resetFetchForTests,
} = require('./rate-limit/index.cjs');

/**
 * Every login attempt consumes LOGIN_INFLUENCER IP + email buckets.
 * @param {import('http').IncomingMessage} req
 * @param {string} ip
 * @param {string} emailNormalized
 */
async function enforceInfluencerLoginLimits(req, ip, emailNormalized) {
  return enforceRateLimits({
    req,
    policyId: 'LOGIN_INFLUENCER',
    segments: { ip, email: emailNormalized },
  });
}

module.exports = {
  getClientIp,
  enforceInfluencerLoginLimits,
  respondToRateLimit,
  setFetchForTests,
  resetFetchForTests,
  _resetLoginRateLimitsForTests() {
    resetFetchForTests();
  },
};
