-- Career form templates: reusable sets of fields that can be applied to multiple domains.

CREATE TABLE IF NOT EXISTS public.career_form_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.career_form_template_fields (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.career_form_templates(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  options JSONB DEFAULT '[]'::jsonb,
  validation JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(template_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_career_form_template_fields_template ON public.career_form_template_fields(template_id);

-- Templates are admin-only via backend (service role); no public RLS needed.
ALTER TABLE public.career_form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_form_template_fields ENABLE ROW LEVEL SECURITY;

