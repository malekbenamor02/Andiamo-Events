/**
 * Order Status Constants and Utilities
 * Unified order status system for checkout UI; full platform catalog in orderStatusCatalog.js
 */
import {
  OrderStatusCatalog,
  PaymentStatusCatalog,
} from './orderStatusCatalog.js';

export { OrderStatusCatalog, PaymentStatusCatalog };
export {
  ORDER_STATUS_PROMO_SLOT_RELEASED,
  PAYMENT_STATUS_PROMO_SLOT_RELEASED,
  orderPromoSlotIsReleased,
  orderOccupiesPromoSlot,
} from './orderStatusCatalog.js';

export enum OrderStatus {
  PENDING_ONLINE = OrderStatusCatalog.PENDING_ONLINE,
  REDIRECTED = OrderStatusCatalog.REDIRECTED,
  PENDING_CASH = OrderStatusCatalog.PENDING_CASH,
  PAID = OrderStatusCatalog.PAID,
  CANCELLED = OrderStatusCatalog.CANCELLED,
  REMOVED_BY_ADMIN = OrderStatusCatalog.REMOVED_BY_ADMIN,
}

/** Online orders only — see PaymentStatusCatalog */
export enum PaymentStatus {
  PENDING_PAYMENT = PaymentStatusCatalog.PENDING_PAYMENT,
  PAID = PaymentStatusCatalog.PAID,
  FAILED = PaymentStatusCatalog.FAILED,
  REFUNDED = PaymentStatusCatalog.REFUNDED,
  EXPIRED = PaymentStatusCatalog.EXPIRED,
}

export enum PaymentMethod {
  ONLINE = 'online',
  EXTERNAL_APP = 'external_app',
  AMBASSADOR_CASH = 'ambassador_cash',
}

export enum PaymentOptionType {
  ONLINE = 'online',
  EXTERNAL_APP = 'external_app',
  AMBASSADOR_CASH = 'ambassador_cash',
}

export enum AmbassadorStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  DISABLED = 'DISABLED',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
}

export type CancelledBy = 'admin' | 'ambassador' | 'system';

export function getOrderStatusLabel(status: OrderStatus, language: 'en' | 'fr' = 'en'): string {
  const labels: Record<OrderStatus, { en: string; fr: string }> = {
    [OrderStatus.PENDING_ONLINE]: { en: 'Pending Online Payment', fr: 'Paiement en ligne en attente' },
    [OrderStatus.REDIRECTED]: { en: 'Redirected to Payment App', fr: 'Redirigé vers l\'application de paiement' },
    [OrderStatus.PENDING_CASH]: { en: 'Pending Cash Payment', fr: 'Paiement en espèces en attente' },
    [OrderStatus.PAID]: { en: 'Paid', fr: 'Payé' },
    [OrderStatus.CANCELLED]: { en: 'Cancelled', fr: 'Annulé' },
    [OrderStatus.REMOVED_BY_ADMIN]: { en: 'Removed by Admin', fr: 'Retiré par l\'administrateur' },
  };
  return labels[status]?.[language] || status;
}

export function getPaymentMethodLabel(method: PaymentMethod, language: 'en' | 'fr' = 'en'): string {
  const labels: Record<PaymentMethod, { en: string; fr: string }> = {
    [PaymentMethod.ONLINE]: { en: 'Online Payment', fr: 'Paiement en ligne' },
    [PaymentMethod.EXTERNAL_APP]: { en: 'External App', fr: 'Application externe' },
    [PaymentMethod.AMBASSADOR_CASH]: { en: 'Cash on Delivery', fr: 'Paiement à la livraison' },
  };
  return labels[method]?.[language] || method;
}

export function canCancelOrder(status: OrderStatus): boolean {
  return (
    status === OrderStatus.PENDING_ONLINE ||
    status === OrderStatus.REDIRECTED ||
    status === OrderStatus.PENDING_CASH
  );
}

export function canUpdateStatus(status: OrderStatus): boolean {
  return (
    status === OrderStatus.PENDING_ONLINE ||
    status === OrderStatus.REDIRECTED ||
    status === OrderStatus.PENDING_CASH
  );
}

export function getValidNextStatuses(currentStatus: OrderStatus): OrderStatus[] {
  switch (currentStatus) {
    case OrderStatus.PENDING_ONLINE:
    case OrderStatus.REDIRECTED:
    case OrderStatus.PENDING_CASH:
      return [OrderStatus.PAID, OrderStatus.CANCELLED, OrderStatus.REMOVED_BY_ADMIN];
    case OrderStatus.PAID:
      return [OrderStatus.CANCELLED];
    case OrderStatus.CANCELLED:
    case OrderStatus.REMOVED_BY_ADMIN:
      return [];
    default:
      return [];
  }
}
