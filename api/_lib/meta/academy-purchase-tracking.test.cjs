'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  buildCanonicalAcademyPurchaseEvent,
  buildPixelPayloadFromCanonical,
  buildCapiServerEventFromCanonical,
  buildSafeTrackingLogMetadata,
} = require('./academy-purchase-tracking.cjs');

const trackableRegistration = {
  id: 'reg-abc',
  email: 'student@example.com',
  phone: '+21622123456',
  full_name: 'Jane Doe',
  formule: 'essentielle',
  payment_method: 'rib',
  total_amount_dt: 850,
  meta_attribution: {
    eventId: 'academy_purchase_123_abc',
    fbp: 'fb.1.test',
    fbc: 'fb.2.test',
    eventSourceUrl: 'https://andiamoevents.com/academy/register',
    clientIp: '203.0.113.1',
    clientUserAgent: 'Mozilla/5.0',
  },
};

test('buildCanonicalAcademyPurchaseEvent builds commerce fields from registration', () => {
  const canonical = buildCanonicalAcademyPurchaseEvent({
    registration: trackableRegistration,
    promoCode: 'SAVE10',
  });

  assert.ok(canonical);
  assert.strictEqual(canonical.eventId, 'academy_purchase_123_abc');
  assert.strictEqual(canonical.value, 850);
  assert.strictEqual(canonical.currency, 'TND');
  assert.strictEqual(canonical.paymentMethod, 'rib');
  assert.strictEqual(canonical.contentIds[0], 'academy_essential');
  assert.strictEqual(canonical.promoCode, 'SAVE10');
  assert.strictEqual(canonical.fbp, 'fb.1.test');
  assert.strictEqual(canonical.eventIdWasStored, true);
});

test('buildPixelPayloadFromCanonical excludes PII from commerce fields and includes advancedMatching', () => {
  const canonical = buildCanonicalAcademyPurchaseEvent({ registration: trackableRegistration });
  const pixel = buildPixelPayloadFromCanonical(canonical);

  assert.ok(pixel);
  assert.strictEqual(pixel.eventId, canonical.eventId);
  assert.strictEqual(pixel.orderId, 'reg-abc');
  assert.ok(pixel.advancedMatching.em);
  assert.ok(pixel.advancedMatching.ph);
  assert.ok(pixel.advancedMatching.fn);
  assert.strictEqual(pixel.advancedMatching.country, 'tn');
  assert.strictEqual(pixel.advancedMatching.em, 'student@example.com');
  assert.notStrictEqual(Object.prototype.hasOwnProperty.call(pixel, 'fbp'), true);
  assert.notStrictEqual(Object.prototype.hasOwnProperty.call(pixel, 'email'), true);
});

test('buildCapiServerEventFromCanonical uses same event_id as pixel payload', () => {
  const canonical = buildCanonicalAcademyPurchaseEvent({ registration: trackableRegistration });
  const capi = buildCapiServerEventFromCanonical(canonical);
  const pixel = buildPixelPayloadFromCanonical(canonical);

  assert.ok(capi);
  assert.ok(pixel);
  assert.strictEqual(capi.event_id, pixel.eventId);
  assert.strictEqual(capi.custom_data.value, pixel.value);
  assert.strictEqual(capi.custom_data.payment_method, pixel.paymentMethod);
  assert.ok(capi.user_data.em);
  assert.notStrictEqual(capi.user_data.em, 'student@example.com');
});

test('buildCanonicalAcademyPurchaseEvent returns null for invalid registration', () => {
  const canonical = buildCanonicalAcademyPurchaseEvent({
    registration: { id: 'x', formule: 'invalid', payment_method: 'rib' },
  });
  assert.strictEqual(canonical, null);
});

test('buildSafeTrackingLogMetadata never includes raw personal data', () => {
  const canonical = buildCanonicalAcademyPurchaseEvent({ registration: trackableRegistration });
  const metadata = buildSafeTrackingLogMetadata(canonical, {
    attempted: true,
    ok: true,
    skipped: false,
  });

  assert.strictEqual(metadata.hasEmail, true);
  assert.strictEqual(metadata.hasPhone, true);
  assert.strictEqual(metadata.hasFbp, true);
  assert.strictEqual(metadata.hasFbc, true);
  assert.strictEqual(metadata.eventId, canonical.eventId);
  assert.strictEqual(metadata.registrationId, 'reg-abc');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(metadata, 'email'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(metadata, 'phone'), false);
});

test('buildCanonicalAcademyPurchaseEvent generates eventId when not stored', () => {
  const reg = {
    ...trackableRegistration,
    meta_attribution: { fbp: 'fb.1.test' },
  };
  const canonical = buildCanonicalAcademyPurchaseEvent({ registration: reg });
  assert.ok(canonical);
  assert.ok(canonical.eventId.startsWith('academy_purchase_reg-abc_'));
  assert.strictEqual(canonical.eventIdWasStored, false);
});

test('stored eventId is reused across canonical rebuilds', () => {
  const first = buildCanonicalAcademyPurchaseEvent({ registration: trackableRegistration });
  const second = buildCanonicalAcademyPurchaseEvent({ registration: trackableRegistration });
  assert.strictEqual(first.eventId, second.eventId);
  assert.strictEqual(first.eventId, 'academy_purchase_123_abc');
});

test('buildCapiServerEventFromCanonical includes required CAPI fields', () => {
  const canonical = buildCanonicalAcademyPurchaseEvent({ registration: trackableRegistration });
  const capi = buildCapiServerEventFromCanonical(canonical);
  assert.ok(capi);
  assert.strictEqual(capi.event_name, 'Purchase');
  assert.ok(capi.event_time);
  assert.strictEqual(capi.action_source, 'website');
  assert.strictEqual(capi.event_source_url, trackableRegistration.meta_attribution.eventSourceUrl);
  assert.ok(capi.user_data.em);
  assert.ok(capi.user_data.ph);
  assert.ok(capi.user_data.fn);
  assert.ok(capi.user_data.country);
  assert.ok(capi.user_data.external_id);
  assert.strictEqual(capi.user_data.fbp, 'fb.1.test');
  assert.strictEqual(capi.user_data.fbc, 'fb.2.test');
  assert.strictEqual(capi.user_data.client_ip_address, '203.0.113.1');
  assert.strictEqual(capi.user_data.client_user_agent, 'Mozilla/5.0');
  assert.strictEqual(capi.custom_data.value, 850);
  assert.strictEqual(capi.custom_data.currency, 'TND');
  assert.strictEqual(capi.custom_data.content_type, 'product');
  assert.strictEqual(capi.custom_data.order_id, 'reg-abc');
});

test('pixel advancedMatching is separate from commerce fields', () => {
  const canonical = buildCanonicalAcademyPurchaseEvent({ registration: trackableRegistration });
  const pixel = buildPixelPayloadFromCanonical(canonical);
  assert.ok(pixel);
  assert.ok(pixel.advancedMatching);
  assert.strictEqual(pixel.advancedMatching.em, 'student@example.com');
  const commerceKeys = [
    'eventId',
    'orderId',
    'value',
    'currency',
    'contentCategory',
    'contentIds',
    'contentName',
    'numItems',
    'paymentMethod',
    'contents',
    'advancedMatching',
  ];
  for (const key of Object.keys(pixel)) {
    assert.ok(commerceKeys.includes(key), `unexpected pixel field: ${key}`);
  }
  assert.strictEqual(Object.prototype.hasOwnProperty.call(pixel, 'email'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(pixel, 'fbp'), false);
});
