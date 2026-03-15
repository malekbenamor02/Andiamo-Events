-- Store campaign delays in minutes instead of milliseconds

-- Add new columns (fractional minutes, e.g. 0.5 = 30 seconds)
ALTER TABLE public.marketing_campaigns
ADD COLUMN IF NOT EXISTS delay_minutes REAL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS batch_delay_minutes REAL DEFAULT NULL;

-- Migrate existing values: ms -> minutes (ms / 60000)
UPDATE public.marketing_campaigns
SET
  delay_minutes = CASE WHEN delay_ms IS NOT NULL THEN delay_ms / 60000.0 ELSE NULL END,
  batch_delay_minutes = CASE WHEN batch_delay_ms IS NOT NULL THEN batch_delay_ms / 60000.0 ELSE NULL END
WHERE delay_ms IS NOT NULL OR batch_delay_ms IS NOT NULL;

-- Drop old columns
ALTER TABLE public.marketing_campaigns
DROP COLUMN IF EXISTS delay_ms,
DROP COLUMN IF EXISTS batch_delay_ms;

COMMENT ON COLUMN public.marketing_campaigns.delay_minutes IS 'Delay in minutes between each recipient in a batch (e.g. 0.5 = 30 seconds)';
COMMENT ON COLUMN public.marketing_campaigns.batch_delay_minutes IS 'Delay in minutes between send-batch calls when auto-sending (e.g. 2 = 2 minutes)';
