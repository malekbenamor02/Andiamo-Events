-- Label Excel-imported newsletter subscribers (e.g. external event lists).
-- NULL import_label = website footer / organic signup.

ALTER TABLE public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS import_label TEXT;

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_import_label
  ON public.newsletter_subscribers (import_label)
  WHERE import_label IS NOT NULL;

COMMENT ON COLUMN public.newsletter_subscribers.import_label IS
  'Admin-defined label for Excel imports (e.g. old event name). NULL for website signups.';
