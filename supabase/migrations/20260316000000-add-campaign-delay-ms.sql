-- Optional delay between each send (used for test campaigns)
ALTER TABLE public.marketing_campaigns
ADD COLUMN IF NOT EXISTS delay_ms INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.marketing_campaigns.delay_ms IS 'Optional delay in ms between each recipient in a batch (e.g. for test campaigns)';
