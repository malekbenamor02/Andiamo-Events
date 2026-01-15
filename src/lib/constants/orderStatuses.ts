/**
 * Order Status Constants and Utilities
 * Unified order status system for all payment methods
 */

export enum OrderStatus {
  PENDING_ONLINE = 'PENDING_ONLINE',     // Online payment pending
  REDIRECTED = 'REDIRECTED',              // External app payment - user redirected
  PENDING_CASH = 'PENDING_CASH',          // Ambassador cash payment pending
  PAID = 'PAID',                          // Payment confirmed
  CANCELLED = 'CANCELLED',                // Cancelled (with reason)
  REMOVED_BY_ADMIN = 'REMOVED_BY_ADMIN'   // Removed by admin (soft delete)
}

export enum PaymentMethod {
  ONLINE = 'online',
  EXTERNAL_APP = 'external_app',
  AMBASSADOR_CASH = 'ambassador_cash'
}

export enum PaymentOptionType {
  ONLINE = 'online',
  EXTERNAL_APP = 'external_app',
  AMBASSADOR_CASH = 'ambassador_cash'
}

export enum AmbassadorStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  DISABLED = 'DISABLED',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED'
}

export type CancelledBy = 'admin' | 'ambassador' | 'system';

/**
 * Get status display name
 */
export function getOrderStatusLabel(status: OrderStatus, language: 'en' | 'fr' = 'en'): string {
  const labels: Record<OrderStatus, { en: string; fr: string }> = {
    [OrderStatus.PENDING_ONLINE]: { en: 'Pending Online Payment', fr: 'Paiement en ligne en attente' },
    [OrderStatus.REDIRECTED]: { en: 'Redirected to Payment App', fr: 'Redirigé vers l\'application de paiement' },
    [OrderStatus.PENDING_CASH]: { en: 'Pending Cash Payment', fr: 'Paiement en espèces en attente' },
    [OrderStatus.PAID]: { en: 'Paid', fr: 'Payé' },
    [OrderStatus.CANCELLED]: { en: 'Cancelled', fr: 'Annulé' },
    [OrderStatus.REMOVED_BY_ADMIN]: { en: 'Removed by Admin', fr: 'Retiré par l\'administrateur' }
  };
  return labels[status]?.[language] || status;
}

/**
 * Get payment method display name
 */
export function getPaymentMethodLabel(method: PaymentMethod, language: 'en' | 'fr' = 'en'): string {
  const labels: Record<PaymentMethod, { en: string; fr: string }> = {
    [PaymentMethod.ONLINE]: { en: 'Online Payment', fr: 'Paiement en ligne' },
    [PaymentMethod.EXTERNAL_APP]: { en: 'External App', fr: 'Application externe' },
    [PaymentMethod.AMBASSADOR_CASH]: { en: 'Cash on Delivery', fr: 'Paiement à la livraison' }
  };
  return labels[method]?.[language] || method;
}

/**
 * Check if status allows cancellation
 */
export function canCancelOrder(status: OrderStatus): boolean {
  return status === OrderStatus.PENDING_ONLINE || 
         status === OrderStatus.REDIRECTED || 
         status === OrderStatus.PENDING_CASH;
}

/**
 * Check if status allows status update
 */
export function canUpdateStatus(status: OrderStatus): boolean {
  return status === OrderStatus.PENDING_ONLINE || 
         status === OrderStatus.REDIRECTED || 
         status === OrderStatus.PENDING_CASH;
}

/**
 * Get valid next statuses for a given status
 */
export function getValidNextStatuses(currentStatus: OrderStatus): OrderStatus[] {
  switch (currentStatus) {
    case OrderStatus.PENDING_ONLINE:
    case OrderStatus.REDIRECTED:
    case OrderStatus.PENDING_CASH:
      return [OrderStatus.PAID, OrderStatus.CANCELLED, OrderStatus.REMOVED_BY_ADMIN];
    case OrderStatus.PAID:
      return [OrderStatus.CANCELLED]; // Can cancel even if paid (refund scenario), but cannot remove
    case OrderStatus.CANCELLED:
      return []; // Final state
    case OrderStatus.REMOVED_BY_ADMIN:
      return []; // Final state
    default:
      return [];
  }
}

