import { PaymentMethod } from '@/lib/constants/orderStatuses';

/**
 * Paid online orders for Overview, Reports, and Excel (same rules as Dashboard online KPIs).
 */
export function isPaidOnlineOrder(order: {
  payment_method?: string | null;
  payment_status?: string | null;
  status?: string | null;
}): boolean {
  if (order.payment_method !== PaymentMethod.ONLINE) return false;
  return (
    order.payment_status === 'PAID' ||
    order.status === 'PAID' ||
    order.status === 'COMPLETED'
  );
}

/**
 * Paid ambassador cash orders for Overview, Reports, and Excel.
 */
export function isPaidAmbassadorCashOrder(order: {
  payment_method?: string | null;
  status?: string | null;
}): boolean {
  if (order.payment_method !== PaymentMethod.AMBASSADOR_CASH) return false;
  return order.status === 'PAID' || order.status === 'COMPLETED';
}

/** Online + ambassador cash only (excludes POS, external_app, etc.). */
export function isPaidOnlineOrAmbassadorOrder(order: {
  payment_method?: string | null;
  payment_status?: string | null;
  status?: string | null;
}): boolean {
  return isPaidOnlineOrder(order) || isPaidAmbassadorCashOrder(order);
}
