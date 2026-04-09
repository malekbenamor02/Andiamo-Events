-- Destructive cleanup requested by product owner.
-- Applies staged removal of legacy/unused schema objects.

BEGIN;

-- 1) ambassador_applications
ALTER TABLE IF EXISTS public.ambassador_applications
  DROP COLUMN IF EXISTS date_of_birth;

-- 2,3,6,7) Drop legacy/empty tables
DROP TABLE IF EXISTS public.ambassador_events;
DROP TABLE IF EXISTS public.ambassador_performance;
DROP TABLE IF EXISTS public.clients;
DROP TABLE IF EXISTS public.event_sponsors;

-- 4,5) ambassadors
ALTER TABLE IF EXISTS public.ambassadors
  DROP COLUMN IF EXISTS commission_rate,
  DROP COLUMN IF EXISTS reset_token_expiry,
  DROP COLUMN IF EXISTS reset_token;

-- 8) events
ALTER TABLE IF EXISTS public.events
  DROP COLUMN IF EXISTS ticket_link,
  DROP COLUMN IF EXISTS whatsapp_link,
  DROP COLUMN IF EXISTS featured,
  DROP COLUMN IF EXISTS capacity,
  DROP COLUMN IF EXISTS age_restriction,
  DROP COLUMN IF EXISTS dress_code,
  DROP COLUMN IF EXISTS special_notes,
  DROP COLUMN IF EXISTS organizer_contact,
  DROP COLUMN IF EXISTS event_category,
  DROP COLUMN IF EXISTS pass_types,
  DROP COLUMN IF EXISTS instagram_link;

-- 9) orders
ALTER TABLE IF EXISTS public.orders
  DROP COLUMN IF EXISTS pass_type,
  DROP COLUMN IF EXISTS qr_access_token,
  DROP COLUMN IF EXISTS qr_url_accessed,
  DROP COLUMN IF EXISTS qr_url_accessed_at,
  DROP COLUMN IF EXISTS qr_url_expires_at;

COMMIT;
