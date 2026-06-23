'use strict';

const crypto = require('crypto');

const TEMP_PASSWORD_LENGTH = 14;
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghjkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%&*';

function pick(chars) {
  return chars[crypto.randomInt(0, chars.length)];
}

/** Secure temporary password: 12+ chars, upper, lower, digit, symbol. */
function generateTemporaryPassword() {
  const required = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  const all = UPPER + LOWER + DIGITS + SYMBOLS;
  while (required.length < TEMP_PASSWORD_LENGTH) {
    required.push(pick(all));
  }
  for (let i = required.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [required[i], required[j]] = [required[j], required[i]];
  }
  return required.join('');
}

function validateNewPassword(password) {
  const p = String(password || '');
  if (p.length < 8) return { ok: false, error: 'Password must be at least 8 characters' };
  if (!/[A-Z]/.test(p)) return { ok: false, error: 'Password must include an uppercase letter' };
  if (!/[a-z]/.test(p)) return { ok: false, error: 'Password must include a lowercase letter' };
  if (!/[0-9]/.test(p)) return { ok: false, error: 'Password must include a number' };
  return { ok: true };
}

module.exports = {
  generateTemporaryPassword,
  validateNewPassword,
};
