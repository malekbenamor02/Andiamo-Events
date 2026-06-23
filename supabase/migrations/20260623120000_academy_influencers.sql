-- Academy influencer accounts (admin-created; promo attribution via academy_promo_codes.influencer_id)

CREATE TABLE IF NOT EXISTS public.academy_influencers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  instagram_handle text NULL,
  password_hash text NOT NULL,
  must_change_password boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NULL REFERENCES public.admins(id) ON DELETE SET NULL,
  invited_at timestamptz NULL,
  last_invite_sent_at timestamptz NULL,
  password_changed_at timestamptz NULL,
  last_login timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academy_influencers_email ON public.academy_influencers (lower(email));
CREATE INDEX IF NOT EXISTS idx_academy_influencers_is_active ON public.academy_influencers (is_active);

ALTER TABLE public.academy_promo_codes
  ADD COLUMN IF NOT EXISTS influencer_id uuid NULL REFERENCES public.academy_influencers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_academy_promo_codes_influencer_id
  ON public.academy_promo_codes (influencer_id)
  WHERE influencer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_academy_registrations_promo_created
  ON public.academy_registrations (promo_code_id, created_at DESC)
  WHERE promo_code_id IS NOT NULL;

ALTER TABLE public.academy_influencers ENABLE ROW LEVEL SECURITY;
-- No policies: API-only access via service role (same pattern as academy_registrations).

COMMENT ON TABLE public.academy_influencers IS 'Academy promo influencers; accounts created by super admins only; API access via service role.';
COMMENT ON COLUMN public.academy_promo_codes.influencer_id IS 'Optional owner for influencer dashboard sales attribution.';
