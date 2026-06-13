'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  isMissingMetaColumnError,
  stripMetaFields,
} = require('./academy-meta-db.cjs');

test('isMissingMetaColumnError detects PGRST204', () => {
  assert.strictEqual(isMissingMetaColumnError({ code: 'PGRST204' }), true);
  assert.strictEqual(
    isMissingMetaColumnError({ message: "Could not find the 'meta_attribution' column" }),
    true
  );
  assert.strictEqual(isMissingMetaColumnError({ code: '23505' }), false);
});

test('stripMetaFields removes meta columns', () => {
  assert.deepStrictEqual(
    stripMetaFields({
      id: '1',
      meta_attribution: { eventId: 'x' },
      meta_purchase_sent_at: '2026-01-01',
      email: 'a@b.com',
    }),
    { id: '1', email: 'a@b.com' }
  );
});
