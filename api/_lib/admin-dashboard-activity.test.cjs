'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildUtcDayBuckets,
  getActivityCreatedAtBucketDateUtc,
  isActivityOrder,
  isPendingActivityOrder,
  isExcludedActivitySource,
  aggregateActivityFromOrders,
  activityPaidRevenue,
  activityPendingRevenue,
} = require('./admin-dashboard-activity.cjs');

const dayBuckets = [
  { date: '2026-06-23', name: 'Mon', startIso: '2026-06-23T00:00:00.000Z', endIso: '2026-06-23T23:59:59.999Z' },
  { date: '2026-06-24', name: 'Tue', startIso: '2026-06-24T00:00:00.000Z', endIso: '2026-06-24T23:59:59.999Z' },
  { date: '2026-06-25', name: 'Wed', startIso: '2026-06-25T00:00:00.000Z', endIso: '2026-06-25T23:59:59.999Z' },
  { date: '2026-06-26', name: 'Thu', startIso: '2026-06-26T00:00:00.000Z', endIso: '2026-06-26T23:59:59.999Z' },
];

describe('admin-dashboard-activity aggregation', () => {
  it('buildUtcDayBuckets returns requested number of UTC days', () => {
    const buckets = buildUtcDayBuckets(7);
    assert.equal(buckets.length, 7);
    assert.match(buckets[0].date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(buckets[0].startIso.endsWith('T00:00:00.000Z'));
  });

  it('getActivityCreatedAtBucketDateUtc uses created_at only', () => {
    const date = getActivityCreatedAtBucketDateUtc({
      created_at: '2026-06-23T10:00:00.000Z',
      completed_at: '2026-06-26T15:00:00.000Z',
      payment_status_set_at: '2026-06-26T18:00:00.000Z',
      payment_status: 'PAID',
      payment_method: 'online',
    });
    assert.equal(date, '2026-06-23');
  });

  it('paid order created Monday and paid Tuesday appears on Monday', () => {
    const orders = [
      {
        id: 'late-paid',
        source: 'platform_online',
        payment_method: 'online',
        payment_status: 'PAID',
        status: 'PAID',
        created_at: '2026-06-23T09:00:00.000Z',
        completed_at: '2026-06-24T14:00:00.000Z',
        payment_status_set_at: '2026-06-24T14:00:00.000Z',
        total_with_fees: 120,
        order_passes: [{ quantity: 1, price: 100 }],
      },
    ];
    const result = aggregateActivityFromOrders(orders, dayBuckets);
    const mon = result.find((d) => d.date === '2026-06-23');
    const tue = result.find((d) => d.date === '2026-06-24');
    assert.equal(mon.orders, 1);
    assert.equal(mon.revenue, 120);
    assert.equal(tue.orders, 0);
    assert.equal(tue.revenue, 0);
  });

  it('paid online with payment_status_set_at buckets by created_at', () => {
    const order = {
      id: '1',
      source: 'platform_online',
      payment_method: 'online',
      payment_status: 'PAID',
      status: 'PAID',
      created_at: '2026-06-25T10:00:00.000Z',
      payment_status_set_at: '2026-06-26T20:00:00.000Z',
      total_with_fees: 100,
    };
    const wed = aggregateActivityFromOrders([order], dayBuckets).find((d) => d.date === '2026-06-25');
    const thu = aggregateActivityFromOrders([order], dayBuckets).find((d) => d.date === '2026-06-26');
    assert.equal(wed.orders, 1);
    assert.equal(thu.orders, 0);
  });

  it('COD MANUAL_COMPLETED and POS paid bucket by created_at', () => {
    const orders = [
      {
        id: 'cod',
        payment_method: 'ambassador_cash',
        source: 'ambassador_manual',
        status: 'MANUAL_COMPLETED',
        created_at: '2026-06-24T08:00:00.000Z',
        completed_at: '2026-06-26T09:00:00.000Z',
        total_price: 25,
        order_passes: [{ quantity: 1, price: 25 }],
      },
      {
        id: 'pos',
        source: 'point_de_vente',
        payment_method: 'pos',
        status: 'PAID',
        created_at: '2026-06-24T12:00:00.000Z',
        completed_at: '2026-06-26T12:00:00.000Z',
        total_price: 15,
        order_passes: [{ quantity: 1, price: 15 }],
      },
    ];
    const tue = aggregateActivityFromOrders(orders, dayBuckets).find((d) => d.date === '2026-06-24');
    assert.equal(tue.orders, 2);
    assert.equal(tue.revenue, 40);
    assert.equal(isActivityOrder(orders[0]), true);
    assert.equal(isActivityOrder(orders[1]), true);
  });

  it('pending online order counts in pending metrics only', () => {
    const order = {
      id: 'p-online',
      source: 'platform_online',
      payment_method: 'online',
      payment_status: 'PENDING_PAYMENT',
      status: 'PENDING_ONLINE',
      created_at: '2026-06-25T11:00:00.000Z',
      total_price: 50,
      order_passes: [{ quantity: 1, price: 50 }],
    };
    assert.equal(isActivityOrder(order), false);
    assert.equal(isPendingActivityOrder(order), true);
    const wed = aggregateActivityFromOrders([order], dayBuckets).find((d) => d.date === '2026-06-25');
    assert.equal(wed.orders, 0);
    assert.equal(wed.revenue, 0);
    assert.equal(wed.pendingOrders, 1);
    assert.equal(wed.pendingRevenue, 50);
    assert.equal(wed.totalCreatedOrders, 1);
    assert.equal(wed.totalPotentialRevenue, 50);
    assert.equal(activityPendingRevenue(order), 50);
  });

  it('pending COD order counts in pending metrics only', () => {
    const order = {
      id: 'p-cod',
      payment_method: 'ambassador_cash',
      source: 'platform_cod',
      status: 'PENDING_CASH',
      created_at: '2026-06-25T12:00:00.000Z',
      total_price: 40,
      order_passes: [{ quantity: 1, price: 40 }],
    };
    const wed = aggregateActivityFromOrders([order], dayBuckets).find((d) => d.date === '2026-06-25');
    assert.equal(wed.pendingOrders, 1);
    assert.equal(wed.pendingRevenue, 40);
    assert.equal(wed.orders, 0);
  });

  it('rejected cancelled failed refunded removed excluded from paid and pending', () => {
    const orders = [
      { id: '1', source: 'platform_online', payment_method: 'online', status: 'REJECTED', created_at: '2026-06-25T10:00:00.000Z' },
      { id: '2', source: 'platform_online', payment_method: 'online', status: 'CANCELLED', created_at: '2026-06-25T10:00:00.000Z' },
      { id: '3', source: 'platform_online', payment_method: 'online', status: 'FAILED', created_at: '2026-06-25T10:00:00.000Z' },
      { id: '4', source: 'platform_online', payment_method: 'online', payment_status: 'REFUNDED', status: 'PAID', created_at: '2026-06-25T10:00:00.000Z' },
      { id: '5', source: 'platform_online', payment_method: 'online', status: 'REMOVED_BY_ADMIN', created_at: '2026-06-25T10:00:00.000Z' },
      { id: '6', payment_method: 'ambassador_cash', source: 'platform_cod', status: 'REJECTED', created_at: '2026-06-25T10:00:00.000Z' },
    ];
    for (const o of orders) {
      assert.equal(isActivityOrder(o), false);
      assert.equal(isPendingActivityOrder(o), false);
    }
    const wed = aggregateActivityFromOrders(orders, dayBuckets).find((d) => d.date === '2026-06-25');
    assert.equal(wed.orders, 0);
    assert.equal(wed.pendingOrders, 0);
  });

  it('invitation sources excluded', () => {
    const orders = [
      { id: '1', source: 'official_invitation', status: 'PAID', created_at: '2026-06-25T10:00:00.000Z', total_price: 10 },
      { id: '2', source: 'Invitation', status: 'COMPLETED', created_at: '2026-06-25T10:00:00.000Z', total_price: 10 },
    ];
    assert.equal(isExcludedActivitySource(orders[0]), true);
    const wed = aggregateActivityFromOrders(orders, dayBuckets).find((d) => d.date === '2026-06-25');
    assert.equal(wed.orders, 0);
    assert.equal(wed.pendingOrders, 0);
  });

  it('totals equal paid plus pending', () => {
    const orders = [
      {
        id: 'paid',
        source: 'platform_online',
        payment_method: 'online',
        payment_status: 'PAID',
        status: 'PAID',
        created_at: '2026-06-25T10:00:00.000Z',
        total_with_fees: 100,
      },
      {
        id: 'pending',
        source: 'platform_online',
        payment_method: 'online',
        payment_status: 'PENDING_PAYMENT',
        status: 'PENDING_ONLINE',
        created_at: '2026-06-25T11:00:00.000Z',
        total_price: 60,
        order_passes: [{ quantity: 1, price: 60 }],
      },
    ];
    const wed = aggregateActivityFromOrders(orders, dayBuckets).find((d) => d.date === '2026-06-25');
    assert.equal(wed.totalCreatedOrders, wed.orders + wed.pendingOrders);
    assert.equal(wed.totalPotentialRevenue, wed.revenue + wed.pendingRevenue);
    assert.equal(wed.totalCreatedOrders, 2);
    assert.equal(wed.totalPotentialRevenue, 160);
  });

  it('order created outside window excluded even if paid inside window', () => {
    const order = {
      id: 'old',
      source: 'platform_online',
      payment_method: 'online',
      payment_status: 'PAID',
      status: 'PAID',
      created_at: '2026-06-20T10:00:00.000Z',
      completed_at: '2026-06-25T15:00:00.000Z',
      total_with_fees: 80,
    };
    const result = aggregateActivityFromOrders([order], dayBuckets);
    const anyCount = result.reduce((s, d) => s + d.orders, 0);
    assert.equal(anyCount, 0);
  });

  it('UTC created_at boundary respects UTC calendar day', () => {
    const order = {
      id: 'boundary',
      source: 'platform_online',
      payment_method: 'online',
      payment_status: 'PAID',
      status: 'PAID',
      created_at: '2026-06-24T23:30:00.000Z',
      total_with_fees: 30,
    };
    const tue = aggregateActivityFromOrders([order], dayBuckets).find((d) => d.date === '2026-06-24');
    const wed = aggregateActivityFromOrders([order], dayBuckets).find((d) => d.date === '2026-06-25');
    assert.equal(tue.orders, 1);
    assert.equal(wed.orders, 0);
    assert.equal(getActivityCreatedAtBucketDateUtc(order), '2026-06-24');
  });

  it('paid revenue uses report revenue for online paid orders', () => {
    const order = {
      source: 'platform_online',
      payment_method: 'online',
      payment_status: 'PAID',
      status: 'PAID',
      total_with_fees: 110,
      order_passes: [{ quantity: 1, price: 100 }],
    };
    assert.equal(activityPaidRevenue(order), 110);
  });
});
