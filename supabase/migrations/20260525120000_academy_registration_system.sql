-- Academy registration system (separate from ticket orders)

-- ---------------------------------------------------------------------------
-- academy_settings (singleton)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.academy_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  max_approved_total integer NOT NULL DEFAULT 36 CHECK (max_approved_total >= 0),
  page_enabled boolean NOT NULL DEFAULT true,
  disabled_message_en text NULL,
  disabled_message_fr text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.admins(id) ON DELETE SET NULL
);

INSERT INTO public.academy_settings (max_approved_total, page_enabled)
SELECT 36, true
WHERE NOT EXISTS (SELECT 1 FROM public.academy_settings LIMIT 1);

-- ---------------------------------------------------------------------------
-- academy_promo_codes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.academy_promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  discount_type text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value numeric NOT NULL CHECK (discount_value >= 0),
  max_uses integer NOT NULL CHECK (max_uses > 0),
  used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  active boolean NOT NULL DEFAULT true,
  revoked_at timestamptz NULL,
  created_by uuid NULL REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academy_promo_used_lte_max CHECK (used_count <= max_uses)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_academy_promo_codes_code_active
  ON public.academy_promo_codes (upper(trim(code)))
  WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- academy_registrations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.academy_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number text NOT NULL UNIQUE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  formule text NOT NULL CHECK (formule IN ('essentielle', 'pro', 'premium')),
  payment_method text NOT NULL CHECK (payment_method IN ('card', 'rib', 'd17')),
  promo_code_id uuid NULL REFERENCES public.academy_promo_codes(id) ON DELETE SET NULL,
  base_amount_dt numeric NOT NULL CHECK (base_amount_dt >= 0),
  discount_amount_dt numeric NOT NULL DEFAULT 0 CHECK (discount_amount_dt >= 0),
  fee_amount_dt numeric NOT NULL DEFAULT 0 CHECK (fee_amount_dt >= 0),
  total_amount_dt numeric NOT NULL CHECK (total_amount_dt >= 0),
  payment_proof_path text NULL,
  status text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN (
      'pending_payment',
      'proof_received',
      'pending_online',
      'paid_online',
      'approved',
      'rejected',
      'failed',
      'cancelled'
    )),
  payment_gateway_reference text NULL,
  payment_confirm_response jsonb NULL,
  reviewed_by uuid NULL REFERENCES public.admins(id) ON DELETE SET NULL,
  reviewed_at timestamptz NULL,
  rejection_reason text NULL,
  email_sent_at timestamptz NULL,
  last_email_type text NULL,
  ip_address text NULL,
  user_agent text NULL,
  client_elapsed_ms integer NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academy_registrations_status ON public.academy_registrations (status);
CREATE INDEX IF NOT EXISTS idx_academy_registrations_email ON public.academy_registrations (lower(email));
CREATE INDEX IF NOT EXISTS idx_academy_registrations_created ON public.academy_registrations (created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_academy_registrations_active_email_formule
  ON public.academy_registrations (lower(email), formule)
  WHERE status NOT IN ('failed', 'cancelled', 'rejected');

-- ---------------------------------------------------------------------------
-- academy_registration_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.academy_registration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.academy_registrations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  old_status text NULL,
  new_status text NULL,
  admin_id uuid NULL REFERENCES public.admins(id) ON DELETE SET NULL,
  ip_address text NULL,
  notes text NULL,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academy_registration_logs_reg
  ON public.academy_registration_logs (registration_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- registration number sequence
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.academy_registration_number_seq START 1;

-- ---------------------------------------------------------------------------
-- Storage bucket (private proofs)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('academy-payment-proofs', 'academy-payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- No public policies: API uses service role only

-- ---------------------------------------------------------------------------
-- RLS: deny direct client access
-- ---------------------------------------------------------------------------
ALTER TABLE public.academy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_registration_logs ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated — service role bypasses RLS

COMMENT ON TABLE public.academy_registrations IS 'Andiamo Academy training registrations; API-only access via service role.';
