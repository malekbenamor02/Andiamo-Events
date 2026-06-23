-- Academy influencer hardening: frozen sales attribution + temporary password expiry

ALTER TABLE public.academy_registrations
  ADD COLUMN IF NOT EXISTS influencer_id_at_registration uuid NULL
  REFERENCES public.academy_influencers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_academy_registrations_influencer_at_reg_created
  ON public.academy_registrations (influencer_id_at_registration, created_at DESC)
  WHERE influencer_id_at_registration IS NOT NULL;

COMMENT ON COLUMN public.academy_registrations.influencer_id_at_registration IS
  'Influencer attributed at registration time; frozen and not affected by later promo reassignment.';

-- Best-effort backfill from current promo ownership (historical accuracy not guaranteed for old rows).
UPDATE public.academy_registrations ar
SET influencer_id_at_registration = apc.influencer_id
FROM public.academy_promo_codes apc
WHERE ar.promo_code_id = apc.id
  AND ar.influencer_id_at_registration IS NULL
  AND apc.influencer_id IS NOT NULL;

ALTER TABLE public.academy_influencers
  ADD COLUMN IF NOT EXISTS temp_password_expires_at timestamptz NULL;

COMMENT ON COLUMN public.academy_influencers.temp_password_expires_at IS
  'When set with must_change_password, temporary invite password expires at this time (7 days from invite/reset).';
