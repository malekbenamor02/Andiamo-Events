-- Delay between batches (client uses for pacing; stored for reference)
ALTER TABLE public.marketing_campaigns
ADD COLUMN IF NOT EXISTS batch_delay_ms INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.marketing_campaigns.batch_delay_ms IS 'Ms to wait between send-batch calls when auto-sending';
