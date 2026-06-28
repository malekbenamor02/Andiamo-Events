-- Tighten scans RLS: service_role-only writes/reads (F-003).
-- Scan/check-in records are created via validate_scanner_ticket_atomic and server.cjs/api/scan.js.
-- Ambassadors do not use Supabase Auth; legacy auth.uid() policies were forgeable if UIDs aligned.
-- Idempotent: safe to re-run.

DROP POLICY IF EXISTS "Ambassadors can view their own scans" ON public.scans;
DROP POLICY IF EXISTS "Ambassadors can insert scans" ON public.scans;
DROP POLICY IF EXISTS "Admins can view all scans" ON public.scans;
DROP POLICY IF EXISTS "Admins can manage all scans" ON public.scans;
DROP POLICY IF EXISTS "scans_select" ON public.scans;
DROP POLICY IF EXISTS "scans_insert" ON public.scans;
DROP POLICY IF EXISTS "scans_admin_all" ON public.scans;
DROP POLICY IF EXISTS "scans_deny_all" ON public.scans;
DROP POLICY IF EXISTS "scans_service_role_all" ON public.scans;

CREATE POLICY "scans_service_role_all" ON public.scans
  FOR ALL TO public
  USING (
    auth.role() = 'service_role'
    OR (coalesce(current_setting('request.jwt.claims', true), '{}')::json ->> 'role') = 'service_role'
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (coalesce(current_setting('request.jwt.claims', true), '{}')::json ->> 'role') = 'service_role'
  );

COMMENT ON POLICY "scans_service_role_all" ON public.scans IS
  'Scans are written only by backend service_role (scanner RPC / admin API). No client direct access.';
