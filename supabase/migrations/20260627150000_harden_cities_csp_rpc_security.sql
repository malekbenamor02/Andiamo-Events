-- Harden cities/villes RLS, lock down csp_reports reads, revoke anon RPC on SECURITY DEFINER functions.
-- Idempotent: safe to re-run.

-- =============================================================================
-- cities / villes: public SELECT only; no anon/authenticated writes
-- =============================================================================

DROP POLICY IF EXISTS "Admin can manage cities" ON public.cities;
DROP POLICY IF EXISTS "Anyone can view cities" ON public.cities;
DROP POLICY IF EXISTS "Public can view cities" ON public.cities;
DROP POLICY IF EXISTS "cities_public_select" ON public.cities;

CREATE POLICY "cities_public_select" ON public.cities
  FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Admin can manage villes" ON public.villes;
DROP POLICY IF EXISTS "Anyone can view villes" ON public.villes;
DROP POLICY IF EXISTS "Public can view villes" ON public.villes;
DROP POLICY IF EXISTS "villes_public_select" ON public.villes;

CREATE POLICY "villes_public_select" ON public.villes
  FOR SELECT TO public
  USING (true);

-- =============================================================================
-- csp_reports: service-role insert only; no client reads
-- =============================================================================

DROP POLICY IF EXISTS "Allow select csp_reports" ON public.csp_reports;
DROP POLICY IF EXISTS "Allow service role insert csp_reports" ON public.csp_reports;
DROP POLICY IF EXISTS "csp_reports_service_insert" ON public.csp_reports;

CREATE POLICY "csp_reports_service_insert" ON public.csp_reports
  FOR INSERT TO public
  WITH CHECK (public.is_service_role());

-- =============================================================================
-- aio_events_submissions: backend service-role only (remove permissive public insert)
-- =============================================================================

DROP POLICY IF EXISTS "Public can insert aio events submissions" ON public.aio_events_submissions;
DROP POLICY IF EXISTS "Admins can view aio events submissions" ON public.aio_events_submissions;
DROP POLICY IF EXISTS "aio_events_submissions_service_insert" ON public.aio_events_submissions;

CREATE POLICY "aio_events_submissions_service_insert" ON public.aio_events_submissions
  FOR INSERT TO public
  WITH CHECK (public.is_service_role());

-- =============================================================================
-- marketing / investor: replace role IS NULL service policies with is_service_role()
-- =============================================================================

DROP POLICY IF EXISTS "Service role can manage investor_contacts" ON public.investor_contacts;
DROP POLICY IF EXISTS "investor_contacts_service_role_all" ON public.investor_contacts;
CREATE POLICY "investor_contacts_service_role_all" ON public.investor_contacts
  FOR ALL TO public
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

DROP POLICY IF EXISTS "Service role can manage marketing_campaigns" ON public.marketing_campaigns;
DROP POLICY IF EXISTS "marketing_campaigns_service_role_all" ON public.marketing_campaigns;
CREATE POLICY "marketing_campaigns_service_role_all" ON public.marketing_campaigns
  FOR ALL TO public
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

DROP POLICY IF EXISTS "Service role can manage marketing_campaign_recipients" ON public.marketing_campaign_recipients;
DROP POLICY IF EXISTS "marketing_campaign_recipients_service_role_all" ON public.marketing_campaign_recipients;
CREATE POLICY "marketing_campaign_recipients_service_role_all" ON public.marketing_campaign_recipients
  FOR ALL TO public
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

-- =============================================================================
-- Helpers: fixed search_path on SECURITY DEFINER helpers
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.is_admin_user() IS
  'Legacy helper; always false. Admin writes use backend service role only.';

CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN auth.role() = 'service_role';
END;
$$;

-- =============================================================================
-- SECURITY DEFINER functions: revoke anon/authenticated RPC; service_role only
-- Re-grant RLS helper functions to anon/authenticated for policy evaluation.
-- =============================================================================

DO $$
DECLARE
  r RECORD;
  rls_helpers text[] := ARRAY['is_service_role', 'is_public_listable_event'];
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS func_name,
      pg_get_function_identity_arguments(p.oid) AS func_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      r.schema_name,
      r.func_name,
      r.func_args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',
      r.schema_name,
      r.func_name,
      r.func_args
    );
    IF r.func_name = ANY (rls_helpers) THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO anon, authenticated',
        r.schema_name,
        r.func_name,
        r.func_args
      );
    END IF;
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_catalog',
      r.schema_name,
      r.func_name,
      r.func_args
    );
  END LOOP;
END $$;

-- =============================================================================
-- Extended RLS / RPC audit (used by npm run security:rls)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.security_rls_policy_audit()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  WITH sensitive AS (
    SELECT unnest(ARRAY[
      'admins', 'orders', 'tickets', 'qr_tickets', 'ambassadors',
      'ambassador_applications', 'contact_messages', 'newsletter_subscribers',
      'phone_subscribers', 'sms_logs', 'order_logs', 'admin_logs', 'site_logs',
      'career_applications', 'audience_suggestions', 'order_passes', 'csp_reports'
    ]) AS tablename
  ),
  public_read_allowlist AS (
    SELECT unnest(ARRAY[
      'site_content', 'sponsors', 'team_members', 'payment_options', 'cities', 'villes'
    ]) AS tablename
  ),
  allowed_insert_only AS (
    SELECT * FROM (VALUES
      ('contact_messages', 'contact_messages_anon_insert'),
      ('newsletter_subscribers', 'newsletter_subscribers_anon_insert'),
      ('phone_subscribers', 'phone_subscribers_anon_insert')
    ) AS t(tablename, policyname)
  ),
  rls_helpers AS (
    SELECT unnest(ARRAY['is_service_role', 'is_public_listable_event']) AS func_name
  ),
  rls_off AS (
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = false
      AND c.relname IN (SELECT tablename FROM sensitive)
  ),
  permissive_sensitive AS (
    SELECT p.tablename, p.policyname, p.cmd, p.roles::text AS roles, p.qual, p.with_check
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename IN (SELECT tablename FROM sensitive)
      AND NOT EXISTS (
        SELECT 1 FROM allowed_insert_only a
        WHERE a.tablename = p.tablename
          AND a.policyname = p.policyname
          AND p.cmd = 'INSERT'
      )
      AND NOT (
        p.tablename = 'csp_reports'
        AND p.policyname = 'csp_reports_service_insert'
        AND p.cmd = 'INSERT'
        AND (
          p.with_check = 'is_service_role()'
          OR p.with_check = 'public.is_service_role()'
        )
      )
      AND NOT (
        COALESCE(p.qual, '') ILIKE '%is_service_role%'
        OR COALESCE(p.with_check, '') ILIKE '%is_service_role%'
        OR COALESCE(p.qual, '') ILIKE '%auth.role() = ''service_role''%'
        OR COALESCE(p.with_check, '') ILIKE '%auth.role() = ''service_role''%'
      )
      AND (
        p.qual = 'true'
        OR p.with_check = 'true'
        OR (
          p.cmd IN ('SELECT', 'UPDATE', 'DELETE', 'ALL')
          AND (p.qual ILIKE '%IS NULL%' OR p.with_check ILIKE '%IS NULL%')
        )
      )
  ),
  permissive_public AS (
    SELECT p.tablename, p.policyname, p.cmd, p.roles::text AS roles, p.qual, p.with_check
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename NOT IN (SELECT tablename FROM sensitive)
      AND NOT (
        p.tablename IN (SELECT tablename FROM public_read_allowlist)
        AND p.cmd = 'SELECT'
        AND p.qual = 'true'
      )
      AND NOT EXISTS (
        SELECT 1 FROM allowed_insert_only a
        WHERE a.tablename = p.tablename
          AND a.policyname = p.policyname
          AND p.cmd = 'INSERT'
      )
      AND NOT (
        p.tablename = 'aio_events_submissions'
        AND p.policyname = 'aio_events_submissions_service_insert'
        AND p.cmd = 'INSERT'
        AND (
          p.with_check ILIKE '%is_service_role%'
        )
      )
      AND NOT (
        COALESCE(p.qual, '') ILIKE '%is_service_role%'
        OR COALESCE(p.with_check, '') ILIKE '%is_service_role%'
        OR COALESCE(p.qual, '') ILIKE '%auth.role() = ''service_role''%'
        OR COALESCE(p.with_check, '') ILIKE '%auth.role() = ''service_role''%'
      )
      AND (
        p.qual = 'true'
        OR p.with_check = 'true'
        OR (
          p.cmd IN ('SELECT', 'UPDATE', 'DELETE', 'ALL')
          AND (p.qual ILIKE '%IS NULL%' OR p.with_check ILIKE '%IS NULL%')
        )
      )
  ),
  unsafe_names AS (
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (SELECT tablename FROM sensitive)
      AND policyname IN (
        'admins_select', 'Public can view tickets', 'Public can read QR tickets by token',
        'Admin can manage all orders', 'Admins can manage all orders',
        'contact_messages_select', 'newsletter_subscribers_select',
        'events_select_public', 'Allow select csp_reports',
        'Admin can manage cities', 'Admin can manage villes'
      )
  ),
  anon_sd_funcs AS (
    SELECT
      p.proname AS func_name,
      pg_get_function_identity_arguments(p.oid) AS func_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
      AND p.proname NOT IN (SELECT func_name FROM rls_helpers)
  )
  SELECT jsonb_build_object(
    'rls_disabled_tables',
      COALESCE((SELECT jsonb_agg(tablename ORDER BY tablename) FROM rls_off), '[]'::jsonb),
    'permissive_policies',
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(permissive_sensitive) ORDER BY tablename, policyname)
         FROM permissive_sensitive),
        '[]'::jsonb
      ),
    'permissive_public_policies',
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(permissive_public) ORDER BY tablename, policyname)
         FROM permissive_public),
        '[]'::jsonb
      ),
    'unsafe_policy_names',
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(unsafe_names) ORDER BY tablename, policyname)
         FROM unsafe_names),
        '[]'::jsonb
      ),
    'anon_security_definer_functions',
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(anon_sd_funcs) ORDER BY func_name, func_args)
         FROM anon_sd_funcs),
        '[]'::jsonb
      )
  );
$$;

REVOKE ALL ON FUNCTION public.security_rls_policy_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.security_rls_policy_audit() TO service_role;
