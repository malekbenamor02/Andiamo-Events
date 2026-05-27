/**
 * Hardening for POST /api/orders/create: reject presale/discount injection at the JSON body level
 * and build pass line items without spreading arbitrary client fields.
 */

/** Top-level keys clients must not send (pricing / presale is server-derived). */
const FORBIDDEN_ORDER_CREATE_BODY_KEYS = new Set([
  'presale_code_id',
  'presaleCodeId',
  'discount_type',
  'discount_value',
  'discountType',
  'discountValue',
  'presale',
  'presaleSnapshot',
  'applied_discount',
  'appliedDiscount',
  'coupon',
  'coupon_code',
  'couponCode',
  'promo',
  'promo_code',
  'promoCode',
  'subtotal_override',
  'total_override',
  'price_override',
]);

/**
 * @param {unknown} body
 * @returns {{ ok: true } | { ok: false, keys: string[] }}
 */
export function rejectForbiddenOrderCreateKeys(body) {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: true };
  }
  /** @type {string[]} */
  const found = [];
  for (const key of Object.keys(body)) {
    if (FORBIDDEN_ORDER_CREATE_BODY_KEYS.has(key)) {
      found.push(key);
    }
  }
  if (found.length) {
    return { ok: false, keys: found };
  }
  return { ok: true };
}

/**
 * Server-owned line item for presale + stock logic (no `...pass` spread).
 * @param {{ passId?: unknown; quantity?: unknown }} pass
 * @param {{ id: string; name: string; price: unknown }} eventPass
 */
export function buildValidatedPassLineItem(pass, eventPass) {
  const passId = pass?.passId != null ? String(pass.passId) : '';
  const qty = Number(pass?.quantity);
  const quantity = Number.isFinite(qty) && qty >= 1 ? Math.floor(qty) : 0;
  const price = Math.round(Number.parseFloat(String(eventPass.price ?? 0)) * 100) / 100;
  return {
    passId,
    quantity,
    price,
    passName: String(eventPass.name ?? ''),
    eventPass,
  };
}
