'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  generateTemporaryPassword,
  validateNewPassword,
} = require('./academy-influencer-password.cjs');

describe('academy-influencer-password', () => {
  it('generates temporary passwords meeting complexity rules', () => {
    for (let i = 0; i < 20; i++) {
      const pw = generateTemporaryPassword();
      assert.ok(pw.length >= 12);
      assert.match(pw, /[A-Z]/);
      assert.match(pw, /[a-z]/);
      assert.match(pw, /[0-9]/);
      assert.match(pw, /[!@#$%&*]/);
    }
  });

  it('validates new password strength', () => {
    assert.equal(validateNewPassword('Abcd1234').ok, true);
    assert.equal(validateNewPassword('short1A').ok, false);
    assert.equal(validateNewPassword('alllowercase1').ok, false);
  });
});
