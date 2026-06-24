-- Admin-only extra neighborhood coverage for ambassadors at COD checkout.
-- Primary ville (from application) is unchanged; extra_villes adds optional coverage.

ALTER TABLE public.ambassadors
  ADD COLUMN IF NOT EXISTS extra_villes TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_ambassadors_extra_villes
  ON public.ambassadors USING GIN (extra_villes);

COMMENT ON COLUMN public.ambassadors.extra_villes IS
  'Additional neighborhoods where this ambassador appears at checkout (admin-managed; primary ville is ambassadors.ville).';
