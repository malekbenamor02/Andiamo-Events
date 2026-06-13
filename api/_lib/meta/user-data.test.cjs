'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  sha256,
  normalizeEmail,
  normalizePhone,
  splitFullName,
  normalizeCity,
  buildHashedUserData,
} = require('./user-data.cjs');

test('normalizeEmail lowercases and trims', () => {
  assert.strictEqual(normalizeEmail('  User@Example.COM '), 'user@example.com');
  assert.strictEqual(normalizeEmail(''), null);
});

test('normalizePhone adds Tunisia country code for 8 digits', () => {
  assert.strictEqual(normalizePhone('22 123 456'), '21622123456');
  assert.strictEqual(normalizePhone('+216 22 123 456'), '21622123456');
  assert.strictEqual(normalizePhone('21622123456'), '21622123456');
});

test('splitFullName splits first and last', () => {
  assert.deepStrictEqual(splitFullName('Ahmed Ben Ali'), {
    fn: 'ahmed',
    ln: 'benali',
  });
  assert.deepStrictEqual(splitFullName('Solo'), { fn: 'solo', ln: null });
});

test('normalizeCity strips accents and spaces', () => {
  assert.strictEqual(normalizeCity('Sousse'), 'sousse');
  assert.strictEqual(normalizeCity('Centre Ville'), 'centreville');
});

test('buildHashedUserData returns hashed fields including country and external_id', () => {
  const data = buildHashedUserData({
    email: 'test@example.com',
    phone: '22123456',
    fullName: 'John Doe',
    city: 'Tunis',
  });
  assert.strictEqual(data.country, sha256('tn'));
  assert.strictEqual(data.em, sha256('test@example.com'));
  assert.strictEqual(data.ph, sha256('21622123456'));
  assert.strictEqual(data.fn, sha256('john'));
  assert.strictEqual(data.ln, sha256('doe'));
  assert.strictEqual(data.ct, sha256('tunis'));
  assert.strictEqual(data.external_id, sha256('test@example.com'));
});

test('buildHashedUserData omits external_id when email missing', () => {
  const data = buildHashedUserData({
    email: null,
    phone: '22123456',
    fullName: 'John Doe',
    city: 'Tunis',
  });
  assert.strictEqual(data.external_id, undefined);
});
