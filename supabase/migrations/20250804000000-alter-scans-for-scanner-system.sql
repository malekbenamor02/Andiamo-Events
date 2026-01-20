-- Add scanner support to scans: scanner_id (who scanned, from JWT only), qr_ticket_id (secure_token flow). Extend scan_result.
-- Runs AFTER 20250802000000-create-scans-table.sql so public.scans exists.
-- Security: scanner_id is NEVER taken from request body; only from verified JWT in API.

ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS scanner_id UUID REFERENCES public.scanners(id) ON DELETE SET NULL;

ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS qr_ticket_id UUID REFERENCES public.qr_tickets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scans_scanner_id ON public.scans(scanner_id);
CREATE INDEX IF NOT EXISTS idx_scans_qr_ticket_id ON public.scans(qr_ticket_id);

-- ticket_id: keep for legacy pass_purchases; allow null when qr_ticket_id is set.
ALTER TABLE public.scans
  ALTER COLUMN ticket_id DROP NOT NULL;

-- Extend scan_result to include wrong_event
ALTER TABLE public.scans
  DROP CONSTRAINT IF EXISTS scans_scan_result_check;

ALTER TABLE public.scans
  ADD CONSTRAINT scans_scan_result_check
  CHECK (scan_result IN ('valid', 'invalid', 'already_scanned', 'expired', 'wrong_event'));

COMMENT ON COLUMN public.scans.scanner_id IS 'Set from verified JWT only, never from client. Who performed the scan.';
COMMENT ON COLUMN public.scans.qr_ticket_id IS 'Set when lookup is by secure_token via qr_tickets. Null for legacy pass_purchases flow.';
