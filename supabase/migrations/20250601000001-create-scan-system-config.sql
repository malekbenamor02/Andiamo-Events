-- Global on/off for scan system. Super admin Start/Stop. When false: scanner app shows "Scan don't start yet", no APIs (except status).
CREATE TABLE IF NOT EXISTS public.scan_system_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Singleton: one row. Insert if not exists.
INSERT INTO public.scan_system_config (id, scan_enabled)
SELECT gen_random_uuid(), false
WHERE NOT EXISTS (SELECT 1 FROM public.scan_system_config LIMIT 1);

COMMENT ON TABLE public.scan_system_config IS 'Global scan on/off. Only super_admin can update. Scanner app reads scan_enabled via GET /api/scan-system-status.';
