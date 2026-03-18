-- Auto-fail expired PENDING_ONLINE orders and release their stock.
-- Runs on cron (e.g. every 5 min). No ambassador/cash logic.
-- Fix: fail ALL old PENDING_ONLINE orders (even if stock_released is already true)
-- so none stay stuck as "pending".

CREATE OR REPLACE FUNCTION public.auto_fail_expired_pending_online_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  expired_order RECORD;
  timeout_cutoff TIMESTAMPTZ;
BEGIN
  -- Online payment timeout: e.g. 30 minutes (change as needed)
  timeout_cutoff := NOW() - INTERVAL '30 minutes';

  FOR expired_order IN
    SELECT id, stock_released
    FROM public.orders
    WHERE source = 'platform_online'
      AND status = 'PENDING_ONLINE'
      AND created_at < timeout_cutoff
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      -- Release stock only if not already released (release_order_stock_internal is idempotent)
      IF COALESCE(expired_order.stock_released, false) = false THEN
        PERFORM release_order_stock_internal(expired_order.id);
      END IF;

      -- Always mark as EXPIRED so order never stays pending
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
  'Fails PENDING_ONLINE orders older than 30 minutes, releases stock, sets status/payment_status=EXPIRED. Run via cron every 5 min.';

GRANT EXECUTE ON FUNCTION public.auto_fail_expired_pending_online_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_fail_expired_pending_online_orders() TO service_role;
