-- Investor / institutional email template options + investor contact list for marketing launches

ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS email_template text NOT NULL DEFAULT 'standard'
    CHECK (email_template IN ('standard', 'investor_vanguard')),
  ADD COLUMN IF NOT EXISTS attach_poster boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS poster_attachment_url text,
  ADD COLUMN IF NOT EXISTS sender_profile text NOT NULL DEFAULT 'default'
    CHECK (sender_profile IN ('default', 'investor'));

COMMENT ON COLUMN public.marketing_campaigns.email_template IS 'standard = existing Andiamo promo layout; investor_vanguard = institutional HTML template';
COMMENT ON COLUMN public.marketing_campaigns.attach_poster IS 'When true, poster_attachment_url is fetched and attached to each marketing email (Brevo)';
COMMENT ON COLUMN public.marketing_campaigns.poster_attachment_url IS 'Public https URL of PDF or image to attach when attach_poster is true';
COMMENT ON COLUMN public.marketing_campaigns.sender_profile IS 'default = contact@ flow; investor = MARKETING_INVESTOR_FROM + optional BREVO_API_KEY_INVESTORS';

CREATE TABLE IF NOT EXISTS public.investor_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS investor_contacts_email_lower_idx ON public.investor_contacts (lower(trim(email)));

ALTER TABLE public.investor_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage investor_contacts"
  ON public.investor_contacts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.id::text = current_setting('request.jwt.claims', true)::json->>'sub'
      AND admins.is_active = true
    )
  );

CREATE POLICY "Service role can manage investor_contacts"
  ON public.investor_contacts FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  );

COMMENT ON TABLE public.investor_contacts IS 'Curated investor emails for marketing launch source "investors"';
