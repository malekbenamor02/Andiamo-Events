-- Per-campaign daily email cap (UTC calendar day) and optional CTA button
ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS daily_email_cap INTEGER,
  ADD COLUMN IF NOT EXISTS cta_url TEXT,
  ADD COLUMN IF NOT EXISTS cta_label TEXT;

COMMENT ON COLUMN public.marketing_campaigns.daily_email_cap IS 'Max successful sends for this campaign per UTC day; NULL treated as 150 in application';
COMMENT ON COLUMN public.marketing_campaigns.cta_url IS 'Optional Book now / action button URL (https) in campaign emails';
COMMENT ON COLUMN public.marketing_campaigns.cta_label IS 'Button label; defaults to Book now if URL set and label empty';
