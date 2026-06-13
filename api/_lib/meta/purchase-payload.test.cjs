'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  META_TICKET_CONTENT_CATEGORY,
  buildPurchaseCustomData,
  resolvePurchaseValue,
} = require('./purchase-payload.cjs');

test('buildPurchaseCustomData includes Event Ticket content_category', () => {
  const data = buildPurchaseCustomData({
    order: {
      id: 'order-1',
      payment_method: 'ambassador_cash',
      total_price: 50,
    },
    orderPasses: [{ pass_id: 'pass-1', quantity: 2, price: 25 }],
    event: { name: 'Summer Fest' },
  });
  assert.strictEqual(data.content_category, META_TICKET_CONTENT_CATEGORY);
  assert.strictEqual(data.content_category, 'Event Ticket');
  assert.strictEqual(data.value, 50);
  assert.strictEqual(data.currency, 'TND');
});

test('resolvePurchaseValue uses fee-inclusive total for online orders', () => {
  const value = resolvePurchaseValue(
    {
      payment_method: 'online',
      total_with_fees: 105,
      total_price: 105,
    },
    [{ pass_id: 'p1', quantity: 1, price: 100 }]
  );
  assert.strictEqual(value, 105);
});
