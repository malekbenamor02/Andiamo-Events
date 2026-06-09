/**
 * HMAC storage for event promo codes (mirrors presale; uppercase normalization).
 */
import crypto from 'crypto';
import { normalizeEventPromoCode } from './event-promo-code.js';
import { publicApiError, PUBLIC_ERROR_CODES } from './public-api-error.js';

export function eventPromoPepperConfigured() {
  const v =
    process.env.EVENT_PROMO_CODE_PEPPER?.trim() || process.env.PRESALE_CODE_PEPPER?.trim();
  return !!v;
}

function allowDefaultDevPromoPepper() {
  if (process.env.VERCEL === '1') return false;
  const v = process.env.EVENT_PROMO_ALLOW_DEFAULT_DEV_PEPPER ?? process.env.PRESALE_ALLOW_DEFAULT_DEV_PEPPER;
  return v === '1' || v === 'true' || String(v).toLowerCase() === 'yes';
}

/** Responds 503 when hashing is required but pepper is missing (production / Vercel). */
export function requireEventPromoPepperOr503(res) {
  if (!eventPromoPepperConfigured()) {
    if (process.env.VERCEL === '1') {
      publicApiError(res, 503, PUBLIC_ERROR_CODES.SERVICE_UNAVAILABLE, undefined, {
        logDetails: 'EVENT_PROMO_CODE_PEPPER missing on Vercel',
      });
      return false;
    }
    if (process.env.NODE_ENV === 'production' && !allowDefaultDevPromoPepper()) {
      publicApiError(res, 503, PUBLIC_ERROR_CODES.SERVICE_UNAVAILABLE, undefined, {
        logDetails: 'EVENT_PROMO_CODE_PEPPER missing in production',
      });
      return false;
    }
  }
  return true;
}

export function getEventPromoPepper() {
  const explicit =
    process.env.EVENT_PROMO_CODE_PEPPER?.trim() || process.env.PRESALE_CODE_PEPPER?.trim();
  if (explicit) return explicit;
  if (process.env.VERCEL === '1') {
    throw new Error('EVENT_PROMO_CODE_PEPPER or PRESALE_CODE_PEPPER is required on Vercel');
  }
  if (process.env.NODE_ENV === 'production' && !allowDefaultDevPromoPepper()) {
    throw new Error('EVENT_PROMO_CODE_PEPPER is required when NODE_ENV=production');
  }
  return 'dev-only-event-promo-pepper-change-me';
}

/**
 * @param {string} eventId
 * @param {string} normalizedCode uppercase A-Z0-9
 */
export function hashEventPromoCode(eventId, normalizedCode) {
  const normalized = normalizeEventPromoCode(normalizedCode);
  if (!normalized) throw new Error('hashEventPromoCode: invalid code');
  const pepper = getEventPromoPepper();
  return crypto.createHmac('sha256', pepper).update(`${eventId}:${normalized}`).digest('hex');
}

/** Admin / order snapshot display string (DB column: label). */
export function eventPromoDisplayCode(row) {
  if (!row?.label) return '';
  return String(row.label).trim();
}
