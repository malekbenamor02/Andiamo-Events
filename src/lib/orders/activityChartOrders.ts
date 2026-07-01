/**
 * Activity chart order classification (mirrors api/_lib/admin-dashboard-activity.cjs).
 * Server API is the source of truth; these helpers are for tests/documentation parity.
 */

const COD_PAID_STATUSES = ['PAID', 'COMPLETED', 'MANUAL_COMPLETED'] as const;
const COD_PENDING_STATUSES = [
  'PENDING_CASH',
  'PENDING_ADMIN_APPROVAL',
  'PENDING_AMBASSADOR_CONFIRMATION',
  'APPROVED',
] as const;
const COD_SOURCES = new Set(['platform_cod', 'ambassador_manual']);
const EXCLUDED_SOURCES = new Set(['official_invitation', 'Invitation']);
const ONLINE_TERMINAL_STATUSES = new Set([
  'CANCELLED',
  'CANCELLED_BY_ADMIN',
  'CANCELLED_BY_AMBASSADOR',
  'REJECTED',
  'FAILED',
  'REFUNDED',
  'EXPIRED',
  'REMOVED_BY_ADMIN',
]);

export function isExcludedActivitySource(order: { source?: string }): boolean {
  return !!order.source && EXCLUDED_SOURCES.has(order.source);
}

export function isPaidOnlineActivityOrder(order: {
  source?: string;
  payment_method?: string;
  status?: string;
  payment_status?: string;
}): boolean {
  if (order.source !== 'platform_online') return false;
  if (order.payment_method !== 'online') return false;
  if (order.status === 'REMOVED_BY_ADMIN') return false;
  if (order.payment_status === 'REFUNDED' || order.status === 'REFUNDED') return false;
  return (
    order.payment_status === 'PAID' ||
    order.status === 'PAID' ||
    order.status === 'COMPLETED'
  );
}

export function isPaidCodActivityOrder(order: {
  payment_method?: string;
  source?: string;
  status?: string;
}): boolean {
  if (order.payment_method !== 'ambassador_cash') return false;
  if (!order.source || !COD_SOURCES.has(order.source)) return false;
  if (order.status === 'REMOVED_BY_ADMIN') return false;
  return COD_PAID_STATUSES.includes(order.status as (typeof COD_PAID_STATUSES)[number]);
}

export function isPaidPosActivityOrder(order: { source?: string; status?: string }): boolean {
  if (order.source !== 'point_de_vente') return false;
  if (order.status === 'REMOVED_BY_ADMIN') return false;
  return order.status === 'PAID' || order.status === 'COMPLETED';
}

export function isPendingOnlineActivityOrder(order: {
  source?: string;
  payment_method?: string;
  status?: string;
  payment_status?: string;
}): boolean {
  if (order.source !== 'platform_online') return false;
  if (order.payment_method !== 'online') return false;
  if (isPaidOnlineActivityOrder(order)) return false;
  if (order.status && ONLINE_TERMINAL_STATUSES.has(order.status)) return false;
  if (
    order.payment_status === 'FAILED' ||
    order.payment_status === 'REFUNDED' ||
    order.payment_status === 'EXPIRED'
  ) {
    return false;
  }
  return (
    order.status === 'PENDING_ONLINE' ||
    order.status === 'REDIRECTED' ||
    order.payment_status === 'PENDING_PAYMENT' ||
    order.payment_status == null
  );
}

export function isPendingCodActivityOrder(order: {
  payment_method?: string;
  source?: string;
  status?: string;
}): boolean {
  if (order.payment_method !== 'ambassador_cash') return false;
  if (!order.source || !COD_SOURCES.has(order.source)) return false;
  if (order.status === 'REMOVED_BY_ADMIN') return false;
  if (isPaidCodActivityOrder(order)) return false;
  return COD_PENDING_STATUSES.includes(order.status as (typeof COD_PENDING_STATUSES)[number]);
}

export function isPendingPosActivityOrder(order: { source?: string; status?: string }): boolean {
  if (order.source !== 'point_de_vente') return false;
  if (order.status === 'REMOVED_BY_ADMIN') return false;
  if (isPaidPosActivityOrder(order)) return false;
  return order.status === 'PENDING_ADMIN_APPROVAL';
}

/** Paid/collected order — main chart orders line. */
export function isPaidActivityChartOrder(order: {
  source?: string;
  status?: string;
  payment_status?: string;
  payment_method?: string;
}): boolean {
  return (
    isPaidOnlineActivityOrder(order) ||
    isPaidCodActivityOrder(order) ||
    isPaidPosActivityOrder(order)
  );
}

/** Active pipeline order — tooltip pending metrics only. */
export function isPendingActivityChartOrder(order: {
  source?: string;
  status?: string;
  payment_status?: string;
  payment_method?: string;
}): boolean {
  return (
    isPendingOnlineActivityOrder(order) ||
    isPendingCodActivityOrder(order) ||
    isPendingPosActivityOrder(order)
  );
}
