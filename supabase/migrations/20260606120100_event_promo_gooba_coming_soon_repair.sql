-- One-time repair: Coming Soon event, GOOBA promo only (do not touch other events/codes).

DO $repair$
DECLARE
  v_event_id uuid := 'f831c0f8-d0b3-4000-8c98-cb0a38aace8e';
  v_promo_id uuid := '5eb72c88-7ef7-43ec-95ad-4ddcf591159f';
BEGIN
  UPDATE public.orders o
  SET event_promo_uses_claimed = GREATEST(
    COALESCE(o.quantity, 0),
    COALESCE(
      (
        SELECT SUM(op.quantity)::integer
        FROM public.order_passes op
        WHERE op.order_id = o.id
      ),
      0
    )
  )
  WHERE o.event_id = v_event_id
    AND o.event_promo_code_id = v_promo_id
    AND NOT public.order_promo_slot_is_released(o.status, o.payment_status);

  UPDATE public.orders o
  SET notes = jsonb_set(
    CASE
      WHEN o.notes IS NULL OR btrim(o.notes::text) = '' THEN '{}'::jsonb
      WHEN o.notes::text ~ '^\s*\{' THEN o.notes::jsonb
      ELSE jsonb_build_object('legacy_notes', o.notes::text)
    END,
    '{promo,uses_claimed}',
    to_jsonb(o.event_promo_uses_claimed),
    true
  )
  WHERE o.event_id = v_event_id
    AND o.event_promo_code_id = v_promo_id
    AND NOT public.order_promo_slot_is_released(o.status, o.payment_status);

  PERFORM public.event_promo_recalc_used_count(v_promo_id);
END;
$repair$;
