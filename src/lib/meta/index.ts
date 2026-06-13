export type {
  MetaAttributionContext,
  MetaCustomerData,
  MetaPurchaseLineItem,
  MetaPurchasePayload,
  MetaPurchaseSnapshot,
} from './types';
export {
  META_TICKET_CONTENT_CATEGORY,
  META_ACADEMY_CONTENT_CATEGORY,
} from './types';
export { getAcademyFormulaMeta, mapAcademyPaymentMethodForMeta } from './academyCatalog';

export { getMetaAttributionContext, createMetaEventId } from './attribution';
export { buildPixelAdvancedMatching } from './userData';
export {
  buildConfirmedPurchasePayload,
  resolveMetaPurchaseValue,
} from './buildPurchasePayload';
export {
  savePurchaseSnapshot,
  consumePurchaseSnapshot,
  saveAcademyPurchaseSnapshot,
  consumeAcademyPurchaseSnapshot,
} from './snapshot';
export {
  buildAcademyPurchasePayload,
  isValidAcademyPurchasePayload,
} from './buildAcademyPurchasePayload';
export {
  initMeta,
  trackMetaPageView,
  trackMetaEvent,
  trackMetaLead,
  trackConfirmedPurchase,
} from './pixel';
