-- Read-only RLS verification for Supabase SQL editor
-- Run after migration apply (local or production)

-- 1. RLS enabled on sensitive tables
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'admins', 'orders', 'tickets', 'qr_tickets', 'ambassadors',
    'contact_messages', 'newsletter_subscribers', 'phone_subscribers',
    'sms_logs', 'order_logs', 'admin_logs', 'events', 'event_passes'
  )
ORDER BY c.relname;

-- 2. Policies with USING (true) on non-public tables
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND qual = 'true'
  AND tablename NOT IN ('site_content', 'sponsors', 'team_members', 'payment_options')
ORDER BY tablename, policyname;

-- 3. Service-role NULL bypass patterns (should be empty)
SELECT schemaname, tablename, policyname, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual ILIKE '%IS NULL%' OR with_check ILIKE '%IS NULL%')
ORDER BY tablename;

-- 4. is_admin_user still returns false
SELECT public.is_admin_user() AS is_admin_user_should_be_false;

-- 5. Policy count summary
SELECT tablename, count(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- 6. TRUNCATE revoked from anon/authenticated (spot check)
SELECT grantee, privilege_type, table_name
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND privilege_type = 'TRUNCATE'
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name
LIMIT 50;
