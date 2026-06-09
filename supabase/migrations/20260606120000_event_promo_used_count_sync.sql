-- Keep event_promo_codes.used_count aligned with pass units on active orders (not 1 per order).

CREATE OR REPLACE FUNCTION public.order_event_promo_effective_uses(
  p_uses_claimed integer,
  p_quantity integer,
  p_notes jsonb
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT GREATEST(
    0,
    COALESCE(NULLIF(p_uses_claimed, 0), 0),
    COALESCE((p_notes -> 'promo' ->> 'uses_claimed')::integer, 0),
    COALESCE(NULLIF(p_quantity, 0), 0)
  );
$function$;

COMMENT ON FUNCTION public.order_event_promo_effective_uses(integer, integer, jsonb) IS
  'Pass units that consume promo max_uses for one order (column, notes, or order qty).';

CREATE OR REPLACE FUNCTION public.event_promo_recalc_used_count(p_promo_code_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  UPDATE public.event_promo_codes pc
  SET
    used_count = COALESCE(
      (
        SELECT COALESCE(
          SUM(
            public.order_event_promo_effective_uses(
              o.event_promo_uses_claimed,
              o.quantity,
              CASE
                WHEN o.notes IS NULL OR btrim(o.notes::text) = '' THEN NULL::jsonb
                WHEN o.notes::text ~ '^\s*\{' THEN o.notes::jsonb
                ELSE NULL::jsonb
              END
            )
          ),
          0
        )::integer
        FROM public.orders o
        WHERE o.event_promo_code_id = p_promo_code_id
          AND NOT public.order_promo_slot_is_released(o.status, o.payment_status)
      ),
      0
    ),
    updated_at = now()
  WHERE pc.id = p_promo_code_id;
$function$;

COMMENT ON FUNCTION public.event_promo_recalc_used_count(uuid) IS
  'Recompute used_count from active orders holding this promo (per pass unit).';

CREATE OR REPLACE FUNCTION public.orders_event_promo_recalc_used_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_promo_id uuid;
BEGIN
  v_promo_id := COALESCE(NEW.event_promo_code_id, OLD.event_promo_code_id);
  IF v_promo_id IS NOT NULL THEN
    PERFORM public.event_promo_recalc_used_count(v_promo_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS tr_orders_event_promo_recalc_used_count ON public.orders;

CREATE TRIGGER tr_orders_event_promo_recalc_used_count
  AFTER INSERT OR UPDATE OF event_promo_code_id, event_promo_uses_claimed, status, payment_status, quantity, notes
  ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_event_promo_recalc_used_count();

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

  IF v_old_released THEN
    RETURN NEW;
  END IF;

  IF v_new_released THEN
    PERFORM public.event_promo_recalc_used_count(OLD.event_promo_code_id);
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.orders_event_promo_release_on_failure() IS
  'When order abandons promo slot, recalc promo used_count from remaining active orders.';
