-- Scanners: scan operators created only by super admin. Separate login, never trust frontend.
CREATE TABLE IF NOT EXISTS public.scanners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scanners_email ON public.scanners(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_scanners_created_by ON public.scanners(created_by);
CREATE INDEX IF NOT EXISTS idx_scanners_is_active ON public.scanners(is_active);

ALTER TABLE public.scanners ENABLE ROW LEVEL SECURITY;

-- Only service role / backend uses this table. CRUD via API with requireAdminAuth+requireSuperAdmin.
-- Scanner login is done via API that checks password_hash; no Supabase auth.
CREATE POLICY "scanners_service_role_all" ON public.scanners
  FOR ALL
  USING (auth.role() = 'service_role' OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role')
  WITH CHECK (auth.role() = 'service_role' OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

COMMENT ON TABLE public.scanners IS 'Scan operators created only by super admin. Separate login; scanner_id in scans comes from verified JWT, never from client.';
