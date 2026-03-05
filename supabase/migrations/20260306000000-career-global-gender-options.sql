-- Global career gender options: shared across all jobs (stored in site_content).
-- Admin adds/removes/enables/disables genders here; they appear in every job's Gender field.
INSERT INTO public.site_content (key, content, updated_at)
VALUES ('career_gender_options', '{"options": ["Male", "Female"], "disabledOptions": []}'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;
