/**
 * Event promo slot lifecycle — re-exports from the shared order status catalog.
 * DB trigger tr_orders_event_promo_release_on_failure must stay aligned with
 * ORDER_STATUS_PROMO_SLOT_RELEASED / PAYMENT_STATUS_PROMO_SLOT_RELEASED.
 */
export {
  ORDER_STATUS_PROMO_SLOT_RELEASED,
  PAYMENT_STATUS_PROMO_SLOT_RELEASED,
  ORDER_STATUS_PROMO_CLAIMED,
  ORDER_STATUS_PROMO_SLOT_HELD,
  orderPromoSlotIsReleased,
  orderOccupiesPromoSlot,
} from '../../src/lib/constants/orderStatusCatalog.js';
