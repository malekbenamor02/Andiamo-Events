-- Read-only validation queries for supabase-mcp remediation package (2026-06-28).
-- Run AFTER applying migrations to staging/production. SELECT-only — no DDL/DML.

-- =============================================================================
-- 1. Maintenance RPCs: anon/authenticated must NOT have EXECUTE
-- =============================================================================
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  grantee,
  privilege_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN information_schema.routine_privileges rp
  ON rp.routine_schema = n.nspname
 AND rp.routine_name = p.proname
 AND rp.privilege_type = 'EXECUTE'
WHERE n.nspname = 'public'
  AND p.proname IN (
    'release_order_stock_internal',
    'auto_fail_expired_pending_online_orders',
    'auto_reject_expired_pending_cash_orders',
    'apply_expiration_to_existing_pending_cash_orders',
    'clear_expiration_from_existing_pending_cash_orders',
    'verify_stock_calculations',
    'cleanup_old_credentials'
  )
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY p.proname, grantee;
-- Expected: 0 rows

SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'release_order_stock_internal',
    'auto_fail_expired_pending_online_orders',
    'auto_reject_expired_pending_cash_orders',
    'apply_expiration_to_existing_pending_cash_orders',
    'clear_expiration_from_existing_pending_cash_orders',
    'verify_stock_calculations',
    'cleanup_old_credentials'
  )
ORDER BY p.proname;
-- Expected: service_role_can_execute = true where function exists

-- =============================================================================
-- 2. is_service_role(): no client EXECUTE; policies use auth.role()
-- =============================================================================
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'is_service_role'
  AND privilege_type = 'EXECUTE'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC');
-- Expected: 0 rows

SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    qual ILIKE '%is_service_role%'
    OR with_check ILIKE '%is_service_role%'
  );
-- Expected: 0 rows (policies migrated to auth.role() = 'service_role')

-- =============================================================================
-- 3. SECURITY DEFINER search_path on ticket RPCs
-- =============================================================================
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.prosecdef AS security_definer,
  (SELECT option_value FROM pg_options_to_table(p.proconfig) WHERE option_name = 'search_path') AS search_path
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('insert_fulfillment_tickets_locked', 'validate_scanner_ticket_atomic')
ORDER BY p.proname;
-- Expected: search_path = 'public, pg_catalog'

-- =============================================================================
-- 4. Realtime publication: sensitive tables removed
-- =============================================================================
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
  AND tablename IN (
    'orders',
    'ambassador_applications',
    'career_applications',
    'marketing_campaigns',
    'marketing_campaign_recipients'
  )
ORDER BY tablename;
-- Expected: 0 rows

-- =============================================================================
-- 5. Scans RLS tightened
-- =============================================================================
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'scans'
ORDER BY policyname;
-- Expected: scans_service_role_all only; no ambassador/auth.uid policies

-- =============================================================================
-- 6. Explicit deny policies on zero-policy tables
-- =============================================================================
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policy_count,
       EXISTS (
         SELECT 1 FROM pg_policies p
         WHERE p.schemaname = 'public'
           AND p.tablename = c.relname
           AND p.policyname = c.relname || '_deny_all'
       ) AS has_deny_all
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'academy_influencers', 'academy_promo_codes', 'academy_registration_logs',
    'academy_registrations', 'academy_settings', 'ambassador_sessions',
    'career_application_logs', 'career_form_template_fields', 'career_form_templates',
    'event_promo_attempts', 'event_promo_code_pass_discounts', 'event_promo_code_passes',
    'event_promo_codes', 'event_promo_order_create_rate', 'event_promo_validate_rate',
    'pos_audit_log', 'pos_outlets', 'pos_pass_stock', 'pos_users',
    'presale_code_attempts', 'presale_code_pass_discounts', 'presale_codes',
    'presale_redeem_rate', 'presale_sessions', 'scan_system_config', 'users'
  )
ORDER BY c.relname;
-- Expected: rls_enabled = true, has_deny_all = true for each existing table

-- =============================================================================
-- 7. Events storage bucket policy
-- =============================================================================
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (
    policyname ILIKE '%events%'
    OR qual ILIKE '%events%'
    OR with_check ILIKE '%events%'
  )
ORDER BY policyname;
-- Expected: Service role manage events assets

-- =============================================================================
-- 8. Core sensitive tables still denied to clients
-- =============================================================================
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('orders', 'tickets', 'qr_tickets', 'admins', 'ambassadors')
  AND cmd = 'ALL'
ORDER BY tablename, policyname;
-- Expected: *_deny_all with qual = false
