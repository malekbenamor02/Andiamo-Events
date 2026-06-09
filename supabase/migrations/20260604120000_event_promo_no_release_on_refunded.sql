-- REFUNDED orders keep their promo redemption (admin refund does not return the code to the pool).
-- Must match src/lib/constants/orderStatusCatalog.js.

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
      'CANCELLED_BY_AMBASSADOR'
    ]::text[]
  )
  OR COALESCE(p_payment_status, '') = ANY (
    ARRAY['FAILED', 'EXPIRED']::text[]
  );
$function$;

COMMENT ON FUNCTION public.order_promo_slot_is_released(text, text) IS
  'True when order abandoned checkout; REFUNDED still holds the promo slot.';

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
