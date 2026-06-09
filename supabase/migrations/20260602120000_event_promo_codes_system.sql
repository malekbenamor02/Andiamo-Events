-- Event checkout promo codes (separate from presale_codes and academy_promo_codes)

-- ---------------------------------------------------------------------------
-- event_promo_codes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  code text NOT NULL,
  discount_type text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value numeric NOT NULL CHECK (discount_value >= 0),
  applies_to_all boolean NOT NULL DEFAULT true,
  max_uses integer NOT NULL CHECK (max_uses > 0),
  used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  is_active boolean NOT NULL DEFAULT true,
  revoked_at timestamptz NULL,
  created_by uuid NULL REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_promo_used_lte_max CHECK (used_count <= max_uses)
);

CREATE INDEX IF NOT EXISTS idx_event_promo_codes_event_id ON public.event_promo_codes (event_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_promo_codes_event_code_active
  ON public.event_promo_codes (event_id, upper(trim(code)))
  WHERE revoked_at IS NULL;

COMMENT ON TABLE public.event_promo_codes IS 'Checkout promo codes per event; uppercase code stored plaintext; server-only pricing.';

-- ---------------------------------------------------------------------------
-- event_promo_code_passes (when applies_to_all = false)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_promo_code_passes (
  promo_code_id uuid NOT NULL REFERENCES public.event_promo_codes(id) ON DELETE CASCADE,
  event_pass_id uuid NOT NULL REFERENCES public.event_passes(id) ON DELETE CASCADE,
  PRIMARY KEY (promo_code_id, event_pass_id)
);

CREATE INDEX IF NOT EXISTS idx_event_promo_code_passes_pass ON public.event_promo_code_passes (event_pass_id);

-- ---------------------------------------------------------------------------
-- orders: attribution
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS event_promo_code_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_event_promo_code_id_fkey'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_event_promo_code_id_fkey
      FOREIGN KEY (event_promo_code_id) REFERENCES public.event_promo_codes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Rate limit buckets (validate endpoint)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_promo_validate_rate (
  ip_key text NOT NULL,
  window_start timestamptz NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ip_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_event_promo_validate_rate_window ON public.event_promo_validate_rate (window_start);

ALTER TABLE public.event_promo_validate_rate ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.event_promo_validate_rate IS 'Server-side promo validate attempt buckets; only service role writes.';

-- ---------------------------------------------------------------------------
-- Audit attempts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_promo_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  promo_code_id uuid NULL REFERENCES public.event_promo_codes(id) ON DELETE SET NULL,
  ip_address text NULL,
  success boolean NOT NULL DEFAULT false,
  failure_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_promo_attempts_event_created ON public.event_promo_attempts (event_id, created_at DESC);

ALTER TABLE public.event_promo_attempts ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RLS: deny anon/auth direct access
-- ---------------------------------------------------------------------------
ALTER TABLE public.event_promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_promo_code_passes ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Rate limit RPC (15-minute buckets, max 25 attempts)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.event_promo_validate_rate_try(p_ip_key text)
RETURNS TABLE(allowed boolean, attempts integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH deleted AS (
    DELETE FROM public.event_promo_validate_rate
    WHERE window_start < now() - interval '7 days'
    RETURNING 1
  ),
  bucket AS (
    SELECT to_timestamp(floor(extract(epoch from now()) / 900.0) * 900.0) AS b
  ),
  upsert AS (
    INSERT INTO public.event_promo_validate_rate (ip_key, window_start, attempt_count)
    SELECT p_ip_key, bucket.b, 1 FROM bucket
    ON CONFLICT (ip_key, window_start) DO UPDATE
    SET
      attempt_count = public.event_promo_validate_rate.attempt_count + 1,
      updated_at = now()
    RETURNING attempt_count
  )
  SELECT (upsert.attempt_count <= 25) AS allowed, upsert.attempt_count AS attempts FROM upsert;
$function$;

COMMENT ON FUNCTION public.event_promo_validate_rate_try(text) IS 'Increments validate attempts for IP in current 15-minute UTC bucket; allowed when attempts <= 25.';

-- ---------------------------------------------------------------------------
-- Atomic claim / release of promo usage
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.event_promo_claim_use(p_promo_code_id uuid)
RETURNS SETOF public.event_promo_codes
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH updated AS (
    UPDATE public.event_promo_codes c
    SET
      used_count = c.used_count + 1,
      updated_at = now()
    WHERE c.id = p_promo_code_id
      AND c.revoked_at IS NULL
      AND c.is_active = true
      AND c.used_count < c.max_uses
    RETURNING c.*
  )
  SELECT * FROM updated;
$function$;

COMMENT ON FUNCTION public.event_promo_claim_use(uuid) IS 'Atomically increments used_count when valid and not exhausted; returns 0 rows if no slot.';

CREATE OR REPLACE FUNCTION public.event_promo_release_use(p_promo_code_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  UPDATE public.event_promo_codes
  SET
    used_count = GREATEST(0, used_count - 1),
    updated_at = now()
  WHERE id = p_promo_code_id;
$function$;

COMMENT ON FUNCTION public.event_promo_release_use(uuid) IS 'Rolls back one used_count after a failed order commit or terminal failure.';

-- ---------------------------------------------------------------------------
-- Terminal failure release trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.orders_event_promo_release_on_terminal_failure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_terminal_failures text[] := ARRAY[
    'REJECTED',
    'EXPIRED',
    'FAILED',
    'REMOVED_BY_ADMIN',
    'CANCELLED',
    'CANCELLED_BY_ADMIN',
    'CANCELLED_BY_AMBASSADOR',
    'REFUNDED'
  ];
  v_completed_sale text[] := ARRAY[
    'PAID',
    'COMPLETED',
    'MANUAL_COMPLETED',
    'APPROVED'
  ];
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.event_promo_code_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status = ANY (v_terminal_failures) THEN
    RETURN NEW;
  END IF;

  IF OLD.status = ANY (v_completed_sale) THEN
    RETURN NEW;
  END IF;

  IF NEW.status = ANY (v_terminal_failures) THEN
    PERFORM public.event_promo_release_use(OLD.event_promo_code_id);
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.orders_event_promo_release_on_terminal_failure() IS
  'After orders.status update: release event promo used_count when order enters terminal failure.';

DROP TRIGGER IF EXISTS tr_orders_event_promo_release_on_terminal_failure ON public.orders;

CREATE TRIGGER tr_orders_event_promo_release_on_terminal_failure
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_event_promo_release_on_terminal_failure();

COMMENT ON TRIGGER tr_orders_event_promo_release_on_terminal_failure ON public.orders IS
  'Decrements event promo used_count when an order enters a terminal failure status.';
