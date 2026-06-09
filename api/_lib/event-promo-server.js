/**
 * Event promo orchestration for order-create and validate (delegates pricing to event-promo-pricing.js).
 */
import {
  applyEventPromoPricing,
  buildEventPromoOrderSnapshot,
  loadEventPromoWithPolicy,
  promoHasCapacityForUnits,
  PROMO_ALLOWED_PAYMENT_METHODS,
} from './event-promo-pricing.js';
import { normalizeEventPromoCode } from './event-promo-code.js';

/**
 * Resolve how many pass units consume promo max_uses (never 0 when promo is attached).
 * @param {object | null} promoSnapshot
 * @param {number} pricingUnits from applyEventPromoPricing.discountedUnits
 */
export function resolvePromoUsesClaimedCount(promoSnapshot, pricingUnits) {
  const fromPricing = Math.max(0, Math.floor(Number(pricingUnits) || 0));
  if (fromPricing > 0) return fromPricing;
  if (!promoSnapshot) return 0;
  const fromSnapshot = Math.max(0, Math.floor(Number(promoSnapshot.uses_claimed) || 0));
  if (fromSnapshot > 0) return fromSnapshot;
  const discountAmount = Number(promoSnapshot.discount_amount) || 0;
  const discountValue = Number(promoSnapshot.discount_value) || 0;
  if (promoSnapshot.discount_type === 'fixed' && discountValue > 0 && discountAmount > 0) {
    return Math.max(1, Math.round(discountAmount / discountValue));
  }
  return 0;
}

/**
 * Rate limit order create when a promo code is submitted.
 * @returns {Promise<boolean>} allowed
 */
export async function tryEventPromoOrderCreateRate(dbClient, ipKey) {
  const { data: rateRows, error: rateErr } = await dbClient.rpc('event_promo_order_create_rate_try', {
    p_ip_key: ipKey,
  });
  if (rateErr) {
    console.error('event_promo_order_create_rate_try', rateErr);
    return false;
  }
  const rateRow = Array.isArray(rateRows) ? rateRows[0] : rateRows;
  return !!rateRow?.allowed;
}

export async function releaseEventPromoUseRpc(dbClient, promoCodeId, uses = 1) {
  if (!promoCodeId) return;
  const count = Math.max(1, Math.floor(Number(uses) || 0));
  try {
    const { error } = await dbClient.rpc('event_promo_release_uses', {
      p_promo_code_id: promoCodeId,
      p_count: count,
    });
    if (error) console.error('event_promo_release_uses', error);
  } catch (e) {
    console.error('event_promo_release_uses', e);
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} dbClient
 * @param {string} promoCodeId
 * @param {number} uses
 * @returns {Promise<boolean>}
 */
export async function claimEventPromoUseRpc(dbClient, eventId, promoCodeId, uses = 1) {
  if (!promoCodeId || !eventId) return false;
  const count = Math.max(1, Math.floor(Number(uses) || 0));
  const { data: claimedRaw, error: claimErr } = await dbClient.rpc('event_promo_claim_uses', {
    p_event_id: eventId,
    p_promo_code_id: promoCodeId,
    p_count: count,
  });
  if (claimErr) {
    console.error('event_promo_claim_uses', claimErr);
    return false;
  }
  const claimedRows = Array.isArray(claimedRaw) ? claimedRaw : claimedRaw ? [claimedRaw] : [];
  return claimedRows.length > 0;
}

/**
 * Apply promo to validated passes for order create or validate preview.
 * @returns {Promise<
 *   | { ok: true, promoCodeId: null, promoSnapshot: null, promoUsesClaimed: 0 }
 *   | { ok: true, promoCodeId: string, promoSnapshot: object, promoUsesClaimed: number }
 *   | { ok: false, error: string }
 * >}
 */
export async function resolveEventPromoForOrderCreate(
  dbClient,
  { primaryEventId, promoCodeRaw, validatedPasses, paymentMethod }
) {
  const normalized = normalizeEventPromoCode(promoCodeRaw);
  if (!normalized) {
    if (promoCodeRaw != null && String(promoCodeRaw).trim() !== '') {
      return { ok: false, error: 'invalid_promo' };
    }
    return { ok: true, promoCodeId: null, promoSnapshot: null, promoUsesClaimed: 0 };
  }

  if (!primaryEventId) {
    return { ok: false, error: 'invalid_promo' };
  }

  const { data: evGate, error: evGateErr } = await dbClient
    .from('events')
    .select('id, presale_enabled')
    .eq('id', primaryEventId)
    .maybeSingle();

  if (evGateErr || !evGate) {
    return { ok: false, error: 'invalid_promo' };
  }

  if (evGate.presale_enabled) {
    return { ok: false, error: 'invalid_promo' };
  }

  if (!PROMO_ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
    return { ok: false, error: 'invalid_promo' };
  }

  const loaded = await loadEventPromoWithPolicy(dbClient, {
    eventId: primaryEventId,
    normalizedCode: normalized,
  });

  if (!loaded.promo || !loaded.policy) {
    return { ok: false, error: 'invalid_promo' };
  }

  const pricing = applyEventPromoPricing(validatedPasses, loaded.policy);
  const promoSnapshot = buildEventPromoOrderSnapshot(
    loaded.promo,
    loaded.passDiscountRows,
    pricing,
    pricing.discountedUnits || 0
  );
  const promoUsesClaimed = resolvePromoUsesClaimedCount(promoSnapshot, pricing.discountedUnits);
  if (!pricing.applied || pricing.discountTotal <= 0 || promoUsesClaimed < 1) {
    return { ok: false, error: 'invalid_promo' };
  }

  if (!promoHasCapacityForUnits(loaded.promo, promoUsesClaimed)) {
    return { ok: false, error: 'invalid_promo' };
  }

  promoSnapshot.uses_claimed = promoUsesClaimed;

  return {
    ok: true,
    promoCodeId: loaded.promo.id,
    promoSnapshot,
    promoUsesClaimed,
  };
}

/**
 * Validate-only: same pricing path, returns preview payload or generic invalid.
 */
export async function resolveEventPromoForValidate(
  dbClient,
  { eventId, promoCodeRaw, validatedPasses, paymentMethod }
) {
  const result = await resolveEventPromoForOrderCreate(dbClient, {
    primaryEventId: eventId,
    promoCodeRaw,
    validatedPasses,
    paymentMethod,
  });

  if (!result.ok) {
    return { valid: false, reason: 'invalid' };
  }

  if (!result.promoCodeId) {
    return { valid: false, reason: 'invalid' };
  }

  const subtotalAfter = validatedPasses.reduce(
    (s, p) => s + parseFloat(p.price) * (p.quantity || 0),
    0
  );

  return {
    valid: true,
    code: result.promoSnapshot.code,
    discountAmount: result.promoSnapshot.discount_amount,
    subtotalBeforePromo: result.promoSnapshot.original_subtotal,
    discountedSubtotal: result.promoSnapshot.discounted_subtotal,
    discountLabel:
      result.promoSnapshot.discount_mode === 'per_pass'
        ? 'Per pass'
        : result.promoSnapshot.discount_type === 'percent'
          ? `${result.promoSnapshot.discount_value}%`
          : `${result.promoSnapshot.discount_value} TND`,
    promoCodeId: result.promoCodeId,
    promoUsesClaimed: result.promoUsesClaimed,
    subtotalAfter,
  };
}
