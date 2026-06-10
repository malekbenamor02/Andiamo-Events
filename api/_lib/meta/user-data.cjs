'use strict';

const crypto = require('crypto');

/**
 * Meta Conversions API customer information normalization + SHA-256 hashing.
 * @see https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters
 */

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const v = email.trim().toLowerCase();
  return v.length ? v : null;
}

function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  let digits = phone.replace(/\D/g, '');
  if (!digits.length) return null;
  if (digits.startsWith('00216')) digits = digits.slice(2);
  if (digits.startsWith('216')) {
    // already has country code
  } else if (digits.length === 8) {
    digits = `216${digits}`;
  }
  return digits;
}

function normalizeNamePart(part) {
  if (!part || typeof part !== 'string') return null;
  const v = part
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
  return v.length ? v : null;
}

function splitFullName(fullName) {
  if (!fullName || typeof fullName !== 'string') {
    return { fn: null, ln: null };
  }
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { fn: null, ln: null };
  if (parts.length === 1) {
    return { fn: normalizeNamePart(parts[0]), ln: null };
  }
  return {
    fn: normalizeNamePart(parts[0]),
    ln: normalizeNamePart(parts.slice(1).join(' ')),
  };
}

function normalizeCity(city) {
  if (!city || typeof city !== 'string') return null;
  const v = city
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
  return v.length ? v : null;
}

/**
 * @param {{ email?: string|null; phone?: string|null; fullName?: string|null; city?: string|null }} customer
 * @returns {{ em?: string; ph?: string; fn?: string; ln?: string; ct?: string; country?: string }}
 */
function buildHashedUserData(customer) {
  const { fn, ln } = splitFullName(customer.fullName);
  const em = normalizeEmail(customer.email);
  const ph = normalizePhone(customer.phone);
  const ct = normalizeCity(customer.city);

  /** @type {Record<string, string>} */
  const out = { country: 'tn' };
  if (em) out.em = sha256(em);
  if (ph) out.ph = sha256(ph);
  if (fn) out.fn = sha256(fn);
  if (ln) out.ln = sha256(ln);
  if (ct) out.ct = sha256(ct);
  return out;
}

module.exports = {
  sha256,
  normalizeEmail,
  normalizePhone,
  normalizeNamePart,
  splitFullName,
  normalizeCity,
  buildHashedUserData,
};
