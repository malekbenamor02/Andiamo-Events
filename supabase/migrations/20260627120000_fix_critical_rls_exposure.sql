-- Fix critical RLS exposure: deny anon/authenticated direct access to private tables.
-- Consolidates never-applied 20260616000000_harden-admin-privileged-table-rls.sql + full P0/P1 lockdown.
-- Idempotent: safe to re-run.

-- =============================================================================
-- Helpers
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.is_admin_user() IS
  'Legacy helper; always false. Admin writes use backend service role only.';

CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.role() = 'service_role';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.is_service_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_service_role() TO anon, authenticated, service_role;

-- Public event visibility (matches useEvents / isEventOmittedFromPublicListings)
CREATE OR REPLACE FUNCTION public.is_public_listable_event(e public.events)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(e.is_test, false) = false
    AND COALESCE(e.presale_enabled, false) = false
    AND COALESCE(e.event_status, 'active') <> 'cancelled';
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- ADMINS (P0) — deny all client access
-- =============================================================================

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can access own data" ON public.admins;
DROP POLICY IF EXISTS "admins_select" ON public.admins;
DROP POLICY IF EXISTS "admins_insert" ON public.admins;
DROP POLICY IF EXISTS "admins_update" ON public.admins;
DROP POLICY IF EXISTS "admins_delete" ON public.admins;
DROP POLICY IF EXISTS "admins_deny_anon_all" ON public.admins;
DROP POLICY IF EXISTS "admins_deny_all" ON public.admins;

CREATE POLICY "admins_deny_all" ON public.admins
  FOR ALL TO public
  USING (false)
  WITH CHECK (false);

-- =============================================================================
-- ORDERS (P0)
-- =============================================================================

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;
DROP POLICY IF EXISTS "Ambassadors can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Ambassadors can update own orders" ON public.orders;
DROP POLICY IF EXISTS "Public can create COD orders" ON public.orders;
DROP POLICY IF EXISTS "Public can create online orders" ON public.orders;
DROP POLICY IF EXISTS "orders_deny_all" ON public.orders;

CREATE POLICY "orders_deny_all" ON public.orders
  FOR ALL TO public
  USING (false)
  WITH CHECK (false);

-- =============================================================================
-- TICKETS (P0)
-- =============================================================================

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow server inserts for tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins can manage all tickets" ON public.tickets;
DROP POLICY IF EXISTS "System can manage tickets" ON public.tickets;
DROP POLICY IF EXISTS "tickets_deny_all" ON public.tickets;

CREATE POLICY "tickets_deny_all" ON public.tickets
  FOR ALL TO public
  USING (false)
  WITH CHECK (false);

-- =============================================================================
-- QR_TICKETS (P0)
-- =============================================================================

ALTER TABLE public.qr_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read QR tickets by token" ON public.qr_tickets;
DROP POLICY IF EXISTS "Service role can manage QR tickets" ON public.qr_tickets;
DROP POLICY IF EXISTS "qr_tickets_deny_all" ON public.qr_tickets;

CREATE POLICY "qr_tickets_deny_all" ON public.qr_tickets
  FOR ALL TO public
  USING (false)
  WITH CHECK (false);

-- =============================================================================
-- ORDER_PASSES (P1)
-- =============================================================================

ALTER TABLE public.order_passes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view order passes" ON public.order_passes;
DROP POLICY IF EXISTS "Public can insert order passes" ON public.order_passes;
DROP POLICY IF EXISTS "Admins can manage all order passes" ON public.order_passes;
DROP POLICY IF EXISTS "order_passes_deny_all" ON public.order_passes;

CREATE POLICY "order_passes_deny_all" ON public.order_passes
  FOR ALL TO public
  USING (false)
  WITH CHECK (false);

-- =============================================================================
-- AMBASSADORS (P1)
-- =============================================================================

ALTER TABLE public.ambassadors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view all ambassadors" ON public.ambassadors;
DROP POLICY IF EXISTS "Ambassadors can update own data" ON public.ambassadors;
DROP POLICY IF EXISTS "Ambassadors can view own data" ON public.ambassadors;
DROP POLICY IF EXISTS "Anyone can insert ambassador applications" ON public.ambassadors;
DROP POLICY IF EXISTS "Public can insert ambassadors" ON public.ambassadors;
DROP POLICY IF EXISTS "Public can update ambassadors" ON public.ambassadors;
DROP POLICY IF EXISTS "Public can view ambassadors" ON public.ambassadors;
DROP POLICY IF EXISTS "Service role can manage ambassadors" ON public.ambassadors;
DROP POLICY IF EXISTS "ambassadors_delete" ON public.ambassadors;
DROP POLICY IF EXISTS "ambassadors_insert" ON public.ambassadors;
DROP POLICY IF EXISTS "ambassadors_select" ON public.ambassadors;
DROP POLICY IF EXISTS "ambassadors_update" ON public.ambassadors;
DROP POLICY IF EXISTS "ambassadors_deny_all" ON public.ambassadors;

CREATE POLICY "ambassadors_deny_all" ON public.ambassadors
  FOR ALL TO public
  USING (false)
  WITH CHECK (false);

-- =============================================================================
-- AMBASSADOR_APPLICATIONS (P1) — API-only
-- =============================================================================

ALTER TABLE public.ambassador_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ambassador_applications_select" ON public.ambassador_applications;
DROP POLICY IF EXISTS "ambassador_applications_insert" ON public.ambassador_applications;
DROP POLICY IF EXISTS "ambassador_applications_update" ON public.ambassador_applications;
DROP POLICY IF EXISTS "ambassador_applications_deny_all" ON public.ambassador_applications;

CREATE POLICY "ambassador_applications_deny_all" ON public.ambassador_applications
  FOR ALL TO public
  USING (false)
  WITH CHECK (false);

-- =============================================================================
-- CONTACT_MESSAGES (P1) — insert-only for public forms
-- =============================================================================

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_messages_select" ON public.contact_messages;
DROP POLICY IF EXISTS "contact_messages_insert" ON public.contact_messages;
DROP POLICY IF EXISTS "Anyone can submit contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Anyone can view contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.contact_messages;
DROP POLICY IF EXISTS "Admins can view contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Allow insert for anonymous users" ON public.contact_messages;
DROP POLICY IF EXISTS "contact_messages_anon_insert" ON public.contact_messages;

CREATE POLICY "contact_messages_anon_insert" ON public.contact_messages
  FOR INSERT TO public
  WITH CHECK (
    status IS NULL OR status = 'unread'
  );

-- =============================================================================
-- NEWSLETTER_SUBSCRIBERS (P1) — insert-only
-- =============================================================================

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "newsletter_subscribers_select" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "newsletter_subscribers_insert" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "newsletter_subscribers_delete" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Allow anon insert newsletter" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Anyone can subscribe to newsletter" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "newsletter_subscribers_anon_insert" ON public.newsletter_subscribers;

CREATE POLICY "newsletter_subscribers_anon_insert" ON public.newsletter_subscribers
  FOR INSERT TO public
  WITH CHECK (import_label IS NULL);

-- =============================================================================
-- PHONE_SUBSCRIBERS (P1) — insert-only
-- =============================================================================

ALTER TABLE public.phone_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "phone_subscribers_select" ON public.phone_subscribers;
DROP POLICY IF EXISTS "phone_subscribers_insert" ON public.phone_subscribers;
DROP POLICY IF EXISTS "phone_subscribers_delete" ON public.phone_subscribers;
DROP POLICY IF EXISTS "Admins can delete phone subscribers" ON public.phone_subscribers;
DROP POLICY IF EXISTS "Admins can view all phone subscribers" ON public.phone_subscribers;
DROP POLICY IF EXISTS "Allow phone subscriber inserts" ON public.phone_subscribers;
DROP POLICY IF EXISTS "Allow viewing phone subscribers" ON public.phone_subscribers;
DROP POLICY IF EXISTS "Public can insert phone subscribers" ON public.phone_subscribers;
DROP POLICY IF EXISTS "phone_subscribers_anon_insert" ON public.phone_subscribers;

CREATE POLICY "phone_subscribers_anon_insert" ON public.phone_subscribers
  FOR INSERT TO public
  WITH CHECK (import_label IS NULL);

-- =============================================================================
-- LOGS (P1)
-- =============================================================================

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read admin_logs" ON public.admin_logs;
DROP POLICY IF EXISTS "Allow insert admin_logs" ON public.admin_logs;
DROP POLICY IF EXISTS "admin_logs_deny_anon_all" ON public.admin_logs;
DROP POLICY IF EXISTS "admin_logs_deny_all" ON public.admin_logs;
CREATE POLICY "admin_logs_deny_all" ON public.admin_logs FOR ALL TO public USING (false) WITH CHECK (false);

ALTER TABLE public.order_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage all order logs" ON public.order_logs;
DROP POLICY IF EXISTS "Ambassadors can view own order logs" ON public.order_logs;
DROP POLICY IF EXISTS "System can create order logs" ON public.order_logs;
DROP POLICY IF EXISTS "order_logs_deny_all" ON public.order_logs;
CREATE POLICY "order_logs_deny_all" ON public.order_logs FOR ALL TO public USING (false) WITH CHECK (false);

ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view SMS logs" ON public.sms_logs;
DROP POLICY IF EXISTS "Public can insert SMS logs" ON public.sms_logs;
DROP POLICY IF EXISTS "sms_logs_deny_all" ON public.sms_logs;
CREATE POLICY "sms_logs_deny_all" ON public.sms_logs FOR ALL TO public USING (false) WITH CHECK (false);

ALTER TABLE public.site_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "site_logs_insert" ON public.site_logs;
DROP POLICY IF EXISTS "site_logs_select" ON public.site_logs;
DROP POLICY IF EXISTS "site_logs_deny_all" ON public.site_logs;
CREATE POLICY "site_logs_deny_all" ON public.site_logs FOR ALL TO public USING (false) WITH CHECK (false);

-- =============================================================================
-- CAREER_APPLICATIONS (P1)
-- =============================================================================

ALTER TABLE public.career_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "career_applications_select" ON public.career_applications;
DROP POLICY IF EXISTS "career_applications_deny_all" ON public.career_applications;
CREATE POLICY "career_applications_deny_all" ON public.career_applications FOR ALL TO public USING (false) WITH CHECK (false);

-- =============================================================================
-- AUDIENCE_SUGGESTIONS (P1)
-- =============================================================================

ALTER TABLE public.audience_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audience_suggestions_select" ON public.audience_suggestions;
DROP POLICY IF EXISTS "audience_suggestions_insert" ON public.audience_suggestions;
DROP POLICY IF EXISTS "audience_suggestions_update" ON public.audience_suggestions;
DROP POLICY IF EXISTS "audience_suggestions_delete" ON public.audience_suggestions;
DROP POLICY IF EXISTS "audience_suggestions_deny_all" ON public.audience_suggestions;
CREATE POLICY "audience_suggestions_deny_all" ON public.audience_suggestions FOR ALL TO public USING (false) WITH CHECK (false);

-- =============================================================================
-- AMBASSADOR APPLICATION SELECTIONS (P1)
-- =============================================================================

ALTER TABLE public.ambassador_application_selections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ambassador_application_selections_select" ON public.ambassador_application_selections;
DROP POLICY IF EXISTS "ambassador_application_selections_insert" ON public.ambassador_application_selections;
DROP POLICY IF EXISTS "ambassador_application_selections_update" ON public.ambassador_application_selections;
DROP POLICY IF EXISTS "ambassador_application_selections_delete" ON public.ambassador_application_selections;
DROP POLICY IF EXISTS "ambassador_application_selections_deny_all" ON public.ambassador_application_selections;
CREATE POLICY "ambassador_application_selections_deny_all" ON public.ambassador_application_selections FOR ALL TO public USING (false) WITH CHECK (false);

ALTER TABLE public.ambassador_application_selection_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ambassador_application_selection_items_select" ON public.ambassador_application_selection_items;
DROP POLICY IF EXISTS "ambassador_application_selection_items_insert" ON public.ambassador_application_selection_items;
DROP POLICY IF EXISTS "ambassador_application_selection_items_update" ON public.ambassador_application_selection_items;
DROP POLICY IF EXISTS "ambassador_application_selection_items_delete" ON public.ambassador_application_selection_items;
DROP POLICY IF EXISTS "ambassador_application_selection_items_deny_all" ON public.ambassador_application_selection_items;
CREATE POLICY "ambassador_application_selection_items_deny_all" ON public.ambassador_application_selection_items FOR ALL TO public USING (false) WITH CHECK (false);

-- =============================================================================
-- EVENTS — scoped public read; no anon writes
-- =============================================================================

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_select_public" ON public.events;
DROP POLICY IF EXISTS "Public can view events" ON public.events;
DROP POLICY IF EXISTS "events_insert_admin" ON public.events;
DROP POLICY IF EXISTS "events_update_admin" ON public.events;
DROP POLICY IF EXISTS "events_delete_admin" ON public.events;
DROP POLICY IF EXISTS "Admins can insert events" ON public.events;
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;
DROP POLICY IF EXISTS "events_public_select" ON public.events;

CREATE POLICY "events_public_select" ON public.events
  FOR SELECT TO public
  USING (
    COALESCE(is_test, false) = false
    AND COALESCE(presale_enabled, false) = false
    AND COALESCE(event_status, 'active') <> 'cancelled'
  );

-- =============================================================================
-- EVENT_PASSES — public read when parent event is listable; no anon writes
-- =============================================================================

ALTER TABLE public.event_passes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_passes_select_public_when_not_presale" ON public.event_passes;
DROP POLICY IF EXISTS "event_passes_insert_anon" ON public.event_passes;
DROP POLICY IF EXISTS "event_passes_update_anon" ON public.event_passes;
DROP POLICY IF EXISTS "event_passes_delete_anon" ON public.event_passes;
DROP POLICY IF EXISTS "event_passes_public_select" ON public.event_passes;

CREATE POLICY "event_passes_public_select" ON public.event_passes
  FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_passes.event_id
        AND public.is_public_listable_event(e)
    )
  );

-- =============================================================================
-- SITE_CONTENT (from 20260616)
-- =============================================================================

DROP POLICY IF EXISTS "Admins can insert site content" ON public.site_content;
DROP POLICY IF EXISTS "Admins can update site content" ON public.site_content;
DROP POLICY IF EXISTS "Public can view site content" ON public.site_content;
DROP POLICY IF EXISTS "site_content_public_select" ON public.site_content;

CREATE POLICY "site_content_public_select" ON public.site_content
  FOR SELECT TO public
  USING (true);

-- =============================================================================
-- SPONSORS / TEAM_MEMBERS — public read only (20260616)
-- =============================================================================

DROP POLICY IF EXISTS "Public can insert sponsors" ON public.sponsors;
DROP POLICY IF EXISTS "Public can update sponsors" ON public.sponsors;
DROP POLICY IF EXISTS "Public can delete sponsors" ON public.sponsors;
DROP POLICY IF EXISTS "Admins can manage sponsors" ON public.sponsors;
DROP POLICY IF EXISTS "Allow all delete on sponsors" ON public.sponsors;
DROP POLICY IF EXISTS "Allow all insert on sponsors" ON public.sponsors;
DROP POLICY IF EXISTS "Allow all update on sponsors" ON public.sponsors;
DROP POLICY IF EXISTS "Allow all select on sponsors" ON public.sponsors;
DROP POLICY IF EXISTS "Public can view sponsors" ON public.sponsors;
DROP POLICY IF EXISTS "sponsors_public_select" ON public.sponsors;

CREATE POLICY "sponsors_public_select" ON public.sponsors FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow all delete on team_members" ON public.team_members;
DROP POLICY IF EXISTS "Allow all insert on team_members" ON public.team_members;
DROP POLICY IF EXISTS "Allow all update on team_members" ON public.team_members;
DROP POLICY IF EXISTS "Allow all select on team_members" ON public.team_members;
DROP POLICY IF EXISTS "Public can view team_members" ON public.team_members;
DROP POLICY IF EXISTS "team_members_public_select" ON public.team_members;

CREATE POLICY "team_members_public_select" ON public.team_members FOR SELECT TO public USING (true);

-- =============================================================================
-- PAYMENT_OPTIONS — public read; no anon writes
-- =============================================================================

DROP POLICY IF EXISTS "Admins can manage payment options" ON public.payment_options;

-- =============================================================================
-- ORDER_EXPIRATION_SETTINGS — deny anon (20260616)
-- =============================================================================

DROP POLICY IF EXISTS "Admins can view expiration settings" ON public.order_expiration_settings;
DROP POLICY IF EXISTS "Admins can insert expiration settings" ON public.order_expiration_settings;
DROP POLICY IF EXISTS "Admins can update expiration settings" ON public.order_expiration_settings;
DROP POLICY IF EXISTS "Admins can delete expiration settings" ON public.order_expiration_settings;
DROP POLICY IF EXISTS "order_expiration_settings_deny_anon" ON public.order_expiration_settings;

CREATE POLICY "order_expiration_settings_deny_anon" ON public.order_expiration_settings
  FOR ALL TO public USING (false) WITH CHECK (false);

-- =============================================================================
-- Fix service-role policies that matched role IS NULL (security_audit_logs, etc.)
-- =============================================================================

DROP POLICY IF EXISTS "System can insert security audit logs" ON public.security_audit_logs;
DROP POLICY IF EXISTS "security_audit_logs_service_insert" ON public.security_audit_logs;
CREATE POLICY "security_audit_logs_service_insert" ON public.security_audit_logs
  FOR INSERT TO public
  WITH CHECK (public.is_service_role());

DROP POLICY IF EXISTS "Admins can view security audit logs" ON public.security_audit_logs;

-- =============================================================================
-- Revoke TRUNCATE from anon/authenticated on public schema
-- =============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT quote_ident(schemaname) AS sn, quote_ident(tablename) AS tn
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE TRUNCATE ON TABLE %s.%s FROM anon, authenticated', r.sn, r.tn);
  END LOOP;
END $$;

-- =============================================================================
-- Service-role-only RLS policy audit (used by npm run security:rls)
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
      'career_applications', 'audience_suggestions', 'order_passes'
    ]) AS tablename
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
      AND (
        p.qual = 'true'
        OR p.with_check = 'true'
        OR p.qual ILIKE '%IS NULL%'
        OR p.with_check ILIKE '%IS NULL%'
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
