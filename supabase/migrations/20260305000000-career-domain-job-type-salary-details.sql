-- Add job type, salary, and job details to career domains.
ALTER TABLE public.career_domains
  ADD COLUMN IF NOT EXISTS job_type TEXT,
  ADD COLUMN IF NOT EXISTS salary TEXT,
  ADD COLUMN IF NOT EXISTS job_details TEXT;

COMMENT ON COLUMN public.career_domains.job_type IS 'Optional: Full-time, Part-time, Freelance, Per Project, Internship, Remote, Volunteer';
COMMENT ON COLUMN public.career_domains.salary IS 'Optional salary text (e.g. range or "Competitive"). If null, not shown on listing.';
COMMENT ON COLUMN public.career_domains.job_details IS 'Optional full job details (HTML or plain). Shown on job detail page below the sticky header.';
