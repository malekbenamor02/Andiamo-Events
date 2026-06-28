-- Tighten payment_options: anon/authenticated may SELECT enabled rows only (checkout).
-- Admin reads/writes use service-role API routes with settings:manage.
-- Idempotent: safe to re-run via Supabase migration flow.

DROP POLICY IF EXISTS "Public can view payment options" ON public.payment_options;
DROP POLICY IF EXISTS "payment_options_anon_select_enabled" ON public.payment_options;

CREATE POLICY "payment_options_anon_select_enabled"
  ON public.payment_options
  FOR SELECT
  TO anon, authenticated
  USING (enabled = true);

COMMENT ON POLICY "payment_options_anon_select_enabled" ON public.payment_options IS
  'Public checkout may read enabled payment options only; disabled rows and admin config via server API.';
