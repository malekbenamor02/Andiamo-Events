'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { sha256 } = require('./user-data.cjs');
const {
  isTicketOrderTrackable,
  resolvePurchaseEventTime,
  buildCanonicalTicketPurchaseEvent,
  buildPixelPayloadFromCanonical,
  buildCapiServerEventFromCanonical,
  buildSafeTrackingLogMetadata,
} = require('./ticket-purchase-tracking.cjs');
const { resolvePurchaseAttribution } = require('./attribution.cjs');

const VALID_FBC = 'fb.1.1700000000000.testclid';

const paidOnlineOrder = {
  id: 'order-abc',
  status: 'PAID',
  payment_method: 'online',
  total_with_fees: 105,
  total_price: 105,
  approved_at: '2026-06-15T14:30:00.000Z',
  created_at: '2026-06-15T14:00:00.000Z',
  updated_at: '2026-06-15T14:31:00.000Z',
  user_email: 'buyer@example.com',
  user_phone: '22123456',
  user_name: 'Sami Ben Ali',
  city: 'Tunis',
  meta_attribution: {
    eventId: 'purchase_1710000000000_a1b2c3d4',
    fbp: 'fb.1.test',
    fbc: VALID_FBC,
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

test('online order does not fire Purchase at creation (not trackable until PAID)', () => {
  assert.strictEqual(
    isTicketOrderTrackable({ payment_method: 'online', status: 'PENDING_ONLINE' }),
    false
  );
  const canonical = buildCanonicalTicketPurchaseEvent({
    order: {
      ...paidOnlineOrder,
      status: 'PENDING_ONLINE',
      meta_attribution: paidOnlineOrder.meta_attribution,
    },
    orderPasses,
    event,
  });
  assert.strictEqual(canonical, null);
});

test('failed online payment does not fire Purchase', () => {
  assert.strictEqual(isTicketOrderTrackable({ payment_method: 'online', status: 'FAILED' }), false);
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
  assert.strictEqual(canonical.fbc, VALID_FBC);
});

test('online event_time uses approved_at', () => {
  const canonical = buildCanonicalTicketPurchaseEvent({
    order: paidOnlineOrder,
    orderPasses,
    event,
  });
  assert.ok(canonical);
  assert.strictEqual(
    canonical.eventTime,
    Math.floor(new Date('2026-06-15T14:30:00.000Z').getTime() / 1000)
  );
});

test('COD event_time uses created_at', () => {
  const codOrder = {
    id: 'order-cod',
    status: 'PENDING_CASH',
    payment_method: 'ambassador_cash',
    total_price: 50,
    created_at: '2026-06-10T10:00:00.000Z',
    updated_at: '2026-06-10T10:05:00.000Z',
    user_email: 'buyer@example.com',
    user_phone: '22123456',
    user_name: 'Sami Ben Ali',
    city: 'Tunis',
    meta_attribution: { eventId: 'purchase_cod_1' },
  };
  const canonical = buildCanonicalTicketPurchaseEvent({
    order: codOrder,
    orderPasses: [{ pass_id: 'pass-1', quantity: 1, price: 50 }],
    event,
  });
  assert.ok(canonical);
  assert.strictEqual(
    canonical.eventTime,
    Math.floor(new Date('2026-06-10T10:00:00.000Z').getTime() / 1000)
  );
});

test('invalid stored fbc is dropped and not sent to CAPI', () => {
  const order = {
    ...paidOnlineOrder,
    meta_attribution: {
      ...paidOnlineOrder.meta_attribution,
      fbc: 'fb.2.invalid-format',
    },
  };
  const canonical = buildCanonicalTicketPurchaseEvent({ order, orderPasses, event });
  assert.ok(canonical);
  assert.strictEqual(canonical.fbc, undefined);

  const capi = buildCapiServerEventFromCanonical(canonical);
  assert.ok(capi);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(capi.user_data, 'fbc'), false);
});

test('resolvePurchaseAttribution merges cookie fallback for fbp and fbc', () => {
  const req = {
    headers: {
      cookie: `_fbp=fb.1.cookie-fbp; _fbc=${VALID_FBC}`,
      'x-forwarded-for': '203.0.113.99',
      'user-agent': 'Mozilla/5.0 CookieTest',
    },
    get: (name) => (name === 'user-agent' ? 'Mozilla/5.0 CookieTest' : undefined),
  };
  const resolved = resolvePurchaseAttribution({}, req);
  assert.strictEqual(resolved.fbp, 'fb.1.cookie-fbp');
  assert.strictEqual(resolved.fbc, VALID_FBC);
  assert.strictEqual(resolved.clientIp, '203.0.113.99');
  assert.strictEqual(resolved.clientUserAgent, 'Mozilla/5.0 CookieTest');
});

test('resolvePurchaseAttribution builds fbc from stored fbclid when fbc missing', () => {
  const resolved = resolvePurchaseAttribution(
    { metaFbclid: 'CLICK_FROM_STORE', eventSourceUrl: 'https://example.com/checkout' },
    { headers: {} }
  );
  assert.ok(resolved.fbc);
  assert.ok(resolved.fbc.startsWith('fb.1.'));
  assert.ok(resolved.fbc.endsWith('.CLICK_FROM_STORE'));
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
  assert.strictEqual(capi.user_data.fbc, VALID_FBC);
  assert.strictEqual(capi.user_data.client_ip_address, '203.0.113.10');
  assert.strictEqual(capi.user_data.client_user_agent, 'Mozilla/5.0 Example');
});

test('CAPI user_data keeps fbp fbc IP and UA unhashed', () => {
  const canonical = buildCanonicalTicketPurchaseEvent({
    order: paidOnlineOrder,
    orderPasses,
    event,
  });
  const capi = buildCapiServerEventFromCanonical(canonical);
  assert.ok(capi);
  assert.notStrictEqual(capi.user_data.fbp, sha256('fb.1.test'));
  assert.notStrictEqual(capi.user_data.fbc, sha256(VALID_FBC));
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
  assert.strictEqual(metadata.hasIp, true);
  assert.strictEqual(metadata.hasUserAgent, true);
  assert.strictEqual(metadata.hasEventId, true);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(metadata, 'email'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(metadata, 'phone'), false);
});

test('ambassador_cash order is trackable before PAID status', () => {
  const order = {
    id: 'order-cod',
    status: 'PENDING_CASH',
    payment_method: 'ambassador_cash',
    total_price: 50,
    created_at: '2026-06-10T10:00:00.000Z',
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

test('resolvePurchaseEventTime online prefers approved_at over updated_at', () => {
  const t = resolvePurchaseEventTime({
    payment_method: 'online',
    approved_at: '2026-01-01T12:00:00.000Z',
    updated_at: '2026-01-02T12:00:00.000Z',
    created_at: '2026-01-03T12:00:00.000Z',
  });
  assert.strictEqual(t, Math.floor(new Date('2026-01-01T12:00:00.000Z').getTime() / 1000));
});

test('resolvePurchaseEventTime COD prefers created_at over updated_at', () => {
  const t = resolvePurchaseEventTime({
    payment_method: 'ambassador_cash',
    created_at: '2026-01-01T12:00:00.000Z',
    updated_at: '2026-01-02T12:00:00.000Z',
  });
  assert.strictEqual(t, Math.floor(new Date('2026-01-01T12:00:00.000Z').getTime() / 1000));
});
