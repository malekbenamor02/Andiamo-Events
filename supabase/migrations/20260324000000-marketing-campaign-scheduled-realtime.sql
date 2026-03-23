-- Email campaign lifecycle: add `scheduled` (cron-eligible). Keep `sending` for legacy.
ALTER TABLE public.marketing_campaigns
  DROP CONSTRAINT IF EXISTS marketing_campaigns_status_check;

ALTER TABLE public.marketing_campaigns
  ADD CONSTRAINT marketing_campaigns_status_check
  CHECK (status IN ('draft', 'scheduled', 'sending', 'paused', 'completed'));

CREATE INDEX IF NOT EXISTS idx_marketing_campaign_recipients_campaign_pending
  ON public.marketing_campaign_recipients (campaign_id)
  WHERE status = 'pending';

-- Realtime for admin dashboard stats (requires Replication enabled on project)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_campaign_recipients;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_campaigns;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

COMMENT ON COLUMN public.marketing_campaigns.status IS 'draft=template only; scheduled=cron sends; sending=legacy/immediate; paused; completed';
