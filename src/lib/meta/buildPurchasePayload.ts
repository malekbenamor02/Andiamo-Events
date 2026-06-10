import type {
  MetaAttributionContext,
  MetaCustomerData,
  MetaPurchasePayload,
} from './types';

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
