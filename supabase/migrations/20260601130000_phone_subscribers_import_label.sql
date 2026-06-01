-- Label Excel-imported phone subscribers (e.g. external event lists).
-- NULL import_label = website popup / organic signup.

ALTER TABLE public.phone_subscribers
  ADD COLUMN IF NOT EXISTS import_label TEXT;

CREATE INDEX IF NOT EXISTS idx_phone_subscribers_import_label
  ON public.phone_subscribers (import_label)
  WHERE import_label IS NOT NULL;

COMMENT ON COLUMN public.phone_subscribers.import_label IS
  'Admin-defined label for Excel imports (e.g. old event name). NULL for popup signups.';
