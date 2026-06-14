'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { sha256 } = require('./user-data.cjs');
const {
  isTicketOrderTrackable,
  buildCanonicalTicketPurchaseEvent,
  buildPixelPayloadFromCanonical,
  buildCapiServerEventFromCanonical,
  buildSafeTrackingLogMetadata,
} = require('./ticket-purchase-tracking.cjs');

const paidOnlineOrder = {
  id: 'order-abc',
  status: 'PAID',
  payment_method: 'online',
  total_with_fees: 105,
  total_price: 105,
  user_email: 'buyer@example.com',
  user_phone: '22123456',
  user_name: 'Sami Ben Ali',
  city: 'Tunis',
  meta_attribution: {
    eventId: 'purchase_1710000000000_a1b2c3d4',
    fbp: 'fb.1.test',
    fbc: 'fb.2.test',
    eventSourceUrl: 'https://example.com/summer-fest',
    clientIp: '203.0.113.10',
    clientUserAgent: 'Mozilla/5.0 Example',
  },
  event_promo_codes: { code: 'SAVE10' },
};

const orderPasses = [
  { pass_id: 'pass-1', quantity: 2, price: 50 },
];

const event = { id: 'ev-1', name: 'Summer Fest 2026' };

test('isTicketOrderTrackable allows ambassador_cash at create and online when PAID', () => {
  assert.strictEqual(isTicketOrderTrackable({ payment_method: 'ambassador_cash', status: 'PENDING_CASH' }), true);
  assert.strictEqual(isTicketOrderTrackable({ payment_method: 'online', status: 'PAID' }), true);
  assert.strictEqual(isTicketOrderTrackable({ payment_method: 'online', status: 'PENDING_ONLINE' }), false);
  assert.strictEqual(isTicketOrderTrackable({ payment_method: 'external_app', status: 'PAID' }), false);
});

test('buildCanonicalTicketPurchaseEvent builds commerce fields from order', () => {
  const canonical = buildCanonicalTicketPurchaseEvent({
    order: paidOnlineOrder,
    orderPasses,
    event,
    promoCode: 'SAVE10',
  });

  assert.ok(canonical);
  assert.strictEqual(canonical.eventId, 'purchase_1710000000000_a1b2c3d4');
  assert.strictEqual(canonical.orderId, 'order-abc');
  assert.strictEqual(canonical.value, 105);
  assert.strictEqual(canonical.currency, 'TND');
  assert.strictEqual(canonical.paymentMethod, 'online');
  assert.strictEqual(canonical.contentIds[0], 'pass-1');
  assert.strictEqual(canonical.numItems, 2);
  assert.strictEqual(canonical.contentName, 'Summer Fest 2026');
  assert.strictEqual(canonical.promoCode, 'SAVE10');
  assert.strictEqual(canonical.fbp, 'fb.1.test');
});

test('buildPixelPayloadFromCanonical excludes PII from commerce fields', () => {
  const canonical = buildCanonicalTicketPurchaseEvent({
    order: paidOnlineOrder,
    orderPasses,
    event,
  });
  const pixel = buildPixelPayloadFromCanonical(canonical);

  assert.ok(pixel);
  assert.strictEqual(pixel.eventId, canonical.eventId);
  assert.strictEqual(pixel.orderId, 'order-abc');
  assert.ok(pixel.advancedMatching.em);
  assert.strictEqual(pixel.advancedMatching.country, 'tn');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(pixel, 'fbp'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(pixel, 'email'), false);
});

test('buildCapiServerEventFromCanonical uses same event_id as pixel payload', () => {
  const canonical = buildCanonicalTicketPurchaseEvent({
    order: paidOnlineOrder,
    orderPasses,
    event,
  });
  const capi = buildCapiServerEventFromCanonical(canonical);
  const pixel = buildPixelPayloadFromCanonical(canonical);

  assert.ok(capi);
  assert.ok(pixel);
  assert.strictEqual(capi.event_id, pixel.eventId);
  assert.strictEqual(capi.custom_data.value, pixel.value);
  assert.strictEqual(capi.custom_data.order_id, pixel.orderId);
  assert.strictEqual(capi.custom_data.promo_code, 'SAVE10');
  assert.strictEqual(capi.user_data.em, sha256('buyer@example.com'));
  assert.strictEqual(capi.user_data.fbp, 'fb.1.test');
  assert.strictEqual(capi.user_data.fbc, 'fb.2.test');
  assert.strictEqual(capi.user_data.client_ip_address, '203.0.113.10');
  assert.strictEqual(capi.user_data.client_user_agent, 'Mozilla/5.0 Example');
});

test('buildCanonicalTicketPurchaseEvent generates eventId when not stored', () => {
  const order = {
    ...paidOnlineOrder,
    meta_attribution: { fbp: 'fb.1.test' },
  };
  const canonical = buildCanonicalTicketPurchaseEvent({ order, orderPasses, event });
  assert.ok(canonical);
  assert.ok(canonical.eventId.startsWith('purchase_order-abc_'));
});

test('stored eventId is reused across canonical rebuilds', () => {
  const first = buildCanonicalTicketPurchaseEvent({ order: paidOnlineOrder, orderPasses, event });
  const second = buildCanonicalTicketPurchaseEvent({ order: paidOnlineOrder, orderPasses, event });
  assert.strictEqual(first.eventId, second.eventId);
});

test('buildSafeTrackingLogMetadata never includes raw personal data', () => {
  const canonical = buildCanonicalTicketPurchaseEvent({ order: paidOnlineOrder, orderPasses, event });
  const metadata = buildSafeTrackingLogMetadata(canonical, {
    attempted: true,
    ok: true,
    skipped: false,
  });

  assert.strictEqual(metadata.orderId, 'order-abc');
  assert.strictEqual(metadata.eventId, canonical.eventId);
  assert.strictEqual(metadata.hasEmail, true);
  assert.strictEqual(metadata.hasPhone, true);
  assert.strictEqual(metadata.hasFbp, true);
  assert.strictEqual(metadata.hasFbc, true);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(metadata, 'email'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(metadata, 'phone'), false);
});

test('ambassador_cash order is trackable before PAID status', () => {
  const order = {
    id: 'order-cod',
    status: 'PENDING_CASH',
    payment_method: 'ambassador_cash',
    total_price: 50,
    user_email: 'buyer@example.com',
    user_phone: '22123456',
    user_name: 'Sami Ben Ali',
    city: 'Tunis',
    meta_attribution: { eventId: 'purchase_cod_1' },
  };
  const canonical = buildCanonicalTicketPurchaseEvent({
    order,
    orderPasses: [{ pass_id: 'pass-1', quantity: 1, price: 50 }],
    event,
  });
  assert.ok(canonical);
  assert.strictEqual(canonical.value, 50);
  assert.strictEqual(canonical.paymentMethod, 'ambassador_cash');
});
