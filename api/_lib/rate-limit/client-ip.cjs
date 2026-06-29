'use strict';

function isTrustedProxyEnvironment() {
  return process.env.VERCEL === '1' || process.env.TRUST_FORWARDED_IP === '1';
}

/**
 * Client IP for rate limits. Trusts X-Forwarded-For / X-Real-IP only behind Vercel or TRUST_FORWARDED_IP=1.
 * @param {import('http').IncomingMessage} req
 * @returns {string}
 */
function getClientIp(req) {
  if (isTrustedProxyEnvironment()) {
    const xffRaw = req?.headers?.['x-forwarded-for'];
    const xff = (typeof xffRaw === 'string' ? xffRaw : Array.isArray(xffRaw) ? xffRaw[0] : '')
      .split(',')[0]
      .trim();
    if (xff) return xff.slice(0, 128);
    const xr = req?.headers?.['x-real-ip'];
    if (xr) {
      const v = String(Array.isArray(xr) ? xr[0] : xr).trim();
      if (v) return v.slice(0, 128);
    }
  }
  const ra = req?.socket?.remoteAddress || '';
  const s = typeof ra === 'string' ? ra.replace(/^::ffff:/, '') : '';
  return s.slice(0, 128) || 'unknown';
}

module.exports = {
  isTrustedProxyEnvironment,
  getClientIp,
};
