-- Optional line shown on public gallery tiles (e.g. organizer names)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS gallery_credit TEXT;
