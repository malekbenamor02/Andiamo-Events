-- Public countdown banner: admin toggle stored in site_content (read by anon SELECT; super_admin updates via existing policies).

INSERT INTO public.site_content (key, content)
VALUES ('countdown_banner_settings', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;
