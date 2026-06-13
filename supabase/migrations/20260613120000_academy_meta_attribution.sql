-- Meta Pixel/CAPI attribution for Academy registrations (Purchase dedup + idempotency).
ALTER TABLE public.academy_registrations
  ADD COLUMN IF NOT EXISTS meta_attribution JSONB,
  ADD COLUMN IF NOT EXISTS meta_purchase_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.academy_registrations.meta_attribution IS 'Meta Pixel/CAPI context at registration: eventId, fbp, fbc, eventSourceUrl, clientUserAgent, clientIp';
COMMENT ON COLUMN public.academy_registrations.meta_purchase_sent_at IS 'When Meta CAPI Purchase was successfully sent for this registration (idempotency guard)';
