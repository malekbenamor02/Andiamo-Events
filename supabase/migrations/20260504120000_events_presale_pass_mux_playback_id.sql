-- Optional Mux playback ID for DRM-signed presale hero video (see docs/drm-provider-integration.md).
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS presale_pass_mux_playback_id text NULL;

COMMENT ON COLUMN public.events.presale_pass_mux_playback_id IS 'Mux playback ID for presale pass video when using Mux DRM; null = use presale_pass_video_url + proxy instead.';
