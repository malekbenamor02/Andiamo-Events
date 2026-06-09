-- Promo codes: label (display) + code_hash (lookup) only; drop legacy plaintext `code` column.

UPDATE public.event_promo_codes
SET label = upper(trim(code))
WHERE label IS NULL OR btrim(label) = '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.event_promo_codes
    WHERE code_hash IS NULL
       OR label IS NULL
       OR btrim(label) = ''
  ) THEN
    RAISE EXCEPTION
      'event_promo_codes: every row needs label and code_hash before dropping code (set pepper and backfill first)';
  END IF;
END $$;

DROP INDEX IF EXISTS public.idx_event_promo_codes_event_code_active;

ALTER TABLE public.event_promo_codes
  ALTER COLUMN label SET NOT NULL,
  ALTER COLUMN code_hash SET NOT NULL;

ALTER TABLE public.event_promo_codes
  DROP COLUMN IF EXISTS code;

COMMENT ON TABLE public.event_promo_codes IS
  'Checkout promo per event; lookup by code_hash only; label for admin display.';
COMMENT ON COLUMN public.event_promo_codes.label IS
  'Uppercase promo string for admin UI (A-Z0-9); not used for checkout lookup.';
COMMENT ON COLUMN public.event_promo_codes.code_hash IS
  'HMAC-SHA256(event_id:label) with server pepper; sole public lookup key.';
