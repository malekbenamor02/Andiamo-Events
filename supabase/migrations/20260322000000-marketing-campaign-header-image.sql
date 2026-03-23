-- Optional hero/header image URL for marketing email campaigns (public HTTPS URL after upload)
ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS header_image_url TEXT;

COMMENT ON COLUMN public.marketing_campaigns.header_image_url IS 'Public URL of image shown above the message body in campaign emails; null for text-only';
