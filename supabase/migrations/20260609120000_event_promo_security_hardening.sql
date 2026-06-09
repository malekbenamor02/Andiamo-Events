-- Event promo security: HMAC lookup columns, RPC lockdown, claim event guard, lifecycle, order-create rate limit.

-- ---------------------------------------------------------------------------
-- code_hash + label (plaintext code moves to label; lookup by hash)
-- ---------------------------------------------------------------------------
ALTER TABLE public.event_promo_codes
  ADD COLUMN IF NOT EXISTS code_hash text NULL,
  ADD COLUMN IF NOT EXISTS label text NULL;

COMMENT ON COLUMN public.event_promo_codes.label IS
  'Plaintext promo string for admin display only; not used for public lookup.';
COMMENT ON COLUMN public.event_promo_codes.code_hash IS
  'HMAC-SHA256(event_id:uppercase_code) with server pepper; used for lookup.';
COMMENT ON COLUMN public.event_promo_codes.code IS
  'Legacy plaintext column; deprecated — use label + code_hash. Backfilled to label on deploy.';

UPDATE public.event_promo_codes
SET label = code
WHERE label IS NULL
  AND code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_promo_codes_active_event_hash
  ON public.event_promo_codes (event_id, code_hash)
  WHERE revoked_at IS NULL
    AND code_hash IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Order-create promo attempt rate limit (heavier than validate-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_promo_order_create_rate (
  ip_key text NOT NULL,
  window_start timestamptz NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ip_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_event_promo_order_create_rate_window
  ON public.event_promo_order_create_rate (window_start);

ALTER TABLE public.event_promo_order_create_rate ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.event_promo_order_create_rate IS
  'Server-side rate buckets for order create with promoCode; service role only.';

CREATE OR REPLACE FUNCTION public.event_promo_order_create_rate_try(p_ip_key text)
RETURNS TABLE(allowed boolean, attempts integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH deleted AS (
    DELETE FROM public.event_promo_order_create_rate
    WHERE window_start < now() - interval '7 days'
    RETURNING 1
  ),
  bucket AS (
    SELECT to_timestamp(floor(extract(epoch from now()) / 900.0) * 900.0) AS b
  ),
  upsert AS (
    INSERT INTO public.event_promo_order_create_rate (ip_key, window_start, attempt_count)
    SELECT p_ip_key, bucket.b, 1 FROM bucket
    ON CONFLICT (ip_key, window_start) DO UPDATE
    SET
      attempt_count = public.event_promo_order_create_rate.attempt_count + 1,
      updated_at = now()
    RETURNING attempt_count
  )
  SELECT (upsert.attempt_count <= 12) AS allowed, upsert.attempt_count AS attempts FROM upsert;
$function$;

COMMENT ON FUNCTION public.event_promo_order_create_rate_try(text) IS
  'Increments order-create promo attempts per IP per 15-minute bucket; allowed when attempts <= 12.';

-- ---------------------------------------------------------------------------
-- Claim must match event_id (defense in depth)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.event_promo_claim_uses(uuid, integer);

CREATE OR REPLACE FUNCTION public.event_promo_claim_uses(
  p_event_id uuid,
  p_promo_code_id uuid,
  p_count integer
)
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
      AND c.event_id = p_event_id
      AND c.revoked_at IS NULL
      AND c.is_active = true
      AND p_count > 0
      AND c.used_count + p_count <= c.max_uses
    RETURNING c.*
  )
  SELECT * FROM updated;
$function$;

COMMENT ON FUNCTION public.event_promo_claim_uses(uuid, uuid, integer) IS
  'Atomically increments used_count when promo belongs to event and slots remain.';

CREATE OR REPLACE FUNCTION public.event_promo_claim_use(p_promo_code_id uuid)
RETURNS SETOF public.event_promo_codes
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT * FROM public.event_promo_claim_uses(
    (SELECT c.event_id FROM public.event_promo_codes c WHERE c.id = p_promo_code_id),
    p_promo_code_id,
    1
  );
$function$;

-- ---------------------------------------------------------------------------
-- Lifecycle: release promo slot on CANCELLED_BY_ADMIN
-- ---------------------------------------------------------------------------
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
  'True when order abandoned checkout; REFUNDED still holds the promo slot.';

-- ---------------------------------------------------------------------------
-- Lock promo RPCs to service_role only (no anon/authenticated PostgREST abuse)
-- ---------------------------------------------------------------------------
DO $promo_rpc_lockdown$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'event_promo_validate_rate_try',
        'event_promo_order_create_rate_try',
        'event_promo_claim_uses',
        'event_promo_release_uses',
        'event_promo_claim_use',
        'event_promo_release_use',
        'event_promo_recalc_used_count'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END
$promo_rpc_lockdown$;
