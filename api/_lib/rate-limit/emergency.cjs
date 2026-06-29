'use strict';

let disableRejectedLogged = false;
let globalFailOpenLogged = false;
let disabledActiveLogged = false;

function isProductionVercel() {
  return process.env.VERCEL_ENV === 'production';
}

function isGlobalFailOpen() {
  return process.env.RATE_LIMIT_GLOBAL_FAIL_OPEN === '1';
}

/**
 * RATE_LIMIT_DISABLED is discouraged. In production, requires RATE_LIMIT_DISABLED_REASON (min 10 chars).
 */
function isRateLimitDisabled() {
  if (process.env.RATE_LIMIT_DISABLED !== '1') return false;

  const reason = String(process.env.RATE_LIMIT_DISABLED_REASON || '').trim();
  if (isProductionVercel() && reason.length < 10) {
    if (!disableRejectedLogged) {
      disableRejectedLogged = true;
      console.error('[SECURITY] RATE_LIMIT_DISABLED ignored in production — missing RATE_LIMIT_DISABLED_REASON (min 10 chars). Limits remain active.');
    }
    return false;
  }

  if (!disabledActiveLogged) {
    disabledActiveLogged = true;
    console.error('[SECURITY] RATE_LIMIT_DISABLED active', {
      env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
      reasonLength: reason.length,
      timestamp: new Date().toISOString(),
    });
  }
  return true;
}

/**
 * @returns {{ skip: boolean, reason?: 'global_fail_open'|'disabled'|null }}
 */
function getEmergencyState() {
  if (isGlobalFailOpen()) {
    if (!globalFailOpenLogged) {
      globalFailOpenLogged = true;
      console.error('[SECURITY] RATE_LIMIT_GLOBAL_FAIL_OPEN active — all rate limits skipped', {
        timestamp: new Date().toISOString(),
      });
    }
    return { skip: true, reason: 'global_fail_open' };
  }
  if (isRateLimitDisabled()) {
    return { skip: true, reason: 'disabled' };
  }
  return { skip: false, reason: null };
}

function _resetEmergencyLogsForTests() {
  disableRejectedLogged = false;
  globalFailOpenLogged = false;
  disabledActiveLogged = false;
}

module.exports = {
  isGlobalFailOpen,
  isRateLimitDisabled,
  getEmergencyState,
  _resetEmergencyLogsForTests,
};
