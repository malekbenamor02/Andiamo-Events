import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyEventPromoPricing,
  buildEventPromoDiscountPolicy,
  promoHasCapacityForUnits,
} from '../../../api/_lib/event-promo-discount.js';
import { previewCheckoutTotals } from '../../../api/_lib/event-promo-pricing.js';
import { eventPromoDisplayCode, hashEventPromoCode } from '../../../api/_lib/event-promo-hash.js';

describe('eventPromo hash', () => {
  const prevPepper = process.env.EVENT_PROMO_CODE_PEPPER;
  const prevNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.EVENT_PROMO_CODE_PEPPER = 'test-promo-pepper';
  });

  afterEach(() => {
    if (prevPepper === undefined) delete process.env.EVENT_PROMO_CODE_PEPPER;
    else process.env.EVENT_PROMO_CODE_PEPPER = prevPepper;
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
  });

  it('hashes deterministically per event + code', () => {
    const eventId = 'f831c0f8-d0b3-4000-8c98-cb0a38aace8e';
    const a = hashEventPromoCode(eventId, 'GOOBA');
    const b = hashEventPromoCode(eventId, 'GOOBA');
    const c = hashEventPromoCode(eventId, 'OTHER');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('eventPromoDisplayCode returns label only', () => {
    expect(eventPromoDisplayCode({ label: 'GOOBA' })).toBe('GOOBA');
    expect(eventPromoDisplayCode({ label: '' })).toBe('');
    expect(eventPromoDisplayCode(null)).toBe('');
  });
});

describe('eventPromo pricing', () => {
  it('applies uniform percent discount to all pass units', () => {
    const lines = [
      {
        passId: 'p1',
        quantity: 2,
        price: 100,
        eventPass: { id: 'p1', price: 100 },
      },
    ];
    const policy = buildEventPromoDiscountPolicy(
      { discount_mode: 'uniform', discount_type: 'percent', discount_value: 10 },
      []
    );
    const result = applyEventPromoPricing(lines, policy);
    expect(result.discountTotal).toBe(20);
    expect(result.discountedUnits).toBe(2);
    expect(lines[0].price).toBe(90);
  });

  it('applies per_pass rules only on configured passes', () => {
    const lines = [
      { passId: 'p1', quantity: 1, price: 50, eventPass: { id: 'p1', price: 50 } },
      { passId: 'p2', quantity: 1, price: 30, eventPass: { id: 'p2', price: 30 } },
    ];
    const policy = buildEventPromoDiscountPolicy(
      { discount_mode: 'per_pass', discount_type: 'percent', discount_value: 0 },
      [{ event_pass_id: 'p1', discount_type: 'fixed', discount_value: 5 }]
    );
    const result = applyEventPromoPricing(lines, policy);
    expect(lines[0].price).toBe(45);
    expect(lines[1].price).toBe(30);
    expect(result.discountTotal).toBe(5);
    expect(result.discountedUnits).toBe(1);
  });

  it('previewCheckoutTotals applies fees after promo subtotal', () => {
    const preview = previewCheckoutTotals(90, 'online');
    expect(preview.feeAmount).toBeGreaterThan(0);
    expect(preview.totalWithFees).toBeGreaterThan(90);
  });

  it('promoHasCapacityForUnits requires enough remaining slots for pass qty', () => {
    const promo = { used_count: 8, max_uses: 10 };
    expect(promoHasCapacityForUnits(promo, 2)).toBe(true);
    expect(promoHasCapacityForUnits(promo, 3)).toBe(false);
  });
});
