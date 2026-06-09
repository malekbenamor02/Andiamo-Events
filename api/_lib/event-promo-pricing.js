/**
 * Event promo pricing entrypoints (checkout + validate).
 * Discount policy math lives in event-promo-discount.js (shared with presale).
 */
import { createRequire } from 'module';
import { normalizeEventPromoCode } from './event-promo-code.js';

const requireCjs = createRequire(import.meta.url);
const { computeOnlinePaymentFees } = requireCjs('./online-payment-fee.cjs');
import { roundPresaleMoney } from './presale-discount.js';

export {
  applyEventPromoPricing,
  buildEventPromoOrderSnapshot,
  loadEventPromoWithPolicy,
  promoHasCapacityForUnits,
} from './event-promo-discount.js';

export const PROMO_ALLOWED_PAYMENT_METHODS = new Set(['online', 'ambassador_cash']);

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} eventId
 */
export async function isEventPromoCheckoutAvailable(db, eventId) {
  const { data: ev, error: evErr } = await db
    .from('events')
    .select('id, presale_enabled')
    .eq('id', eventId)
    .maybeSingle();
  if (evErr || !ev?.id || ev.presale_enabled) return false;

  const { data: rows, error: listErr } = await db
    .from('event_promo_codes')
    .select('id, max_uses, used_count')
    .eq('event_id', eventId)
    .eq('is_active', true)
    .is('revoked_at', null)
    .limit(20);

  if (listErr) return false;
  return (rows || []).some((r) => Number(r.used_count) < Number(r.max_uses));
}

export function formatPromoDiscountLabel(promoRow, language = 'en') {
  const isEn = language !== 'fr';
  if (promoRow.discount_mode === 'per_pass') {
    return isEn ? 'Per pass' : 'Par pass';
  }
  if (promoRow.discount_type === 'percent') {
    return isEn ? `${Number(promoRow.discount_value)}% off` : `-${Number(promoRow.discount_value)}%`;
  }
  return isEn
    ? `${Number(promoRow.discount_value)} TND off per pass`
    : `-${Number(promoRow.discount_value)} TND / pass`;
}

/**
 * @param {number} subtotalAfterPromo
 * @param {string | null | undefined} paymentMethod
 */
export function previewCheckoutTotals(subtotalAfterPromo, paymentMethod) {
  const sub = Math.max(0, Number(subtotalAfterPromo) || 0);
  if (paymentMethod === 'online' && sub > 0) {
    const fees = computeOnlinePaymentFees(sub);
    return {
      subtotal: sub,
      feeAmount: fees.feeAmount,
      totalWithFees: fees.totalWithFees,
      feeRate: fees.feeRate,
    };
  }
  return {
    subtotal: sub,
    feeAmount: 0,
    totalWithFees: sub,
    feeRate: 0,
  };
}

/**
 * Build validated pass lines from DB event_passes for validate endpoint.
 */
export function buildValidatePassLines(eventPasses, clientPasses) {
  const byId = Object.create(null);
  for (const ep of eventPasses) byId[String(ep.id)] = ep;

  const lines = [];
  for (const p of clientPasses || []) {
    const passId = p?.passId != null ? String(p.passId) : '';
    const ep = byId[passId];
    if (!ep) continue;
    const qty = Number(p.quantity);
    const quantity = Number.isFinite(qty) && qty >= 1 ? Math.floor(qty) : 0;
    if (quantity < 1) continue;
    const price = roundPresaleMoney(parseFloat(String(ep.price ?? 0)));
    lines.push({
      passId,
      quantity,
      price,
      passName: String(ep.name ?? ''),
      eventPass: ep,
    });
  }
  return lines;
}

export { normalizeEventPromoCode };
