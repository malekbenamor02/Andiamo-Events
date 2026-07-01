'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildUtcDayBuckets,
  getActivityBucketDateUtc,
  isActivityOrder,
  aggregateActivityFromOrders,
} = require('./admin-dashboard-activity.cjs');

const dayBuckets = [
  { date: '2026-06-25', name: 'Thu', startIso: '2026-06-25T00:00:00.000Z', endIso: '2026-06-25T23:59:59.999Z' },
  { date: '2026-06-26', name: 'Fri', startIso: '2026-06-26T00:00:00.000Z', endIso: '2026-06-26T23:59:59.999Z' },
];

describe('admin-dashboard-activity aggregation', () => {
  it('buildUtcDayBuckets returns requested number of UTC days', () => {
    const buckets = buildUtcDayBuckets(7);
    assert.equal(buckets.length, 7);
    assert.match(buckets[0].date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(buckets[0].startIso.endsWith('T00:00:00.000Z'));
  });

  it('getActivityBucketDateUtc prefers completed_at', () => {
    const date = getActivityBucketDateUtc({
      created_at: '2026-06-20T10:00:00.000Z',
      completed_at: '2026-06-25T15:00:00.000Z',
    });
    assert.equal(date, '2026-06-25');
  });

  it('counts only paid/completed orders and revenue in buckets', () => {
    const orders = [
      {
        id: '1',
        source: 'platform_online',
        payment_method: 'online',
        payment_status: 'PAID',
        status: 'PAID',
        created_at: '2026-06-25T10:00:00.000Z',
        total_with_fees: 100,
        order_passes: [{ quantity: 1, price: 90 }],
      },
      {
        id: '2',
        source: 'platform_online',
        payment_method: 'online',
        payment_status: 'PENDING_PAYMENT',
        status: 'PENDING_ONLINE',
        created_at: '2026-06-25T11:00:00.000Z',
        total_price: 50,
      },
      {
        id: '3',
        payment_method: 'ambassador_cash',
        source: 'platform_cod',
        status: 'PENDING_CASH',
        created_at: '2026-06-25T12:00:00.000Z',
        total_price: 40,
      },
      {
        id: '4',
        payment_method: 'ambassador_cash',
        source: 'platform_cod',
        status: 'COMPLETED',
        completed_at: '2026-06-25T18:00:00.000Z',
        created_at: '2026-06-24T08:00:00.000Z',
        total_price: 60,
        order_passes: [{ quantity: 2, price: 30 }],
      },
      {
        id: '5',
        payment_method: 'ambassador_cash',
        source: 'ambassador_manual',
        status: 'MANUAL_COMPLETED',
        completed_at: '2026-06-26T09:00:00.000Z',
        created_at: '2026-06-20T08:00:00.000Z',
        total_price: 25,
      },
      {
        id: '6',
        source: 'platform_online',
        payment_method: 'online',
        payment_status: 'PAID',
        status: 'REMOVED_BY_ADMIN',
        created_at: '2026-06-25T13:00:00.000Z',
        total_price: 999,
      },
      {
        id: '7',
        source: 'platform_online',
        payment_method: 'online',
        payment_status: 'REFUNDED',
        status: 'PAID',
        created_at: '2026-06-25T14:00:00.000Z',
        total_price: 80,
      },
      {
        id: '8',
        source: 'point_de_vente',
        payment_method: 'pos',
        status: 'PAID',
        completed_at: '2026-06-26T12:00:00.000Z',
        total_price: 15,
        order_passes: [{ quantity: 1, price: 15 }],
      },
    ];

    assert.equal(isActivityOrder(orders[1]), false);
    assert.equal(isActivityOrder(orders[2]), false);
    assert.equal(isActivityOrder(orders[5]), false);
    assert.equal(isActivityOrder(orders[6]), false);
    assert.equal(isActivityOrder(orders[7], { includePos: false }), false);
    assert.equal(isActivityOrder(orders[7], { includePos: true }), true);

    const withoutPos = aggregateActivityFromOrders(orders, dayBuckets, { includePos: false });
    const jun25 = withoutPos.find((d) => d.date === '2026-06-25');
    const jun26 = withoutPos.find((d) => d.date === '2026-06-26');

    assert.equal(jun25.orders, 2);
    assert.equal(jun25.revenue, 160);
    assert.equal(jun26.orders, 1);
    assert.equal(jun26.revenue, 25);

    const withPos = aggregateActivityFromOrders(orders, dayBuckets, { includePos: true });
    const jun26Pos = withPos.find((d) => d.date === '2026-06-26');
    assert.equal(jun26Pos.orders, 2);
    assert.equal(jun26Pos.revenue, 40);
  });
});
