-- Presale: multi-code access + discount attribution (additive; does not drop legacy columns/tables)

-- ---------------------------------------------------------------------------
-- events: gate + optional window + listing UX
-- ---------------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS presale_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS presale_active_from timestamptz NULL,
  ADD COLUMN IF NOT EXISTS presale_active_until timestamptz NULL,
  ADD COLUMN IF NOT EXISTS presale_hide_from_public_list boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.events.presale_enabled IS 'When true, public pass reads are restricted and checkout requires presale session + online-only rules.';
COMMENT ON COLUMN public.events.presale_hide_from_public_list IS 'When true, public events listing may hide teaser (enforced in app); passes still gated by API/RLS.';

-- ---------------------------------------------------------------------------
-- presale_codes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.presale_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  label text NULL,
  usage_mode text NOT NULL DEFAULT 'multi_use'
    CHECK (usage_mode = ANY (ARRAY['single_use'::text, 'multi_use'::text])),
  discount_type text NOT NULL
    CHECK (discount_type = ANY (ARRAY['percent'::text, 'fixed'::text])),
  discount_value numeric NOT NULL CHECK (discount_value >= 0::numeric),
  max_total_redemptions integer NULL
    CHECK (max_total_redemptions IS NULL OR max_total_redemptions > 0),
  redemption_count integer NOT NULL DEFAULT 0 CHECK (redemption_count >= 0),
  successful_order_count integer NOT NULL DEFAULT 0 CHECK (successful_order_count >= 0),
  active_from timestamptz NULL,
  active_until timestamptz NULL,
  paused_at timestamptz NULL,
  revoked_at timestamptz NULL,
  created_by uuid NULL REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_presale_codes_event_id ON public.presale_codes (event_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_presale_codes_active_event_hash
  ON public.presale_codes (event_id, code_hash)
  WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- presale_sessions (server-side; cookie holds session id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.presale_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  presale_code_id uuid NOT NULL REFERENCES public.presale_codes(id) ON DELETE CASCADE,
  csrf_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  user_id uuid NULL,
  invalidated_at timestamptz NULL,
  invalidated_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_presale_sessions_expires ON public.presale_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_presale_sessions_event ON public.presale_sessions (event_id);

-- ---------------------------------------------------------------------------
-- presale_code_attempts (append-only audit)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.presale_code_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presale_code_id uuid NULL REFERENCES public.presale_codes(id) ON DELETE SET NULL,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ip_address text NULL,
  success boolean NOT NULL DEFAULT false,
  failure_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_presale_attempts_event_created ON public.presale_code_attempts (event_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- orders: attribution
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS presale_code_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_presale_code_id_fkey'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_presale_code_id_fkey
      FOREIGN KEY (presale_code_id) REFERENCES public.presale_codes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- RLS: new tables — service role bypasses; lock down anon/auth direct access
-- ---------------------------------------------------------------------------
ALTER TABLE public.presale_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presale_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presale_code_attempts ENABLE ROW LEVEL SECURITY;

-- No policies = deny for anon/authenticated via PostgREST (backend uses service role)

-- ---------------------------------------------------------------------------
-- event_passes: restrict SELECT when event.presale_enabled (admin uses service role API)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view event passes" ON public.event_passes;
DROP POLICY IF EXISTS "Admins can manage all event passes" ON public.event_passes;

CREATE POLICY "event_passes_select_public_when_not_presale"
  ON public.event_passes
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_passes.event_id
        AND COALESCE(e.presale_enabled, false) = false
    )
  );

CREATE POLICY "event_passes_insert_anon"
  ON public.event_passes
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "event_passes_update_anon"
  ON public.event_passes
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "event_passes_delete_anon"
  ON public.event_passes
  FOR DELETE
  TO public
  USING (true);

COMMENT ON POLICY "event_passes_select_public_when_not_presale" ON public.event_passes IS
  'Hides pass rows for presale-gated events from anon Supabase client; admin loads passes via /api/admin/passes with service role.';
