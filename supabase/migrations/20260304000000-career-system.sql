-- See docs/career-page-implementation-plan.md.

-- Career domains (e.g. Marketing, Tech, Events)
CREATE TABLE IF NOT EXISTS public.career_domains (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  applications_open BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  document_upload_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_domains_slug ON public.career_domains(slug);
CREATE INDEX IF NOT EXISTS idx_career_domains_applications_open ON public.career_domains(applications_open);

-- Form fields per domain (dynamic form builder)
CREATE TABLE IF NOT EXISTS public.career_application_fields (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  career_domain_id UUID NOT NULL REFERENCES public.career_domains(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'email', 'age', 'phone', 'date', 'link', 'textarea', 'number', 'select', 'file')),
  required BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  options JSONB DEFAULT '[]'::jsonb,
  validation JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(career_domain_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_career_application_fields_domain ON public.career_application_fields(career_domain_id);

-- Submitted applications
CREATE TABLE IF NOT EXISTS public.career_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  career_domain_id UUID NOT NULL REFERENCES public.career_domains(id) ON DELETE RESTRICT,
  form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'approved', 'rejected')),
  approved_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_applications_domain ON public.career_applications(career_domain_id);
CREATE INDEX IF NOT EXISTS idx_career_applications_status ON public.career_applications(status);
CREATE INDEX IF NOT EXISTS idx_career_applications_created_at ON public.career_applications(created_at DESC);

-- Audit log: who viewed/updated which application
CREATE TABLE IF NOT EXISTS public.career_application_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  career_application_id UUID NOT NULL REFERENCES public.career_applications(id) ON DELETE CASCADE,
  admin_id TEXT,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_application_logs_application ON public.career_application_logs(career_application_id);

-- RLS
ALTER TABLE public.career_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_application_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_application_logs ENABLE ROW LEVEL SECURITY;

-- career_domains: public can read open domains; admin ops via service role / backend
CREATE POLICY "Public can read open career domains" ON public.career_domains
  FOR SELECT USING (applications_open = true);

-- career_application_fields: public reads fields for open domains; admin via backend
CREATE POLICY "Public can read fields of open career domains" ON public.career_application_fields
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.career_domains d
      WHERE d.id = career_application_fields.career_domain_id AND d.applications_open = true
    )
  );

-- career_applications: no direct anon access; server uses service role for all operations
-- (No policies = anon cannot read/write; service_role bypasses RLS.)

-- career_application_logs: backend only (service role)
-- (No policies for anon; service_role bypasses RLS.)

-- Global career open/close: use site_content
INSERT INTO public.site_content (key, content, updated_at)
VALUES (
  'career_applications_settings',
  '{"enabled": true, "admin_notification_emails": []}'::jsonb,
  NOW()
)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.career_domains IS 'Job/recruitment domains (e.g. Marketing, Tech). Admin can open/close and enable document upload.';
COMMENT ON TABLE public.career_application_fields IS 'Dynamic form fields per domain. field_type: text, email, age, phone, date, link, textarea, number, select, file. options used for select.';
COMMENT ON TABLE public.career_applications IS 'Candidate submissions. form_data is key-value from dynamic fields.';
COMMENT ON TABLE public.career_application_logs IS 'Audit log: admin view/update actions on career applications.';
