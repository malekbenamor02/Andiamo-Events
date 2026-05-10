-- Rollback: private VIP presale (credentials, attempts, event flags)
-- Safe if objects/columns were never created (IF EXISTS).

DROP TABLE IF EXISTS public.private_event_access_attempts;
DROP TABLE IF EXISTS public.private_event_access_credentials;

DROP FUNCTION IF EXISTS public.update_private_event_access_credentials_updated_at() CASCADE;

ALTER TABLE public.events
  DROP COLUMN IF EXISTS is_private_presale,
  DROP COLUMN IF EXISTS private_access_mode,
  DROP COLUMN IF EXISTS allow_public_conversion;
