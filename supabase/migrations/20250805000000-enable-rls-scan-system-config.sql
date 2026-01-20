-- Enable RLS on scan_system_config. No permissive policies for anon/authenticated.
-- Only the backend (service_role) can read/write; it bypasses RLS.
-- This removes "UNRESTRICTED" and blocks direct Data API access.

ALTER TABLE public.scan_system_config ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policies for anon or authenticated.
-- Service role (used by server.cjs) bypasses RLS and continues to work.

COMMENT ON TABLE public.scan_system_config IS 'Global scan on/off. RLS enabled; only service_role (backend) can access. Super admin updates via /api/admin/scan-system-config.';
