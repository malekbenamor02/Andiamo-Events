export interface MetaAttributionContext {
  fbp?: string;
  fbc?: string;
  eventSourceUrl?: string;
}

export interface MetaCustomerData {
  email: string;
  phone: string;
  fullName: string;
  city?: string;
  ville?: string;
}

export interface MetaPurchaseLineItem {
  id: string;
  quantity: number;
  item_price: number;
}

/** Standard Meta content_category for confirmed ticket/pass sales. */
export const META_TICKET_CONTENT_CATEGORY = 'Event Ticket';

/** Standard Meta content_category for Academy training registrations. */
export const META_ACADEMY_CONTENT_CATEGORY = 'Academy Training';

export type MetaContentCategory =
  | typeof META_TICKET_CONTENT_CATEGORY
  | typeof META_ACADEMY_CONTENT_CATEGORY;

export interface MetaPurchasePayload {
  eventId: string;
  orderId: string;
  value: number;
  currency: string;
  contentCategory: MetaContentCategory;
  contentIds: string[];
  contentName?: string;
  numItems: number;
  paymentMethod: 'online' | 'ambassador_cash' | 'rib' | 'd17' | string;
  customer: MetaCustomerData;
  attribution?: MetaAttributionContext;
  contents?: MetaPurchaseLineItem[];
  promoCode?: string;
}

export interface MetaPurchaseSnapshot extends MetaPurchasePayload {}

export interface AcademyMetaPixelPayload {
  eventId: string;
  orderId: string;
  value: number;
  currency: string;
  contentCategory: MetaContentCategory;
  contentIds: string[];
  contentName: string;
  numItems: number;
  paymentMethod: string;
  contents: MetaPurchaseLineItem[];
  promoCode?: string;
  advancedMatching: Record<string, string>;
}

export interface AcademyMetaTrackingResponse {
  trackable: boolean;
  pixel: AcademyMetaPixelPayload | null;
  capi?: {
    attempted: boolean;
    ok: boolean;
    skipped: boolean;
    error?: string;
  };
}
