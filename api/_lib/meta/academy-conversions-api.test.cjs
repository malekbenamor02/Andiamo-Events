'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { buildCapiAcademyPurchaseEvent } = require('./conversions-api.cjs');

test('buildCapiAcademyPurchaseEvent uses stored eventId and hashed user_data', () => {
  const event = buildCapiAcademyPurchaseEvent({
    registration: {
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
        eventSourceUrl: 'https://andiamoevents.com/academy/register',
        clientIp: '203.0.113.1',
        clientUserAgent: 'Mozilla/5.0',
      },
    },
  });

  assert.ok(event);
  assert.strictEqual(event.event_name, 'Purchase');
  assert.strictEqual(event.event_id, 'academy_purchase_123_abc');
  assert.strictEqual(event.custom_data.content_category, 'Academy Training');
  assert.strictEqual(event.custom_data.value, 850);
  assert.strictEqual(event.user_data.fbp, 'fb.1.test');
  assert.strictEqual(event.user_data.client_ip_address, '203.0.113.1');
  assert.ok(event.user_data.em);
  assert.ok(event.user_data.external_id);
  assert.notStrictEqual(event.user_data.em, 'student@example.com');
});

test('buildCapiAcademyPurchaseEvent returns null for invalid registration', () => {
  const event = buildCapiAcademyPurchaseEvent({
    registration: { id: 'x', formule: 'invalid', payment_method: 'rib' },
  });
  assert.strictEqual(event, null);
});
