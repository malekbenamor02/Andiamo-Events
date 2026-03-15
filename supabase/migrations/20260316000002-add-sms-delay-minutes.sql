-- SMS campaigns: delay between each recipient in minutes (email keeps delay_ms)
ALTER TABLE public.marketing_campaigns
ADD COLUMN IF NOT EXISTS delay_minutes NUMERIC(10,2) DEFAULT NULL;

COMMENT ON COLUMN public.marketing_campaigns.delay_minutes IS 'For SMS: delay between each recipient in minutes. For email use delay_ms.';
