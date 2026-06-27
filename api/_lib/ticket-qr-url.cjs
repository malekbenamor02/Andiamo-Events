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

/** Public API route that renders QR PNG after server-side token validation. */
function buildTicketQrApiUrl(secureToken) {
  const token = String(secureToken || '').trim();
  if (!isValidSecureToken(token)) {
    throw new Error('Invalid secure token');
  }
  return `${getSiteBaseUrl()}/api/tickets/qr/${encodeURIComponent(token)}`;
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
 * Prefer secure API route when token is known; fall back to stored URL for legacy rows.
 */
function resolveTicketQrUrl(secureToken, storedUrl) {
  if (isValidSecureToken(secureToken)) {
    try {
      return buildTicketQrApiUrl(secureToken);
    } catch (_) {
      /* fall through */
    }
  }
  if (storedUrl && typeof storedUrl === 'string') return storedUrl;
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
  buildTicketQrApiUrl,
  resolveTicketQrUrl,
  isLegacyPublicStorageTicketUrl,
  extractSecureTokenFromQrStorageKey,
};
