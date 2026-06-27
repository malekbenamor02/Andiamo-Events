'use strict';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getSiteBaseUrl() {
  const raw =
    process.env.SITE_URL ||
    process.env.PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'https://www.andiamoevents.com';
  return String(raw).replace(/\/$/, '');
}

function isValidSecureToken(value) {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

function maskTokenForLogs(token) {
  if (!token || typeof token !== 'string') return '(none)';
  const t = token.trim();
  if (t.length <= 8) return '****';
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

/** Public API route that renders QR PNG after server-side token validation. */
function buildTicketQrApiUrl(secureToken, baseUrl) {
  const token = String(secureToken || '').trim();
  if (!isValidSecureToken(token)) {
    throw new Error('Invalid secure token');
  }
  const base = String(baseUrl || getSiteBaseUrl()).replace(/\/$/, '');
  return `${base}/api/tickets/qr/${encodeURIComponent(token)}`;
}

function isLegacyPublicStorageTicketUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.toLowerCase();
  return (
    u.includes('/storage/v1/object/public/tickets/') ||
    u.includes('/object/public/tickets/') ||
    (u.includes('/tickets/') && (u.includes('.supabase.co') || u.includes('r2.dev')))
  );
}

/**
 * Display URL for admin/browser — always from secure_token, never legacy Storage URL.
 * @param {string} secureToken
 * @param {string} [baseUrl] optional site base
 */
function resolveTicketQrUrl(secureToken, baseUrl) {
  if (!isValidSecureToken(secureToken)) return null;
  try {
    return buildTicketQrApiUrl(secureToken, baseUrl);
  } catch (_) {
    return null;
  }
}

/** @deprecated Legacy rows only — do not use for display/email. */
function resolveTicketQrUrlLegacy(secureToken, storedUrl) {
  const api = resolveTicketQrUrl(secureToken);
  if (api) return api;
  if (storedUrl && typeof storedUrl === 'string' && !isLegacyPublicStorageTicketUrl(storedUrl)) {
    return storedUrl;
  }
  return null;
}

function extractSecureTokenFromQrStorageKey(key) {
  if (!key || typeof key !== 'string') return null;
  const base = key.split('/').pop() || '';
  const token = base.replace(/\.png$/i, '');
  return isValidSecureToken(token) ? token : null;
}

module.exports = {
  getSiteBaseUrl,
  isValidSecureToken,
  maskTokenForLogs,
  buildTicketQrApiUrl,
  resolveTicketQrUrl,
  resolveTicketQrUrlLegacy,
  isLegacyPublicStorageTicketUrl,
  extractSecureTokenFromQrStorageKey,
};
