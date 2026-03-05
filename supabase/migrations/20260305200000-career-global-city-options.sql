-- Global career city options: shared across all jobs (stored in site_content).
-- Admin adds/removes/enables/disables cities here; they appear in every job's City field.
INSERT INTO public.site_content (key, content, updated_at)
VALUES ('career_city_options', '{"options": [], "disabledOptions": []}'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;
