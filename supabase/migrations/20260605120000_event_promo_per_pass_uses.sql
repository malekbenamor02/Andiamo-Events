-- Promo max_uses counts discounted pass units (qty), not one per order.
-- orders.event_promo_uses_claimed stores how many units this order consumed.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS event_promo_uses_claimed integer NOT NULL DEFAULT 0;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_event_promo_uses_claimed_nonneg;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_event_promo_uses_claimed_nonneg
  CHECK (event_promo_uses_claimed >= 0);

COMMENT ON COLUMN public.orders.event_promo_uses_claimed IS
  'Pass units that consumed event promo max_uses for this order (0 when no promo).';

-- Backfill existing promo orders (legacy: 1 use per order)
UPDATE public.orders
SET event_promo_uses_claimed = 1
WHERE event_promo_code_id IS NOT NULL
  AND event_promo_uses_claimed = 0;

CREATE OR REPLACE FUNCTION public.event_promo_claim_uses(p_promo_code_id uuid, p_count integer)
RETURNS SETOF public.event_promo_codes
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH updated AS (
    UPDATE public.event_promo_codes c
    SET
      used_count = c.used_count + p_count,
      updated_at = now()
    WHERE c.id = p_promo_code_id
      AND c.revoked_at IS NULL
      AND c.is_active = true
      AND p_count > 0
      AND c.used_count + p_count <= c.max_uses
    RETURNING c.*
  )
  SELECT * FROM updated;
$function$;

COMMENT ON FUNCTION public.event_promo_claim_uses(uuid, integer) IS
  'Atomically increments used_count by p_count when enough slots remain.';

CREATE OR REPLACE FUNCTION public.event_promo_release_uses(p_promo_code_id uuid, p_count integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  UPDATE public.event_promo_codes
  SET
    used_count = GREATEST(0, used_count - GREATEST(0, p_count)),
    updated_at = now()
  WHERE id = p_promo_code_id;
$function$;

COMMENT ON FUNCTION public.event_promo_release_uses(uuid, integer) IS
  'Rolls back p_count promo units after failed checkout or order release.';

-- Keep single-unit RPCs as thin wrappers
CREATE OR REPLACE FUNCTION public.event_promo_claim_use(p_promo_code_id uuid)
RETURNS SETOF public.event_promo_codes
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT * FROM public.event_promo_claim_uses(p_promo_code_id, 1);
$function$;

CREATE OR REPLACE FUNCTION public.event_promo_release_use(p_promo_code_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT public.event_promo_release_uses(p_promo_code_id, 1);
$function$;

CREATE OR REPLACE FUNCTION public.orders_event_promo_release_on_failure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_old_released boolean;
  v_new_released boolean;
  v_uses integer;
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
    v_uses := GREATEST(1, COALESCE(OLD.event_promo_uses_claimed, 1));
    PERFORM public.event_promo_release_uses(OLD.event_promo_code_id, v_uses);
  END IF;

  RETURN NEW;
END;
$function$;

-- Recalculate used_count from pass units held by active orders
UPDATE public.event_promo_codes pc
SET
  used_count = COALESCE(
    (
      SELECT COALESCE(SUM(o.event_promo_uses_claimed), 0)::integer
      FROM public.orders o
      WHERE o.event_promo_code_id = pc.id
        AND NOT public.order_promo_slot_is_released(o.status, o.payment_status)
    ),
    0
  ),
  updated_at = now();
