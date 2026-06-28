-- Prevent direct client RPC calls to is_service_role() without breaking RLS (F-006).
-- Policies that used is_service_role() now inline auth.role() = 'service_role'.
-- Idempotent: safe to re-run.

-- =============================================================================
-- Replace is_service_role() in RLS policies with inline auth.role() check
-- =============================================================================

DROP POLICY IF EXISTS "csp_reports_service_insert" ON public.csp_reports;
CREATE POLICY "csp_reports_service_insert" ON public.csp_reports
  FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "aio_events_submissions_service_insert" ON public.aio_events_submissions;
CREATE POLICY "aio_events_submissions_service_insert" ON public.aio_events_submissions
  FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "security_audit_logs_service_insert" ON public.security_audit_logs;
CREATE POLICY "security_audit_logs_service_insert" ON public.security_audit_logs
  FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "investor_contacts_service_role_all" ON public.investor_contacts;
CREATE POLICY "investor_contacts_service_role_all" ON public.investor_contacts
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "marketing_campaigns_service_role_all" ON public.marketing_campaigns;
CREATE POLICY "marketing_campaigns_service_role_all" ON public.marketing_campaigns
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "marketing_campaign_recipients_service_role_all" ON public.marketing_campaign_recipients;
CREATE POLICY "marketing_campaign_recipients_service_role_all" ON public.marketing_campaign_recipients
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =============================================================================
-- Revoke direct RPC access; retain function for legacy/internal references
-- =============================================================================

REVOKE ALL ON FUNCTION public.is_service_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_service_role() FROM anon;
REVOKE ALL ON FUNCTION public.is_service_role() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.is_service_role() TO service_role;

COMMENT ON FUNCTION public.is_service_role() IS
  'Internal helper. Client EXECUTE revoked; RLS policies use auth.role() = ''service_role'' directly.';
