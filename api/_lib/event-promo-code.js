'use strict';

/** Event checkout promo codes: uppercase letters and digits only. */
export const EVENT_PROMO_CODE_RE = /^[A-Z0-9]+$/;
export const EVENT_PROMO_CODE_MAX_LEN = 32;

/**
 * @param {unknown} raw
 * @returns {string | null} normalized code, '' if empty, null if invalid
 */
export function normalizeEventPromoCode(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';
  const upper = trimmed.toUpperCase().slice(0, EVENT_PROMO_CODE_MAX_LEN);
  if (!EVENT_PROMO_CODE_RE.test(upper)) return null;
  return upper;
}

/**
 * Parse optional promoCode from order-create body (allowlisted field only).
 * @param {unknown} body
 * @returns {{ ok: true, code: string | null } | { ok: false, error: string }}
 */
export function parseAllowedPromoCodeFromOrderBody(body) {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: true, code: null };
  }
  if (!('promoCode' in body)) {
    return { ok: true, code: null };
  }
  const raw = body.promoCode;
  if (raw === null || raw === undefined || raw === '') {
    return { ok: true, code: null };
  }
  if (typeof raw !== 'string') {
    return { ok: false, error: 'invalid_promo' };
  }
  const normalized = normalizeEventPromoCode(raw);
  if (normalized === null) {
    return { ok: false, error: 'invalid_promo' };
  }
  return { ok: true, code: normalized || null };
}
