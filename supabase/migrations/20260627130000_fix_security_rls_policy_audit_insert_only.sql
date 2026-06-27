-- Fix security_rls_policy_audit false positives on intentional insert-only public form policies.

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
      'career_applications', 'audience_suggestions', 'order_passes'
    ]) AS tablename
  ),
  allowed_insert_only AS (
    SELECT * FROM (VALUES
      ('contact_messages', 'contact_messages_anon_insert'),
      ('newsletter_subscribers', 'newsletter_subscribers_anon_insert'),
      ('phone_subscribers', 'phone_subscribers_anon_insert')
    ) AS t(tablename, policyname)
  ),
  rls_off AS (
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false
      AND c.relname IN (SELECT tablename FROM sensitive)
  ),
  permissive AS (
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
      AND (
        p.qual = 'true'
        OR p.with_check = 'true'
        OR (
          p.cmd IN ('SELECT', 'UPDATE', 'DELETE', 'ALL')
          AND (p.qual ILIKE '%IS NULL%' OR p.with_check ILIKE '%IS NULL%')
        )
        OR (
          p.cmd = 'ALL'
          AND NOT (
            COALESCE(p.qual, '') = 'false'
            AND COALESCE(p.with_check, '') = 'false'
          )
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
        'events_select_public'
      )
  )
  SELECT jsonb_build_object(
    'rls_disabled_tables', COALESCE((SELECT jsonb_agg(tablename ORDER BY tablename) FROM rls_off), '[]'::jsonb),
    'permissive_policies', COALESCE((SELECT jsonb_agg(to_jsonb(permissive) ORDER BY tablename, policyname) FROM permissive), '[]'::jsonb),
    'unsafe_policy_names', COALESCE((SELECT jsonb_agg(to_jsonb(unsafe_names) ORDER BY tablename, policyname) FROM unsafe_names), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.security_rls_policy_audit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.security_rls_policy_audit() TO service_role;
