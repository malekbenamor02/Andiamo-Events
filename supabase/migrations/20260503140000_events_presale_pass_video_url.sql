-- Optional hero video on pass purchase when presale is enabled (poster remains for non-presale).
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS presale_pass_video_url text NULL;

COMMENT ON COLUMN public.events.presale_pass_video_url IS 'Public URL (e.g. storage) for pass-purchase hero video when presale_enabled; poster_url is used when presale is off or this is null.';
