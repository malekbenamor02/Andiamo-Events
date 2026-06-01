'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { splitEventHeadline } = require('./premium-ticket-page-html.cjs');

test('two-word title stays on one line', () => {
  assert.deepStrictEqual(splitEventHeadline('Coming Soon'), { line1: '', line2: 'Coming Soon' });
});

test('single word uses accent line only', () => {
  assert.deepStrictEqual(splitEventHeadline('Solstice'), { line1: '', line2: 'Solstice' });
});

test('three or more words split across muted and accent lines', () => {
  assert.deepStrictEqual(splitEventHeadline('Summer Beach Festival'), {
    line1: 'Summer Beach',
    line2: 'Festival',
  });
});
