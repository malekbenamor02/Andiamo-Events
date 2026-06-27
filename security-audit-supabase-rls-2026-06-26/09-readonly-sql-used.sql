-- Read-only SQL queries used during security audit (2026-06-26)
-- Project: ykeryyraxmtjunnotoep
-- Only SELECT statements. No DDL/DML.

-- 1. RLS enabled / forced per table
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

-- 2. All RLS policies (public schema)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. Policies with broad true / null qual (unsafe pattern scan)
SELECT tablename, policyname, cmd, roles::text, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual = 'true' OR qual IS NULL OR with_check = 'true')
ORDER BY tablename;

-- 4. Policy count per table
SELECT tablename, COUNT(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- 5. Tables with RLS + policy count (including zero-policy tables)
SELECT c.relname AS table_name,
       COALESCE(p.cnt, 0) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN (
  SELECT tablename, COUNT(*) AS cnt
  FROM pg_policies WHERE schemaname = 'public'
  GROUP BY tablename
) p ON p.tablename = c.relname
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

-- 6. Aggregated grants for anon / authenticated
SELECT table_name, grantee,
       string_agg(DISTINCT privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;

-- 7. Full grants detail (anon, authenticated, service_role)
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;

-- 8. Sensitive table column inventory
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'admins', 'orders', 'tickets', 'ambassadors', 'contact_messages',
    'pos_users', 'scanners', 'ambassador_sessions', 'admin_logs', 'security_audit_logs'
  )
ORDER BY table_name, ordinal_position;
