-- Meta Conversions API: persist browser attribution at ambassador application submit for server-side Lead dedup.
ALTER TABLE public.ambassador_applications
  ADD COLUMN IF NOT EXISTS meta_attribution JSONB,
  ADD COLUMN IF NOT EXISTS meta_lead_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.ambassador_applications.meta_attribution IS 'Meta Pixel/CAPI context at application submit: eventId, fbp, fbc, eventSourceUrl, clientUserAgent, clientIp';
COMMENT ON COLUMN public.ambassador_applications.meta_lead_sent_at IS 'When Meta CAPI Lead was successfully sent (idempotency guard)';
