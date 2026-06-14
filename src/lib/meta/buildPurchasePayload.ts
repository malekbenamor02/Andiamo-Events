import { computeOnlinePaymentFeesDisplay } from '@/lib/onlinePaymentFee';
import {
  META_TICKET_CONTENT_CATEGORY,
  type MetaAttributionContext,
  type MetaCustomerData,
  type MetaPurchasePayload,
} from './types';

export { META_TICKET_CONTENT_CATEGORY };

/**
 * @deprecated Transitional fallback only — prefer backend metaTracking.pixel.
 * Final amount paid by the customer — matches server resolvePurchaseValue semantics.
 */
export function resolveMetaPurchaseValue(input: {
  paymentMethod: 'online' | 'ambassador_cash';
  /** Ambassador cash subtotal or online subtotal before fees (fallback). */
  subtotal: number;
  /** Authoritative fee-inclusive total from created order (online). */
  orderTotalWithFees?: number | null;
  orderTotalPrice?: number | null;
}): number {
  if (input.paymentMethod === 'online') {
    const withFees = Number(input.orderTotalWithFees);
    if (Number.isFinite(withFees) && withFees > 0) return withFees;
    const totalPrice = Number(input.orderTotalPrice);
    if (Number.isFinite(totalPrice) && totalPrice > 0) return totalPrice;
    return computeOnlinePaymentFeesDisplay(input.subtotal).totalWithFees;
  }
  const cashTotal = Number(input.orderTotalPrice ?? input.subtotal);
  if (Number.isFinite(cashTotal) && cashTotal > 0) return cashTotal;
  return 0;
}

/**
 * @deprecated Transitional fallback only — prefer backend metaTracking.pixel.
 */
export function buildConfirmedPurchasePayload(input: {
  eventId: string;
  orderId: string;
  value: number;
  paymentMethod: 'online' | 'ambassador_cash';
  passes: Array<{ passId: string; quantity: number; price: number }>;
  customer: MetaCustomerData;
  attribution: MetaAttributionContext;
  contentName?: string;
}): MetaPurchasePayload {
  const numItems = input.passes.reduce((sum, p) => sum + p.quantity, 0);
  return {
    eventId: input.eventId,
    orderId: input.orderId,
    value: input.value,
    currency: 'TND',
    contentCategory: META_TICKET_CONTENT_CATEGORY,
    contentIds: input.passes.map((p) => p.passId),
    contentName: input.contentName,
    numItems,
    paymentMethod: input.paymentMethod,
    customer: input.customer,
    attribution: input.attribution,
    contents: input.passes.map((p) => ({
      id: p.passId,
      quantity: p.quantity,
      item_price: p.price,
    })),
  };
}
