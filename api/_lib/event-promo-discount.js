/**
 * Event promo discount policy — reuses presale discount math (uniform / per_pass).
 */
import {
  applyPresaleDiscountToPasses,
  buildPresaleDiscountPolicy,
  buildPresalePassBreakdown,
  getPassDiscountRuleFromPolicy,
  normalizePresaleDiscountRule,
  roundPresaleMoney,
  validateAdminPassDiscounts,
} from './presale-discount.js';
import {
  eventPromoDisplayCode,
  eventPromoPepperConfigured,
  hashEventPromoCode,
} from './event-promo-hash.js';

export { validateAdminPassDiscounts as validateEventPromoPassDiscounts };

/**
 * @param {Record<string, unknown>} codeRow
 * @param {Array<Record<string, unknown>>} passDiscountRows
 */
export function buildEventPromoDiscountPolicy(codeRow, passDiscountRows = []) {
  return buildPresaleDiscountPolicy(codeRow, passDiscountRows);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} promoCodeId
 */
export async function loadEventPromoPassDiscountRows(db, promoCodeId) {
  const { data, error } = await db
    .from('event_promo_code_pass_discounts')
    .select('event_pass_id, discount_type, discount_value, event_passes(name)')
    .eq('promo_code_id', promoCodeId);
  if (error) throw error;
  return (data || []).map((row) => ({
    event_pass_id: row.event_pass_id,
    pass_name:
      row.event_passes && typeof row.event_passes === 'object' && row.event_passes.name != null
        ? String(row.event_passes.name)
        : null,
    discount_type: row.discount_type,
    discount_value: row.discount_value != null ? Number(row.discount_value) : 0,
  }));
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {{ eventId: string, normalizedCode: string }} params
 */
const PROMO_SELECT_FIELDS =
  'id, event_id, label, code_hash, badge_color, discount_mode, discount_type, discount_value, applies_to_all, max_uses, used_count, is_active, revoked_at';

export async function loadEventPromoWithPolicy(db, { eventId, normalizedCode }) {
  if (!normalizedCode) {
    return { promo: null, policy: null, passDiscountRows: [], reason: 'empty' };
  }

  if (!eventPromoPepperConfigured()) {
    return { promo: null, policy: null, passDiscountRows: [], reason: 'invalid' };
  }

  const codeHash = hashEventPromoCode(eventId, normalizedCode);
  const { data: promo, error: hashErr } = await db
    .from('event_promo_codes')
    .select(PROMO_SELECT_FIELDS)
    .eq('event_id', eventId)
    .eq('code_hash', codeHash)
    .is('revoked_at', null)
    .maybeSingle();
  if (hashErr) throw hashErr;

  if (!promo || !promo.is_active) {
    return { promo: null, policy: null, passDiscountRows: [], reason: 'invalid' };
  }

  let passDiscountRows = [];
  if (promo.discount_mode === 'per_pass') {
    passDiscountRows = await loadEventPromoPassDiscountRows(db, promo.id);
    if (!passDiscountRows.length) {
      return { promo: null, policy: null, passDiscountRows: [], reason: 'invalid' };
    }
  }

  const policy = buildEventPromoDiscountPolicy(promo, passDiscountRows);
  return { promo, policy, passDiscountRows, reason: null };
}

/**
 * @param {Array<{ passId: string, quantity: number, price: number, eventPass: object }>} validatedPasses
 * @param {{ mode: string, uniform?: object, pass_rules?: Record<string, object> }} policy
 */
export function applyEventPromoPricing(validatedPasses, policy) {
  let subtotalBefore = 0;
  for (const vp of validatedPasses) {
    subtotalBefore += parseFloat(vp.price) * (vp.quantity || 0);
  }

  if (!policy) {
    const sub = roundPresaleMoney(subtotalBefore);
    return {
      applied: false,
      discountTotal: 0,
      subtotalBefore: sub,
      subtotalAfter: sub,
      discountedUnits: 0,
      passBreakdown: [],
    };
  }

  const linesBefore = validatedPasses.map((vp) => ({
    ...vp,
    price: parseFloat(vp.price),
  }));

  applyPresaleDiscountToPasses(validatedPasses, policy);

  let subtotalAfter = 0;
  let discountedUnits = 0;
  for (let i = 0; i < validatedPasses.length; i += 1) {
    const vp = validatedPasses[i];
    const before = linesBefore[i].price;
    const after = parseFloat(vp.price);
    const qty = vp.quantity || 0;
    subtotalAfter += after * qty;
    if (after < before - 0.001) {
      discountedUnits += qty;
    }
  }

  subtotalBefore = roundPresaleMoney(subtotalBefore);
  subtotalAfter = roundPresaleMoney(subtotalAfter);
  const discountTotal = roundPresaleMoney(Math.max(0, subtotalBefore - subtotalAfter));
  const passBreakdown = buildPresalePassBreakdown(validatedPasses, policy);

  return {
    applied: discountTotal > 0 && discountedUnits > 0,
    discountTotal,
    subtotalBefore,
    subtotalAfter,
    discountedUnits,
    passBreakdown,
  };
}

/**
 * @param {Record<string, unknown>} promoRow
 * @param {Array<Record<string, unknown>>} passDiscountRows
 * @param {object} pricingResult
 * @param {number} usesClaimed
 */
export function buildEventPromoOrderSnapshot(
  promoRow,
  passDiscountRows,
  pricingResult,
  usesClaimed
) {
  const mode = promoRow.discount_mode === 'per_pass' ? 'per_pass' : 'uniform';
  const base = {
    code_id: promoRow.id,
    code: eventPromoDisplayCode(promoRow),
    badge_color: promoRow.badge_color,
    discount_mode: mode,
    original_subtotal: pricingResult.subtotalBefore,
    discounted_subtotal: pricingResult.subtotalAfter,
    discount_amount: pricingResult.discountTotal,
    uses_claimed: Math.max(0, Math.floor(Number(usesClaimed) || 0)),
    pass_breakdown: pricingResult.passBreakdown || [],
  };
  if (mode === 'per_pass') {
    return base;
  }
  return {
    ...base,
    discount_type: promoRow.discount_type,
    discount_value: Number(promoRow.discount_value),
  };
}

/** True when promo still has room for `units` discounted pass qty. */
export function promoHasCapacityForUnits(promoRow, units) {
  const need = Math.max(0, Math.floor(Number(units) || 0));
  if (!promoRow || need < 1) return false;
  return Number(promoRow.used_count) + need <= Number(promoRow.max_uses);
}
