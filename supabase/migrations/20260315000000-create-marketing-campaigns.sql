-- Marketing campaigns: bulk email and SMS sent in batches over time
-- Supports same source/filter model as BulkSmsSelector; no duplicate sends per campaign per recipient

CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('email', 'sms')),
  name TEXT,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'paused', 'completed')),
  batch_size INTEGER NOT NULL DEFAULT 300,
  period TEXT NOT NULL DEFAULT 'day',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID
);

CREATE TABLE IF NOT EXISTS public.marketing_campaign_recipients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('email', 'phone')),
  recipient_value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (campaign_id, recipient_value)
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_type ON public.marketing_campaigns(type);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON public.marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_created_at ON public.marketing_campaigns(created_at);

CREATE INDEX IF NOT EXISTS idx_marketing_campaign_recipients_campaign_id ON public.marketing_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_recipients_campaign_status ON public.marketing_campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaign_recipients_sent_at ON public.marketing_campaign_recipients(sent_at) WHERE sent_at IS NOT NULL;

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaign_recipients ENABLE ROW LEVEL SECURITY;

-- Admins can do everything on campaigns and recipients
CREATE POLICY "Admins can manage marketing_campaigns"
  ON public.marketing_campaigns FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.id::text = current_setting('request.jwt.claims', true)::json->>'sub'
      AND admins.is_active = true
    )
  );

CREATE POLICY "Admins can manage marketing_campaign_recipients"
  ON public.marketing_campaign_recipients FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.id::text = current_setting('request.jwt.claims', true)::json->>'sub'
      AND admins.is_active = true
    )
  );

-- Allow service role / anon for server-side API (campaign create, send-batch)
CREATE POLICY "Service role can manage marketing_campaigns"
  ON public.marketing_campaigns FOR ALL
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL);

CREATE POLICY "Service role can manage marketing_campaign_recipients"
  ON public.marketing_campaign_recipients FOR ALL
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL);

CREATE TRIGGER update_marketing_campaigns_updated_at
  BEFORE UPDATE ON public.marketing_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.marketing_campaigns IS 'Bulk email/SMS campaigns: one message sent in batches over time to filtered, deduplicated recipients';
COMMENT ON TABLE public.marketing_campaign_recipients IS 'Per-recipient state for a campaign; unique (campaign_id, recipient_value) prevents duplicate sends';
