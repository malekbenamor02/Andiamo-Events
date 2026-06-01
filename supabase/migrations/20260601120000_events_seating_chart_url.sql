ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS seating_chart_url text NULL;

COMMENT ON COLUMN public.events.seating_chart_url IS
  'Optional venue seating plan image for pass-purchase; null hides the section.';
