-- Align DB function with app default: expire PENDING_ONLINE after 17 minutes (HTTP cron uses same default via code/env).

CREATE OR REPLACE FUNCTION public.auto_fail_expired_pending_online_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  expired_order RECORD;
  timeout_cutoff TIMESTAMPTZ;
BEGIN
  timeout_cutoff := NOW() - INTERVAL '17 minutes';

  FOR expired_order IN
    SELECT id, stock_released
    FROM public.orders
    WHERE source = 'platform_online'
      AND status = 'PENDING_ONLINE'
      AND created_at < timeout_cutoff
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      IF COALESCE(expired_order.stock_released, false) = false THEN
        PERFORM release_order_stock_internal(expired_order.id);
      END IF;

      UPDATE public.orders
      SET
        status = 'EXPIRED',
        payment_status = 'EXPIRED',
        updated_at = NOW()
      WHERE id = expired_order.id
        AND status = 'PENDING_ONLINE';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error auto-failing PENDING_ONLINE order %: %', expired_order.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.auto_fail_expired_pending_online_orders() IS
  'Fails PENDING_ONLINE orders older than 17 minutes, releases stock, sets status/payment_status=EXPIRED. Run via cron (e.g. every 5 min).';
