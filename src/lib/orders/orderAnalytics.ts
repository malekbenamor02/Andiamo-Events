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

/** Paid POS / point de vente orders (same scope as Reports analytics & Excel export). */
export function isPaidPosOrder(order: {
  payment_method?: string | null;
  source?: string | null;
  status?: string | null;
}): boolean {
  if (order.status !== 'PAID' && order.status !== 'COMPLETED') return false;
  return order.payment_method === 'pos' || order.source === 'point_de_vente';
}

/**
 * True when the order is attributed to a presale code (column and/or snapshot in notes).
 * Used by Reports KPIs; matches admin order dialog heuristics.
 */
export function orderHasPresaleAttribution(order: {
  presale_code_id?: string | null;
  notes?: string | Record<string, unknown> | null;
}): boolean {
  if (order.presale_code_id) return true;
  if (order.notes == null || order.notes === '') return false;
  try {
    const notesData =
      typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
    const presale = (notesData as Record<string, unknown> | null)?.presale;
    return presale != null && typeof presale === 'object';
  } catch {
    return false;
  }
}
