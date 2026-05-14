-- Speeds admin presale list: count successful unlocks per code for an event.
CREATE INDEX IF NOT EXISTS idx_presale_attempts_event_success_code
  ON public.presale_code_attempts (event_id, presale_code_id)
  WHERE success = true AND presale_code_id IS NOT NULL;
