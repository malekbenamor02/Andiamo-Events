'use strict';

/** Meta _fbc format: fb.1.<unix_ms>.<fbclid> */
const FBC_PATTERN = /^fb\.1\.\d+\.[^;]+$/;

/**
 * @param {import('http').IncomingMessage} req
 * @param {string} name
 */
function parseRequestCookie(req, name) {
  const raw = req.headers?.cookie;
  if (!raw || typeof raw !== 'string') return undefined;
  const pattern = new RegExp(`(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`);
  const match = raw.match(pattern);
  if (!match?.[1]) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * @param {string} value
 */
function isValidFbc(value) {
  return FBC_PATTERN.test(String(value).trim());
}

/**
 * @param {string} fbclid
 * @param {number} [timestampMs]
 */
function buildFbcFromFbclid(fbclid, timestampMs = Date.now()) {
  return `fb.1.${timestampMs}.${String(fbclid).trim()}`;
}

/**
 * @param {string|undefined|null} url
 */
function extractFbclidFromUrl(url) {
  if (!url || typeof url !== 'string') return undefined;
  try {
    const fbclid = new URL(url).searchParams.get('fbclid');
    return fbclid?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Prefer explicit body value; fall back to browser _fbp cookie on the request.
 * @param {import('http').IncomingMessage} req
 * @param {unknown} bodyFbp
 */
function resolveMetaFbp(req, bodyFbp) {
  const fromBody = bodyFbp != null ? String(bodyFbp).trim() : '';
  if (fromBody) return fromBody.slice(0, 256);

  const fromCookie = parseRequestCookie(req, '_fbp');
  if (fromCookie) return fromCookie.slice(0, 256);

  return undefined;
}

/**
 * Prefer body fbc; fall back to _fbc cookie, then construct from fbclid (body or event URL).
 * @param {import('http').IncomingMessage} req
 * @param {unknown} bodyFbc
 * @param {unknown} bodyFbclid
 * @param {unknown} eventSourceUrl
 */
function resolveMetaFbc(req, bodyFbc, bodyFbclid, eventSourceUrl) {
  const fromBody = bodyFbc != null ? String(bodyFbc).trim() : '';
  if (fromBody && isValidFbc(fromBody)) return fromBody.slice(0, 256);

  const fromCookie = parseRequestCookie(req, '_fbc');
  if (fromCookie && isValidFbc(fromCookie)) return fromCookie.slice(0, 256);

  const fbclid =
    (bodyFbclid != null ? String(bodyFbclid).trim() : '') ||
    extractFbclidFromUrl(eventSourceUrl != null ? String(eventSourceUrl) : undefined) ||
    undefined;

  if (fbclid) return buildFbcFromFbclid(fbclid).slice(0, 256);

  return undefined;
}

/**
 * @param {import('http').IncomingMessage} req
 */
function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {Record<string, unknown>|null|undefined} body
 */
function parseAttributionFromBody(req, body) {
  const metaEventId = body?.metaEventId || body?.meta_event_id;
  const metaEventSourceUrl = body?.metaEventSourceUrl || body?.meta_event_source_url;
  const metaFbclid = body?.metaFbclid || body?.meta_fbclid;
  const clientIp = getClientIp(req);
  const clientUserAgent = (req.get?.('user-agent') || req.headers?.['user-agent'] || '')
    .toString()
    .slice(0, 512);

  const fbp = resolveMetaFbp(req, body?.metaFbp || body?.meta_fbp);
  const fbc = resolveMetaFbc(
    req,
    body?.metaFbc || body?.meta_fbc,
    metaFbclid,
    metaEventSourceUrl
  );

  if (
    !metaEventId &&
    !fbp &&
    !fbc &&
    !metaEventSourceUrl &&
    !clientUserAgent &&
    !clientIp
  ) {
    return null;
  }

  return {
    ...(metaEventId ? { eventId: String(metaEventId).slice(0, 128) } : {}),
    ...(fbp ? { fbp } : {}),
    ...(fbc ? { fbc } : {}),
    ...(metaEventSourceUrl ? { eventSourceUrl: String(metaEventSourceUrl).slice(0, 2048) } : {}),
    ...(clientUserAgent ? { clientUserAgent } : {}),
    ...(clientIp && clientIp !== 'unknown' ? { clientIp } : {}),
  };
}

module.exports = {
  parseRequestCookie,
  isValidFbc,
  buildFbcFromFbclid,
  extractFbclidFromUrl,
  resolveMetaFbp,
  resolveMetaFbc,
  getClientIp,
  parseAttributionFromBody,
};
