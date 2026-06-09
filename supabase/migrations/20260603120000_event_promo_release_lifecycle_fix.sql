-- Promo redemption release: return used_count when orders fail, expire, or cancel (not REFUNDED; see 20260604120000).
-- Status lists must match src/lib/constants/orderStatusCatalog.js (ORDER_STATUS_PROMO_SLOT_RELEASED, PAYMENT_STATUS_PROMO_SLOT_RELEASED).
-- Fixes prior logic that skipped release when the order had already reached PAID/COMPLETED.

CREATE OR REPLACE FUNCTION public.order_promo_slot_is_released(p_status text, p_payment_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT COALESCE(p_status, '') = ANY (
    ARRAY[
      'REJECTED',
      'EXPIRED',
      'FAILED',
      'REMOVED_BY_ADMIN',
      'CANCELLED',
      'CANCELLED_BY_ADMIN',
      'CANCELLED_BY_AMBASSADOR'
    ]::text[]
  )
  OR COALESCE(p_payment_status, '') = ANY (
    ARRAY['FAILED', 'EXPIRED']::text[]
  );
$function$;

COMMENT ON FUNCTION public.order_promo_slot_is_released(text, text) IS
  'True when an order no longer holds an event promo redemption slot.';

CREATE OR REPLACE FUNCTION public.orders_event_promo_release_on_failure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_old_released boolean;
  v_new_released boolean;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF OLD.event_promo_code_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_old_released := public.order_promo_slot_is_released(OLD.status, OLD.payment_status);
  v_new_released := public.order_promo_slot_is_released(NEW.status, NEW.payment_status);

  -- Already released: do not decrement again
  IF v_old_released THEN
    RETURN NEW;
  END IF;

  -- Entering a terminal / abandoned state: return one redemption to the pool
  IF v_new_released THEN
    PERFORM public.event_promo_release_use(OLD.event_promo_code_id);
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.orders_event_promo_release_on_failure() IS
  'After orders.status or payment_status update: release promo used_count when the order abandons its slot.';

DROP TRIGGER IF EXISTS tr_orders_event_promo_release_on_terminal_failure ON public.orders;
DROP TRIGGER IF EXISTS tr_orders_event_promo_release_on_failure ON public.orders;

CREATE TRIGGER tr_orders_event_promo_release_on_failure
  AFTER UPDATE OF status, payment_status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_event_promo_release_on_failure();

COMMENT ON TRIGGER tr_orders_event_promo_release_on_failure ON public.orders IS
  'Decrements event_promo used_count when an order enters cancel/reject/expire/refund (status or payment_status).';

-- Align counters with orders that still hold a slot (repair drift from older trigger logic)
UPDATE public.event_promo_codes pc
SET
  used_count = COALESCE(
    (
      SELECT COUNT(*)::integer
      FROM public.orders o
      WHERE o.event_promo_code_id = pc.id
        AND NOT public.order_promo_slot_is_released(o.status, o.payment_status)
    ),
    0
  ),
  updated_at = now();
