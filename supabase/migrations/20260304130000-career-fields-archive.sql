-- Soft-archive support for career application fields.
-- Instead of hard-deleting fields (which hides data from existing applications),
-- we mark them as archived and exclude them from new forms.

ALTER TABLE public.career_application_fields
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_career_application_fields_domain_archived
  ON public.career_application_fields (career_domain_id, archived_at);

