'use strict';

const { FORMULA_IDS, PAYMENT_METHODS } = require('./academy-pricing.cjs');
const { normalizeAcademyPromoCode, ACADEMY_PROMO_CODE_RE } = require('./academy-promo-code.cjs');

const FORBIDDEN_BODY_KEYS = new Set([
  'total',
  'total_amount_dt',
  'base_amount_dt',
  'discount_amount_dt',
  'fee_amount_dt',
  'status',
  'amount',
  'amountDt',
  'registration_number',
  'id',
  'payment_gateway_reference',
  'payment_confirm_response',
]);

const PROOF_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

const PROOF_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'pdf']);
const PROOF_MAX_BYTES = 5 * 1024 * 1024;

function rejectForbiddenKeys(body) {
  if (!body || typeof body !== 'object') return { ok: true, keys: [] };
  const keys = Object.keys(body).filter((k) => FORBIDDEN_BODY_KEYS.has(k));
  if (keys.length) return { ok: false, keys };
  return { ok: true, keys: [] };
}

function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const t = email.trim();
  return t.length > 0 && t.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

function validatePhoneTn(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length === 8 && /^[2459]\d{7}$/.test(digits);
}

function normalizePhoneTn(phone) {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 8) return `+216${digits}`;
  if (digits.startsWith('216') && digits.length === 11) return `+${digits}`;
  return digits.startsWith('+') ? digits : `+216${digits}`;
}

function validateFullName(name) {
  if (!name || typeof name !== 'string') return false;
  const t = name.trim();
  return t.length >= 3 && t.length <= 120;
}

function requiresPaymentProof(paymentMethod) {
  return paymentMethod === 'rib' || paymentMethod === 'd17';
}

function isAllowedProofMime(mime, filename) {
  const m = (mime || '').toLowerCase().split(';')[0].trim();
  if (m && PROOF_MIME.has(m)) return true;
  const ext = (filename || '').split('.').pop()?.toLowerCase();
  return ext ? PROOF_EXT.has(ext) : false;
}

function validateRegistrationPayload(body) {
  const errors = [];
  const forbidden = rejectForbiddenKeys(body);
  if (!forbidden.ok) {
    return { ok: false, errors: ['Forbidden fields in request'], forbiddenKeys: forbidden.keys };
  }

  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const formule = typeof body.formule === 'string' ? body.formule.trim() : '';
  const paymentMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod.trim() : '';
  const acceptTerms = body.acceptTerms === true || body.acceptTerms === 'true';
  const honeypot = typeof body.honeypot === 'string' ? body.honeypot.trim() : '';
  const clientElapsedMs = Number(body.client_elapsed_ms ?? body.clientElapsedMs ?? 0);
  let promoCode = null;
  if (typeof body.promoCode === 'string' && body.promoCode.trim()) {
    const normalized = normalizeAcademyPromoCode(body.promoCode);
    if (normalized === null) errors.push('Invalid promo code');
    else promoCode = normalized;
  }

  if (honeypot.length > 0) errors.push('Spam detected');
  if (!Number.isFinite(clientElapsedMs) || clientElapsedMs < 1500 || clientElapsedMs > 1800000) {
    errors.push('Invalid timing');
  }
  if (!validateFullName(fullName)) errors.push('Invalid full name');
  if (!validateEmail(email)) errors.push('Invalid email');
  if (!validatePhoneTn(phone)) errors.push('Invalid phone');
  if (!FORMULA_IDS.includes(formule)) errors.push('Invalid formula');
  if (!PAYMENT_METHODS.includes(paymentMethod)) errors.push('Invalid payment method');
  if (!acceptTerms) errors.push('Terms must be accepted');

  return {
    ok: errors.length === 0,
    errors,
    data: {
      fullName,
      email,
      phone: normalizePhoneTn(phone),
      formule,
      paymentMethod,
      promoCode,
      clientElapsedMs: Math.round(clientElapsedMs),
    },
  };
}

module.exports = {
  normalizeAcademyPromoCode,
  ACADEMY_PROMO_CODE_RE,
  FORBIDDEN_BODY_KEYS,
  PROOF_MAX_BYTES,
  rejectForbiddenKeys,
  validateEmail,
  validatePhoneTn,
  normalizePhoneTn,
  validateFullName,
  requiresPaymentProof,
  isAllowedProofMime,
  validateRegistrationPayload,
};
