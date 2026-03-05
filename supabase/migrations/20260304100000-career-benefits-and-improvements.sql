-- Add benefits / "Why join us" to career domains and global career content.
ALTER TABLE public.career_domains
  ADD COLUMN IF NOT EXISTS benefits TEXT;

COMMENT ON COLUMN public.career_domains.benefits IS 'Optional "Why join us" / benefits text (HTML or plain) for this domain.';

-- Global "Why join us" for careers list page (optional)
INSERT INTO public.site_content (key, content, updated_at)
VALUES ('career_why_join_us', '{"en": {"title": "Why join us", "items": ["Work with a passionate team", "Grow your skills", "Make an impact"]}, "fr": {"title": "Pourquoi nous rejoindre", "items": ["Travaillez avec une équipe passionnée", "Développez vos compétences", "Faites la différence"]}}'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;
