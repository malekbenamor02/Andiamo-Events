-- Remove featured flag; event lifecycle uses event_status only.
ALTER TABLE public.events DROP COLUMN IF EXISTS featured;
