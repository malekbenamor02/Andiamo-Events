/**
 * Canonical order + payment status strings (API, admin, DB).
 * Sources: api/orders-create.js, server.cjs (COD + online), api/misc.js (ClicToPay, auto-expire),
 * supabase/migrations/20260318000001-allow-expired-online-orders.sql (orders_status_check).
 */

export const OrderStatusCatalog = Object.freeze({
  PENDING_ONLINE: 'PENDING_ONLINE',
  REDIRECTED: 'REDIRECTED',
  PENDING_CASH: 'PENDING_CASH',
  PENDING_ADMIN_APPROVAL: 'PENDING_ADMIN_APPROVAL',
  PAID: 'PAID',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  CANCELLED_BY_ADMIN: 'CANCELLED_BY_ADMIN',
  REMOVED_BY_ADMIN: 'REMOVED_BY_ADMIN',
  CANCELLED_BY_AMBASSADOR: 'CANCELLED_BY_AMBASSADOR',
  REFUNDED: 'REFUNDED',
  COMPLETED: 'COMPLETED',
  MANUAL_COMPLETED: 'MANUAL_COMPLETED',
});

export const PaymentStatusCatalog = Object.freeze({
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  EXPIRED: 'EXPIRED',
});

/** Set at order create — promo is claimed while checkout is in progress. */
export const ORDER_STATUS_PROMO_CLAIMED = Object.freeze([
  OrderStatusCatalog.PENDING_ONLINE,
  OrderStatusCatalog.REDIRECTED,
  OrderStatusCatalog.PENDING_CASH,
  OrderStatusCatalog.PENDING_ADMIN_APPROVAL,
]);

/**
 * Order reached a successful sale (or was refunded after payment) — keeps the promo redemption.
 * REFUNDED is intentional: admin refund does not return the code to the pool.
 */
export const ORDER_STATUS_PROMO_SLOT_HELD = Object.freeze([
  OrderStatusCatalog.PAID,
  OrderStatusCatalog.COMPLETED,
  OrderStatusCatalog.MANUAL_COMPLETED,
  OrderStatusCatalog.REFUNDED,
]);

/**
 * Promo redemption is returned — must match transitions in:
 * - server.cjs: reject-order → REJECTED; cancel pending → CANCELLED_BY_AMBASSADOR; remove → REMOVED_BY_ADMIN
 * - api/misc.js: payment fail → FAILED; auto-expire → EXPIRED
 */
export const ORDER_STATUS_PROMO_SLOT_RELEASED = Object.freeze([
  OrderStatusCatalog.REJECTED,
  OrderStatusCatalog.FAILED,
  OrderStatusCatalog.EXPIRED,
  OrderStatusCatalog.REMOVED_BY_ADMIN,
  OrderStatusCatalog.CANCELLED,
  OrderStatusCatalog.CANCELLED_BY_ADMIN,
  OrderStatusCatalog.CANCELLED_BY_AMBASSADOR,
]);

/** Online payment_status values that release a promo slot (failed / expired checkout only). */
export const PAYMENT_STATUS_PROMO_SLOT_RELEASED = Object.freeze([
  PaymentStatusCatalog.FAILED,
  PaymentStatusCatalog.EXPIRED,
]);

const RELEASED_ORDER = new Set(ORDER_STATUS_PROMO_SLOT_RELEASED);
const RELEASED_PAYMENT = new Set(PAYMENT_STATUS_PROMO_SLOT_RELEASED);

/** True when the order no longer consumes a promo max-use slot. */
export function orderPromoSlotIsReleased(order) {
  if (!order) return true;
  const status = order.status != null ? String(order.status) : '';
  const paymentStatus =
    order.payment_status != null ? String(order.payment_status) : '';
  if (RELEASED_ORDER.has(status)) return true;
  if (paymentStatus && RELEASED_PAYMENT.has(paymentStatus)) return true;
  return false;
}

/** True when this order counts against event_promo_codes.used_count. */
export function orderOccupiesPromoSlot(order) {
  if (!order?.event_promo_code_id) return false;
  return !orderPromoSlotIsReleased(order);
}
