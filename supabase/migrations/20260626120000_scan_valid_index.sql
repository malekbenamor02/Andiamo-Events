-- Speed duplicate valid-scan lookup on validate-ticket path
CREATE INDEX IF NOT EXISTS idx_scans_qr_ticket_valid
  ON public.scans (qr_ticket_id, scan_result)
  WHERE scan_result = 'valid';
