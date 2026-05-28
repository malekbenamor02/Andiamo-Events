'use strict';

/** Academy promo codes: uppercase letters and digits only (exact match in DB). */
const ACADEMY_PROMO_CODE_RE = /^[A-Z0-9]+$/;

function normalizeAcademyPromoCode(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';
  const upper = trimmed.toUpperCase();
  if (!ACADEMY_PROMO_CODE_RE.test(upper)) return null;
  return upper;
}

module.exports = {
  ACADEMY_PROMO_CODE_RE,
  normalizeAcademyPromoCode,
};
