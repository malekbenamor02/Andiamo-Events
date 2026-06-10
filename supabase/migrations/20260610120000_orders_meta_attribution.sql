-- Meta Conversions API: persist browser attribution at order create for server-side Purchase dedup.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS meta_attribution JSONB,
  ADD COLUMN IF NOT EXISTS meta_purchase_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.orders.meta_attribution IS 'Meta Pixel/CAPI context captured at checkout: eventId, fbp, fbc, eventSourceUrl, clientUserAgent, clientIp';
COMMENT ON COLUMN public.orders.meta_purchase_sent_at IS 'When Meta CAPI Purchase was successfully sent (idempotency guard)';
