-- Atomic presale redemption slot + DB-backed redeem rate limiting

-- ---------------------------------------------------------------------------
-- Rate limit buckets (IP key + 15-minute UTC bucket; incremented atomically)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.presale_redeem_rate (
  ip_key text NOT NULL,
  window_start timestamptz NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ip_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_presale_redeem_rate_window ON public.presale_redeem_rate (window_start);

ALTER TABLE public.presale_redeem_rate ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.presale_redeem_rate IS 'Server-side presale redeem attempt buckets; only service role writes.';

CREATE OR REPLACE FUNCTION public.presale_redeem_rate_try(p_ip_key text)
RETURNS TABLE(allowed boolean, attempts integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH deleted AS (
    DELETE FROM public.presale_redeem_rate
    WHERE window_start < now() - interval '7 days'
    RETURNING 1
  ),
  bucket AS (
    SELECT to_timestamp(floor(extract(epoch from now()) / 900.0) * 900.0) AS b
  ),
  upsert AS (
    INSERT INTO public.presale_redeem_rate (ip_key, window_start, attempt_count)
    SELECT p_ip_key, bucket.b, 1 FROM bucket
    ON CONFLICT (ip_key, window_start) DO UPDATE
    SET
      attempt_count = public.presale_redeem_rate.attempt_count + 1,
      updated_at = now()
    RETURNING attempt_count
  )
  SELECT (upsert.attempt_count <= 12) AS allowed, upsert.attempt_count AS attempts FROM upsert;
$function$;

COMMENT ON FUNCTION public.presale_redeem_rate_try(text) IS 'Increments redeem attempts for IP key in current 15-minute UTC bucket; allowed when attempts <= 12.';

-- ---------------------------------------------------------------------------
-- Atomic claim / release of presale code redemption (concurrency-safe)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.presale_claim_slot(p_event_id uuid, p_presale_code_id uuid)
RETURNS SETOF public.presale_codes
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH updated AS (
    UPDATE public.presale_codes c
    SET
      successful_order_count = c.successful_order_count + 1,
      updated_at = now()
    WHERE c.id = p_presale_code_id
      AND c.event_id = p_event_id
      AND c.revoked_at IS NULL
      AND c.paused_at IS NULL
      AND (c.active_from IS NULL OR c.active_from <= now())
      AND (c.active_until IS NULL OR c.active_until >= now())
      AND (
        (c.usage_mode = 'multi_use'::text
          AND (c.max_total_redemptions IS NULL OR c.successful_order_count < c.max_total_redemptions))
        OR (c.usage_mode = 'single_use'::text AND c.successful_order_count = 0)
      )
    RETURNING c.*
  )
  SELECT * FROM updated;
$function$;

COMMENT ON FUNCTION public.presale_claim_slot(uuid, uuid) IS 'Atomically increments successful_order_count when valid and not exhausted; returns 0 rows if no slot.';

CREATE OR REPLACE FUNCTION public.presale_release_slot(p_presale_code_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  UPDATE public.presale_codes
  SET
    successful_order_count = GREATEST(0, successful_order_count - 1),
    updated_at = now()
  WHERE id = p_presale_code_id;
$function$;

COMMENT ON FUNCTION public.presale_release_slot(uuid) IS 'Rolls back one successful_order_count after a failed order commit.';
