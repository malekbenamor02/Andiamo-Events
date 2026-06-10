export type {
  MetaAttributionContext,
  MetaCustomerData,
  MetaPurchaseLineItem,
  MetaPurchasePayload,
  MetaPurchaseSnapshot,
} from './types';

export { getMetaAttributionContext, createMetaEventId } from './attribution';
export { buildPixelAdvancedMatching } from './userData';
export { buildConfirmedPurchasePayload } from './buildPurchasePayload';
export { savePurchaseSnapshot, consumePurchaseSnapshot } from './snapshot';
export {
  initMeta,
  trackMetaPageView,
  trackMetaEvent,
  trackMetaLead,
  trackConfirmedPurchase,
} from './pixel';
