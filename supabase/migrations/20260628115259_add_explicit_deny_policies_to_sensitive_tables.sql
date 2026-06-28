-- Explicit deny-all policies on service-role-only tables (F-005).
-- Documents intent; behavior unchanged from RLS-with-no-policies default deny.
-- Idempotent: safe to re-run.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'academy_influencers',
    'academy_promo_codes',
    'academy_registration_logs',
    'academy_registrations',
    'academy_settings',
    'ambassador_sessions',
    'career_application_logs',
    'career_form_template_fields',
    'career_form_templates',
    'event_promo_attempts',
    'event_promo_code_pass_discounts',
    'event_promo_code_passes',
    'event_promo_codes',
    'event_promo_order_create_rate',
    'event_promo_validate_rate',
    'pos_audit_log',
    'pos_outlets',
    'pos_pass_stock',
    'pos_users',
    'presale_code_attempts',
    'presale_code_pass_discounts',
    'presale_codes',
    'presale_redeem_rate',
    'presale_sessions',
    'scan_system_config',
    'users'
  ];
  pol_name text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'Skip public.% (table not present)', t;
      CONTINUE;
    END IF;

    pol_name := t || '_deny_all';

    IF EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = t
        AND policyname = pol_name
    ) THEN
      RAISE NOTICE 'Skip public.% (% already exists)', t, pol_name;
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = t
    ) THEN
      RAISE NOTICE 'Skip public.% (other policies exist)', t;
      CONTINUE;
    END IF;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO public USING (false) WITH CHECK (false)',
      pol_name,
      t
    );
    RAISE NOTICE 'Created % on public.%', pol_name, t;
  END LOOP;
END $$;
