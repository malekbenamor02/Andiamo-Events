-- Auto-cancel stale Academy card registrations (pending_payment / pending_online).
-- Primary execution is via HTTP cron: /api/auto-cancel-expired-academy-registrations
-- (see api/_lib/academy-expire-pending.cjs). This function is optional for pg_cron.

CREATE OR REPLACE FUNCTION public.auto_cancel_expired_academy_pending_registrations(
  expire_minutes integer DEFAULT 17
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff timestamptz;
  reg record;
  cancelled_count integer := 0;
  reason text;
BEGIN
  cutoff := NOW() - (GREATEST(1, expire_minutes) || ' minutes')::interval;
  reason := 'Auto-cancelled after ' || GREATEST(1, expire_minutes) || ' minutes without online card payment confirmation';

  FOR reg IN
    SELECT id, status, promo_code_id
    FROM public.academy_registrations
    WHERE payment_method = 'card'
      AND status IN ('pending_payment', 'pending_online')
      AND created_at < cutoff
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.academy_registrations
    SET
      status = 'cancelled',
      rejection_reason = reason,
      updated_at = NOW()
    WHERE id = reg.id
      AND payment_method = 'card'
      AND status IN ('pending_payment', 'pending_online');

    IF FOUND THEN
      IF reg.promo_code_id IS NOT NULL THEN
        UPDATE public.academy_promo_codes
        SET used_count = GREATEST(0, used_count - 1), updated_at = NOW()
        WHERE id = reg.promo_code_id AND used_count > 0;
      END IF;

      INSERT INTO public.academy_registration_logs (
        registration_id, event_type, old_status, new_status, notes
      ) VALUES (
        reg.id, 'auto_cancelled', reg.status, 'cancelled', reason
      );

      cancelled_count := cancelled_count + 1;
    END IF;
  END LOOP;

  RETURN cancelled_count;
END;
$$;

COMMENT ON FUNCTION public.auto_cancel_expired_academy_pending_registrations(integer) IS
  'Cancels card academy registrations stuck in pending_payment/pending_online past expire_minutes (default 17). Prefer HTTP cron endpoint.';

GRANT EXECUTE ON FUNCTION public.auto_cancel_expired_academy_pending_registrations(integer) TO service_role;
