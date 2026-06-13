'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  buildAcademyPurchaseCustomData,
  isAcademyRegistrationTrackable,
  META_ACADEMY_CONTENT_CATEGORY,
} = require('./academy-purchase-payload.cjs');
const { getAcademyFormulaMeta, mapAcademyPaymentMethodForMeta } = require('./academy-catalog.cjs');

test('Academy formula catalog maps essentielle to academy_essential', () => {
  const meta = getAcademyFormulaMeta('essentielle');
  assert.strictEqual(meta.contentId, 'academy_essential');
  assert.strictEqual(meta.contentName, 'Andiamo Academy - Essential');
  assert.strictEqual(meta.basePriceDt, 850);
});

test('mapAcademyPaymentMethodForMeta maps card to online', () => {
  assert.strictEqual(mapAcademyPaymentMethodForMeta('card'), 'online');
  assert.strictEqual(mapAcademyPaymentMethodForMeta('rib'), 'rib');
  assert.strictEqual(mapAcademyPaymentMethodForMeta('d17'), 'd17');
});

test('buildAcademyPurchaseCustomData includes Academy Training category', () => {
  const data = buildAcademyPurchaseCustomData({
    id: 'reg-1',
    formule: 'pro',
    payment_method: 'd17',
    total_amount_dt: 1100,
  });
  assert.ok(data);
  assert.strictEqual(data.content_category, META_ACADEMY_CONTENT_CATEGORY);
  assert.strictEqual(data.content_category, 'Academy Training');
  assert.strictEqual(data.content_name, 'Andiamo Academy - Pro');
  assert.deepStrictEqual(data.content_ids, ['academy_pro']);
  assert.strictEqual(data.value, 1100);
  assert.strictEqual(data.payment_method, 'd17');
  assert.strictEqual(data.num_items, 1);
  assert.strictEqual(data.contents[0].item_price, 1100);
});

test('buildAcademyPurchaseCustomData includes promo_code when provided', () => {
  const data = buildAcademyPurchaseCustomData(
    {
      id: 'reg-2',
      formule: 'premium',
      payment_method: 'card',
      total_amount_dt: 2625,
    },
    { promoCode: 'SAVE10' }
  );
  assert.strictEqual(data.promo_code, 'SAVE10');
  assert.strictEqual(data.payment_method, 'online');
});

test('isAcademyRegistrationTrackable requires core fields', () => {
  assert.strictEqual(
    isAcademyRegistrationTrackable({
      id: 'x',
      email: 'a@b.com',
      phone: '+21622123456',
      full_name: 'Test User',
      formule: 'essentielle',
      payment_method: 'rib',
      total_amount_dt: 850,
    }),
    true
  );
  assert.strictEqual(
    isAcademyRegistrationTrackable({
      id: 'x',
      email: '',
      phone: '+21622123456',
      full_name: 'Test User',
      formule: 'essentielle',
      payment_method: 'rib',
      total_amount_dt: 850,
    }),
    false
  );
});
