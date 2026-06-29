'use strict';

function isVercelRuntime() {
  return process.env.VERCEL === '1';
}

function envInt(name, defaultVal) {
  const v = process.env[name];
  if (v == null || v === '') return defaultVal;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : defaultVal;
}

function envKeyMax(policyId, dimension, defaultMax) {
  const dim = String(dimension).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  return envInt(`RATE_LIMIT_${policyId}_${dim}_MAX`, defaultMax);
}

function envKeyWindow(policyId, dimension, defaultWindowSec) {
  const dim = String(dimension).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  return envInt(`RATE_LIMIT_${policyId}_${dim}_WINDOW_SEC`, defaultWindowSec);
}

function defaultOnRedisMissing(failClosedOnVercel = true) {
  if (failClosedOnVercel && isVercelRuntime()) return 'fail-closed';
  return 'fail-open';
}

/** @type {Record<string, { route: string, buckets: Array<{ dimension: string, max: number, windowSec: number, onRedisMissing?: string, onRedisError?: string }> }>} */
const POLICY_DEFINITIONS = {
  LOGIN_ADMIN: {
    route: 'login.admin',
    buckets: [
      { dimension: 'ip', max: 10, windowSec: 900 },
      { dimension: 'email', max: 5, windowSec: 900 },
    ],
  },
  LOGIN_AMBASSADOR: {
    route: 'login.ambassador',
    buckets: [
      { dimension: 'ip', max: 10, windowSec: 900 },
      { dimension: 'phone', max: 5, windowSec: 900 },
    ],
  },
  LOGIN_SCANNER: {
    route: 'login.scanner',
    buckets: [
      { dimension: 'ip', max: 10, windowSec: 900 },
      { dimension: 'email', max: 6, windowSec: 900 },
    ],
  },
  LOGIN_POS: {
    route: 'login.pos',
    buckets: [
      { dimension: 'ip', max: 10, windowSec: 900 },
      { dimension: 'email', max: 6, windowSec: 900 },
    ],
  },
  LOGIN_INFLUENCER: {
    route: 'login.influencer',
    buckets: [
      { dimension: 'ip', max: 10, windowSec: 900 },
      { dimension: 'email', max: 6, windowSec: 900 },
    ],
  },
  PAYMENT_GENERATE: {
    route: 'payment.generate',
    buckets: [
      { dimension: 'ip', max: 20, windowSec: 900 },
      { dimension: 'order', max: 5, windowSec: 900 },
    ],
  },
  PAYMENT_CONFIRM: {
    route: 'payment.confirm',
    buckets: [
      { dimension: 'ip', max: 30, windowSec: 900 },
      { dimension: 'order', max: 40, windowSec: 900 },
    ],
  },
  PAYMENT_ACADEMY_GENERATE: {
    route: 'payment.academy.generate',
    buckets: [
      { dimension: 'ip', max: 20, windowSec: 900 },
      { dimension: 'registration', max: 5, windowSec: 900 },
    ],
  },
  PAYMENT_ACADEMY_CONFIRM: {
    route: 'payment.academy.confirm',
    buckets: [
      { dimension: 'ip', max: 30, windowSec: 900 },
      { dimension: 'registration', max: 40, windowSec: 900 },
    ],
  },
  ORDER_CREATE: {
    route: 'order.create',
    buckets: [
      { dimension: 'ip', max: 10, windowSec: 3600 },
      { dimension: 'email', max: 5, windowSec: 3600 },
      { dimension: 'device', max: 3, windowSec: 600, onRedisError: 'fail-open' },
    ],
  },
  ORDER_AMBASSADOR_ACTION: {
    route: 'order.ambassador.action',
    buckets: [
      { dimension: 'ambassador', max: 30, windowSec: 3600 },
      { dimension: 'order', max: 10, windowSec: 3600 },
    ],
  },
  ORDER_POS_CREATE: {
    route: 'order.pos.create',
    buckets: [
      { dimension: 'pos_user', max: 120, windowSec: 3600 },
      { dimension: 'outlet', max: 500, windowSec: 3600 },
      { dimension: 'ip', max: 60, windowSec: 900 },
    ],
  },
  EMAIL_SEND: {
    route: 'email.send',
    buckets: [
      { dimension: 'admin', max: 30, windowSec: 3600 },
      { dimension: 'recipient', max: 3, windowSec: 3600 },
    ],
  },
  SMS_SEND: {
    route: 'sms.send',
    buckets: [{ dimension: 'admin', max: 20, windowSec: 3600 }],
  },
  SMS_BULK: {
    route: 'sms.bulk',
    buckets: [
      { dimension: 'admin', max: 5, windowSec: 3600 },
      { dimension: 'ip', max: 10, windowSec: 900 },
    ],
  },
  EMAIL_RESEND_TICKET: {
    route: 'email.resend.ticket',
    buckets: [
      { dimension: 'admin', max: 20, windowSec: 3600 },
      { dimension: 'order', max: 5, windowSec: 3600 },
      { dimension: 'recipient', max: 3, windowSec: 3600 },
    ],
  },
  QR_TICKET: {
    route: 'qr.ticket',
    buckets: [
      { dimension: 'ip', max: 60, windowSec: 60 },
      { dimension: 'token', max: 30, windowSec: 3600 },
    ],
  },
};

/**
 * @param {string} policyId
 * @returns {{ route: string, buckets: Array<{ dimension: string, max: number, windowSec: number, onRedisMissing: string, onRedisError: string }> } | null}
 */
function getPolicy(policyId) {
  const def = POLICY_DEFINITIONS[policyId];
  if (!def) return null;

  const buckets = def.buckets.map((b) => ({
    dimension: b.dimension,
    max: envKeyMax(policyId, b.dimension, b.max),
    windowSec: envKeyWindow(policyId, b.dimension, b.windowSec),
    onRedisMissing: b.onRedisMissing || defaultOnRedisMissing(true),
    onRedisError: b.onRedisError || 'fail-closed',
  }));

  return { route: def.route, buckets };
}

function listPolicyIds() {
  return Object.keys(POLICY_DEFINITIONS);
}

module.exports = {
  POLICY_DEFINITIONS,
  getPolicy,
  listPolicyIds,
  envKeyMax,
  envKeyWindow,
};
