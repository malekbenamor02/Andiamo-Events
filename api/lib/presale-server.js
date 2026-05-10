/**
 * Shared presale helpers (HMAC code hash, CSRF, cookie name, IP, order gate, pricing).
 * Used by presale routes, passes-[eventId], orders-create, server.cjs.
 */
import crypto from 'crypto';

export const PRESALE_COOKIE_NAME = 'andm_ps';
export const PRESALE_CSRF_HEADER = 'x-presale-csrf';

/** True when X-Forwarded-For / X-Real-IP may be trusted (Vercel, or TRUST_FORWARDED_IP=1 behind your proxy). */
export function isTrustedProxyEnvironment() {
  return process.env.VERCEL === '1' || process.env.TRUST_FORWARDED_IP === '1';
}

/**
 * Client IP for rate limits / audit. When not in a trusted proxy environment, ignores forwarded headers
 * so clients cannot spoof X-Forwarded-For to bypass limits tied to another IP.
 */
export function getClientIp(req) {
  if (isTrustedProxyEnvironment()) {
    const xffRaw = req.headers['x-forwarded-for'];
    const xff = (typeof xffRaw === 'string' ? xffRaw : Array.isArray(xffRaw) ? xffRaw[0] : '')
      .split(',')[0]
      .trim();
    if (xff) return xff.slice(0, 128);
    const xr = req.headers['x-real-ip'];
    if (xr) {
      const v = String(Array.isArray(xr) ? xr[0] : xr).trim();
      if (v) return v.slice(0, 128);
    }
  }
  const ra = req.socket?.remoteAddress || '';
  const s = typeof ra === 'string' ? ra.replace(/^::ffff:/, '') : '';
  return s.slice(0, 128) || 'unknown';
}

/** Production / Vercel: require explicit PRESALE_CODE_PEPPER (no SRK fallback). */
export function presalePepperConfigured() {
  return !!(process.env.PRESALE_CODE_PEPPER && String(process.env.PRESALE_CODE_PEPPER).trim());
}

/** Local / self-hosted only: allow built-in dev pepper when NODE_ENV=production but not on Vercel (never enable on Vercel). */
function allowDefaultDevPresalePepper() {
  if (process.env.VERCEL === '1') return false;
  const v = process.env.PRESALE_ALLOW_DEFAULT_DEV_PEPPER;
  return v === '1' || v === 'true' || String(v).toLowerCase() === 'yes';
}

/** Call before hashing presale codes in production; responds 503 if misconfigured. */
export function requirePresalePepperOr503(res) {
  if (!presalePepperConfigured()) {
    if (process.env.VERCEL === '1') {
      res.status(503).json({
        success: false,
        reason: 'server_misconfigured',
        message:
          'Set PRESALE_CODE_PEPPER in the API environment (Vercel project env). Presale hashing is disabled until it is set.',
      });
      return false;
    }
    if (process.env.NODE_ENV === 'production' && !allowDefaultDevPresalePepper()) {
      res.status(503).json({
        success: false,
        reason: 'server_misconfigured',
        message:
          'Set PRESALE_CODE_PEPPER on the API server, or for a non-Vercel local API with NODE_ENV=production in .env, set PRESALE_ALLOW_DEFAULT_DEV_PEPPER=true (dev pepper only; never use that on public production).',
      });
      return false;
    }
  }
  return true;
}

export function getPepper() {
  const explicit = process.env.PRESALE_CODE_PEPPER?.trim();
  if (explicit) return explicit;
  if (process.env.VERCEL === '1') {
    throw new Error('PRESALE_CODE_PEPPER is required on Vercel');
  }
  if (process.env.NODE_ENV === 'production' && !allowDefaultDevPresalePepper()) {
    throw new Error('PRESALE_CODE_PEPPER is required when NODE_ENV=production');
  }
  return 'dev-only-presale-pepper-change-me';
}

export function normalizePresaleCode(code) {
  return String(code ?? '').trim().toLowerCase();
}

export function hashPresaleCode(eventId, code) {
  const normalized = normalizePresaleCode(code);
  const pepper = getPepper();
  return crypto.createHmac('sha256', pepper).update(`${eventId}:${normalized}`).digest('hex');
}

export function timingSafeEqualString(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const la = Buffer.byteLength(a);
  const lb = Buffer.byteLength(b);
  if (la !== lb) return false;
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return crypto.timingSafeEqual(ba, bb);
}

export function newCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function parseCookie(req, name) {
  const raw = req.headers.cookie || '';
  const parts = raw.split(';');
  for (const p of parts) {
    const idx = p.indexOf('=');
    if (idx === -1) continue;
    const k = p.slice(0, idx).trim();
    if (k === name) return decodeURIComponent(p.slice(idx + 1).trim());
  }
  return null;
}

/**
 * @param {string} sessionId
 * @param {number | undefined} maxAgeSec If omitted, cookie is a browser session cookie (no Max-Age).
 */
export function presaleCookieHeaderValue(sessionId, maxAgeSec) {
  const parts = [
    `${PRESALE_COOKIE_NAME}=${sessionId}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (typeof maxAgeSec === 'number' && maxAgeSec > 0) {
    parts.splice(2, 0, `Max-Age=${maxAgeSec}`);
  }
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function clearPresaleCookieHeader() {
  const parts = [
    `${PRESALE_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
    parts.push('Secure');
  }
  return parts.join('; ');
}

/**
 * @returns {Promise<{ id: string, presale_code_id: string, csrf_token: string } | null>}
 */
export async function fetchValidPresaleSessionRow(client, sessionId, eventId) {
  if (!sessionId || !eventId) return null;
  const { data, error } = await client
    .from('presale_sessions')
    .select('id, presale_code_id, csrf_token, expires_at, invalidated_at')
    .eq('id', sessionId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (error || !data) return null;
  if (data.invalidated_at) return null;
  if (new Date(data.expires_at) < new Date()) return null;
  return data;
}

export function presaleCsrfHeaderValid(sessionRow, headerVal) {
  if (!sessionRow || !headerVal) return false;
  return timingSafeEqualString(sessionRow.csrf_token, String(headerVal).trim());
}

function roundPresaleMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Mutates validatedPasses[].price from list prices using presale code row (percent or fixed spread).
 * @param {Array<{ price: number, quantity: number, eventPass: { price: unknown } }>} validatedPasses
 * @param {Record<string, unknown>} codeRow presale_codes row
 */
export function applyPresaleDiscountToPasses(validatedPasses, codeRow) {
  if (!codeRow || !codeRow.discount_type) return;
  if (codeRow.discount_type === 'percent') {
    const pct = Math.min(100, Math.max(0, parseFloat(codeRow.discount_value)));
    const factor = 1 - pct / 100;
    for (const vp of validatedPasses) {
      const base = parseFloat(vp.eventPass.price);
      vp.price = roundPresaleMoney(Math.max(0, base * factor));
    }
    return;
  }
  const subtotal = validatedPasses.reduce(
    (s, p) => s + parseFloat(p.eventPass.price) * p.quantity,
    0
  );
  const fixed = Math.min(subtotal, Math.max(0, parseFloat(codeRow.discount_value)));
  const factor = subtotal <= 0 ? 1 : Math.max(0, (subtotal - fixed) / subtotal);
  for (const vp of validatedPasses) {
    const base = parseFloat(vp.eventPass.price);
    vp.price = roundPresaleMoney(Math.max(0, base * factor));
  }
}

/**
 * When event has presale_enabled, validates cookie session + CSRF + presale_codes row and applies discount.
 * Payment method is not checked here (same as non-presale: pass allowed_payment_methods + order handler).
 *
 * Discounts are never taken from the HTTP client: only the `presale_codes` row loaded via the session
 * drives `applyPresaleDiscountToPasses` (do not accept discount fields on order-create JSON).
 *
 * On success with an active presale code, also returns a `presaleSnapshot` that captures the
 * code attribution and pre/post-discount subtotals so admin views can render presale details
 * without re-reading the RLS-protected `presale_codes` table.
 *
 * @returns {Promise<{ ok: true, presaleCodeId: string | null, presaleSnapshot: null | {
 *   code_id: string,
 *   code_label: string | null,
 *   discount_type: string,
 *   discount_value: number,
 *   original_subtotal: number,
 *   discounted_subtotal: number,
 * } } | { ok: false, error: string }>}
 */
export async function resolvePresaleForOrderCreate(dbClient, req, { primaryEventId, validatedPasses }) {
  if (!primaryEventId) {
    return { ok: true, presaleCodeId: null, presaleSnapshot: null };
  }
  const { data: evGate, error: evGateErr } = await dbClient
    .from('events')
    .select('id, presale_enabled')
    .eq('id', primaryEventId)
    .maybeSingle();
  if (evGateErr || !evGate?.presale_enabled) {
    return { ok: true, presaleCodeId: null, presaleSnapshot: null };
  }

  const sessionId = parseCookie(req, PRESALE_COOKIE_NAME);
  const sess = await fetchValidPresaleSessionRow(dbClient, sessionId, primaryEventId);
  const csrfHeader = req.headers[PRESALE_CSRF_HEADER] || req.headers['x-presale-csrf'];
  if (!sess || !presaleCsrfHeaderValid(sess, csrfHeader)) {
    return { ok: false, error: 'Presale session invalid' };
  }

  const { data: codeRow, error: codeErr } = await dbClient
    .from('presale_codes')
    .select('*')
    .eq('id', sess.presale_code_id)
    .maybeSingle();
  const now = new Date();
  if (codeErr || !codeRow || codeRow.revoked_at || codeRow.paused_at || codeRow.event_id !== primaryEventId) {
    return { ok: false, error: 'Presale code invalid' };
  }
  if (codeRow.active_from && new Date(codeRow.active_from) > now) {
    return { ok: false, error: 'Presale code window' };
  }
  if (codeRow.active_until && new Date(codeRow.active_until) < now) {
    return { ok: false, error: 'Presale code window' };
  }

  // Capture pre-discount subtotal BEFORE the helper mutates vp.price.
  const originalSubtotal = validatedPasses.reduce(
    (s, p) => s + parseFloat(p.eventPass.price) * (p.quantity || 0),
    0
  );

  applyPresaleDiscountToPasses(validatedPasses, codeRow);

  const discountedSubtotal = validatedPasses.reduce(
    (s, p) => s + parseFloat(p.price) * (p.quantity || 0),
    0
  );

  const presaleSnapshot = {
    code_id: codeRow.id,
    code_label: codeRow.label || null,
    discount_type: codeRow.discount_type,
    discount_value: parseFloat(codeRow.discount_value),
    original_subtotal: roundPresaleMoney(originalSubtotal),
    discounted_subtotal: roundPresaleMoney(discountedSubtotal),
  };

  return { ok: true, presaleCodeId: codeRow.id, presaleSnapshot };
}
