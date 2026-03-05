-- When a career domain is deleted, keep applications: set career_domain_id to NULL
-- instead of deleting them (admin can still view/export applications from deleted domains).

DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
  WHERE c.conrelid = 'public.career_applications'::regclass
    AND c.contype = 'f'
    AND a.attname = 'career_domain_id';
  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.career_applications DROP CONSTRAINT %I', conname);
  END IF;
END $$;

ALTER TABLE public.career_applications
  ALTER COLUMN career_domain_id DROP NOT NULL;

ALTER TABLE public.career_applications
  ADD CONSTRAINT career_applications_career_domain_id_fkey
  FOREIGN KEY (career_domain_id) REFERENCES public.career_domains(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.career_applications.career_domain_id IS 'Null when the domain was deleted; application data is preserved.';
