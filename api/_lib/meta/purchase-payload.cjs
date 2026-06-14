'use strict';

const { computeOnlinePaymentFees } = require('../online-payment-fee.cjs');

const META_TICKET_CONTENT_CATEGORY = 'Event Ticket';

/**
 * Resolve purchase value in TND for Meta (fee-inclusive for online when applicable).
 * @param {Record<string, unknown>} order
 * @param {Array<Record<string, unknown>>|null|undefined} orderPasses
 */
function resolvePurchaseValue(order, orderPasses) {
  const isOnline =
    order.payment_method === 'online' || order.source === 'platform_online';
  if (isOnline) {
    const withFees = Number(order.total_with_fees);
    if (Number.isFinite(withFees) && withFees > 0) return withFees;
    const totalPrice = Number(order.total_price);
    if (Number.isFinite(totalPrice) && totalPrice > 0) return totalPrice;
    if (Array.isArray(orderPasses) && orderPasses.length) {
      const sub = orderPasses.reduce(
        (s, p) => s + (Number(p.price) || 0) * (Number(p.quantity) || 1),
        0
      );
      if (sub > 0) return computeOnlinePaymentFees(sub).totalWithFees;
    }
  }
  const subtotal = Number(order.total_price);
  if (Number.isFinite(subtotal) && subtotal > 0) return subtotal;
  if (Array.isArray(orderPasses) && orderPasses.length) {
    return orderPasses.reduce(
      (s, p) => s + (Number(p.price) || 0) * (Number(p.quantity) || 1),
      0
    );
  }
  return 0;
}

/**
 * @param {Array<Record<string, unknown>>|null|undefined} orderPasses
 */
function buildContentsFromOrderPasses(orderPasses) {
  const passes = Array.isArray(orderPasses) ? orderPasses : [];
  return passes.map((p) => ({
    id: p.pass_id != null ? String(p.pass_id) : String(p.passId || ''),
    quantity: Number(p.quantity) || 1,
    item_price: Number(p.price) || 0,
  }));
}

/**
 * @param {Array<Record<string, unknown>>|null|undefined} orderPasses
 */
function buildContentIdsFromOrderPasses(orderPasses) {
  const passes = Array.isArray(orderPasses) ? orderPasses : [];
  return passes
    .map((p) =>
      p.pass_id != null ? String(p.pass_id) : p.passId != null ? String(p.passId) : null
    )
    .filter(Boolean);
}

/**
 * @param {{
 *   order: Record<string, unknown>;
 *   orderPasses?: Array<Record<string, unknown>>|null;
 *   event?: Record<string, unknown>|null;
 *   promoCode?: string|null;
 * }} input
 */
function buildPurchaseCustomData({ order, orderPasses, event, promoCode }) {
  const passes = Array.isArray(orderPasses) ? orderPasses : [];
  const contentIds = buildContentIdsFromOrderPasses(passes);
  const numItems = passes.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
  const value = resolvePurchaseValue(order, passes);
  const contents = buildContentsFromOrderPasses(passes);

  const promo =
    promoCode != null
      ? String(promoCode).trim()
      : '';

  /** @type {Record<string, unknown>} */
  const out = {
    value,
    currency: 'TND',
    content_category: META_TICKET_CONTENT_CATEGORY,
    content_ids: contentIds,
    content_type: 'product',
    content_name: event?.name != null ? String(event.name) : undefined,
    num_items: numItems > 0 ? numItems : undefined,
    order_id: order.id != null ? String(order.id) : undefined,
    contents: contents.length ? contents : undefined,
    payment_method:
      order.payment_method != null ? String(order.payment_method) : undefined,
  };
  if (promo) out.promo_code = promo;
  return out;
}

/**
 * @param {{
 *   order: Record<string, unknown>;
 *   orderPasses?: Array<Record<string, unknown>>|null;
 *   event?: Record<string, unknown>|null;
 * }} input
 */
function buildCustomerFromOrder(order) {
  return {
    email: order.user_email != null ? String(order.user_email) : null,
    phone: order.user_phone != null ? String(order.user_phone) : null,
    fullName: order.user_name != null ? String(order.user_name) : null,
    city: order.city != null ? String(order.city) : null,
  };
}

/**
 * Resolve promo code from order join or notes snapshot.
 * @param {Record<string, unknown>} order
 */
function resolvePromoCodeFromOrder(order) {
  const joined = order.event_promo_codes;
  if (joined && typeof joined === 'object' && joined.code != null) {
    return String(joined.code).trim();
  }
  if (Array.isArray(joined) && joined[0]?.code != null) {
    return String(joined[0].code).trim();
  }
  try {
    const notes =
      typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
    if (notes?.promo?.code != null) {
      return String(notes.promo.code).trim();
    }
  } catch {
    // ignore
  }
  return null;
}

module.exports = {
  META_TICKET_CONTENT_CATEGORY,
  resolvePurchaseValue,
  buildPurchaseCustomData,
  buildCustomerFromOrder,
  buildContentsFromOrderPasses,
  buildContentIdsFromOrderPasses,
  resolvePromoCodeFromOrder,
};
