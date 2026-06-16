-- Harden RLS on privileged admin tables.
-- Admin auth uses cookie JWT + backend service role — not Supabase Auth.
-- Anon/authenticated clients must not mutate privileged data.

-- ============================================
-- is_admin_user(): no longer always true
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  -- Custom admin JWT is verified in Node API; browser anon key must not write via RLS bypass.
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.is_admin_user() IS
  'Returns false — admin writes go through backend service role only.';

-- ============================================
-- ADMINS
-- ============================================
DROP POLICY IF EXISTS "admins_select" ON public.admins;
DROP POLICY IF EXISTS "admins_insert" ON public.admins;
DROP POLICY IF EXISTS "admins_update" ON public.admins;
DROP POLICY IF EXISTS "admins_delete" ON public.admins;

-- Login verification uses service role on backend; deny anon direct access.
CREATE POLICY "admins_deny_anon_all" ON public.admins
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ============================================
-- SITE_CONTENT — public read, no anon writes
-- ============================================
DROP POLICY IF EXISTS "Admins can insert site content" ON public.site_content;
DROP POLICY IF EXISTS "Admins can update site content" ON public.site_content;

-- Keep public read (policy may exist from earlier migration)
DROP POLICY IF EXISTS "Public can view site content" ON public.site_content;
CREATE POLICY "site_content_public_select" ON public.site_content
  FOR SELECT
  USING (true);

-- ============================================
-- EVENTS — public read, no anon writes
-- ============================================
DROP POLICY IF EXISTS "events_insert_admin" ON public.events;
DROP POLICY IF EXISTS "events_update_admin" ON public.events;
DROP POLICY IF EXISTS "events_delete_admin" ON public.events;
DROP POLICY IF EXISTS "Admins can insert events" ON public.events;
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;

-- events_select_public should remain from prior migration

-- ============================================
-- ORDERS — remove blanket admin FOR ALL
-- ============================================
DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;

-- Public insert policies for checkout remain from prior migrations.
-- Admin order mutations use API + service role.

-- ============================================
-- ADMIN_LOGS
-- ============================================
DROP POLICY IF EXISTS "Allow read admin_logs" ON public.admin_logs;
DROP POLICY IF EXISTS "Allow insert admin_logs" ON public.admin_logs;

CREATE POLICY "admin_logs_deny_anon_all" ON public.admin_logs
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ============================================
-- SPONSORS — public read only
-- ============================================
DROP POLICY IF EXISTS "Public can insert sponsors" ON public.sponsors;
DROP POLICY IF EXISTS "Public can update sponsors" ON public.sponsors;
DROP POLICY IF EXISTS "Public can delete sponsors" ON public.sponsors;
DROP POLICY IF EXISTS "Admins can manage sponsors" ON public.sponsors;

-- SELECT "Public can view sponsors" retained if present

-- ============================================
-- TEAM_MEMBERS (table may exist in prod without migration)
-- ============================================
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  image_url TEXT,
  bio TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view team_members" ON public.team_members;
DROP POLICY IF EXISTS "team_members_public_select" ON public.team_members;
DROP POLICY IF EXISTS "team_members_deny_anon_writes" ON public.team_members;

CREATE POLICY "team_members_public_select" ON public.team_members
  FOR SELECT
  USING (true);

-- ============================================
-- PAYMENT_OPTIONS — deny anon writes
-- ============================================
DROP POLICY IF EXISTS "Admins can manage payment options" ON public.payment_options;

-- Public SELECT policy retained

-- ============================================
-- ORDER_EXPIRATION_SETTINGS — deny anon (API uses service role)
-- ============================================
DROP POLICY IF EXISTS "Admins can view expiration settings" ON public.order_expiration_settings;
DROP POLICY IF EXISTS "Admins can insert expiration settings" ON public.order_expiration_settings;
DROP POLICY IF EXISTS "Admins can update expiration settings" ON public.order_expiration_settings;
DROP POLICY IF EXISTS "Admins can delete expiration settings" ON public.order_expiration_settings;

CREATE POLICY "order_expiration_settings_deny_anon" ON public.order_expiration_settings
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ============================================
-- Future: admin_role_permissions (not activated)
-- ============================================
-- CREATE TABLE IF NOT EXISTS public.admin_role_permissions (
--   role text NOT NULL,
--   permission_key text NOT NULL,
--   enabled boolean NOT NULL DEFAULT true,
--   updated_at timestamptz,
--   updated_by uuid,
--   PRIMARY KEY (role, permission_key)
-- );
