export interface MetaAttributionContext {
  fbp?: string;
  fbc?: string;
  eventSourceUrl?: string;
}

export interface MetaCustomerData {
  email: string;
  phone: string;
  fullName: string;
  city: string;
  ville?: string;
}

export interface MetaPurchaseLineItem {
  id: string;
  quantity: number;
  item_price: number;
}

export interface MetaPurchasePayload {
  eventId: string;
  orderId: string;
  value: number;
  currency: string;
  contentIds: string[];
  contentName?: string;
  numItems: number;
  paymentMethod: 'online' | 'ambassador_cash' | string;
  customer: MetaCustomerData;
  attribution?: MetaAttributionContext;
  contents?: MetaPurchaseLineItem[];
}

export interface MetaPurchaseSnapshot extends MetaPurchasePayload {}
