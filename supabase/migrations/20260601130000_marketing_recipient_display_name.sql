-- Personal name for standard transactional campaign emails (orders, ambassadors, etc.)
ALTER TABLE public.marketing_campaign_recipients
  ADD COLUMN IF NOT EXISTS recipient_display_name text;

COMMENT ON COLUMN public.marketing_campaign_recipients.recipient_display_name IS
  'Optional display name for greeting; populated from source tables when launching campaigns';
