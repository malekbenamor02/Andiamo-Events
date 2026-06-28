-- Revoke client EXECUTE on maintenance / stock RPCs (F-001, F-009 partial).
-- pg_cron and service_role retain access. Idempotent: safe to re-run.

DO $$
DECLARE
  r RECORD;
  maintenance_funcs text[] := ARRAY[
    'release_order_stock_internal(uuid)',
    'auto_fail_expired_pending_online_orders()',
    'auto_reject_expired_pending_cash_orders()',
    'apply_expiration_to_existing_pending_cash_orders()',
    'clear_expiration_from_existing_pending_cash_orders()',
    'verify_stock_calculations()',
    'cleanup_old_credentials()'
  ];
  sig text;
BEGIN
  FOREACH sig IN ARRAY maintenance_funcs LOOP
    IF to_regprocedure('public.' || sig) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated',
        sig
      );
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.%s TO service_role',
        sig
      );
      RAISE NOTICE 'Revoked client EXECUTE on public.%', sig;
    ELSE
      RAISE NOTICE 'Skip public.% (function not present)', sig;
    END IF;
  END LOOP;
END $$;
