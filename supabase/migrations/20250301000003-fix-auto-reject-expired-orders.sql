-- Fix auto_reject_expired_pending_cash_orders() function
-- Ensures it uses the enhanced release_order_stock_internal() with pass_type fallback
-- Adds better error handling and ensures status is actually updated
--
-- PRODUCTION-SAFE MIGRATION:
-- - Fixes the auto-reject function to work correctly
-- - Ensures stock is released even if pass_id is NULL
-- - Adds better logging and error handling
-- - Idempotent: safe to run multiple times
--
-- Date: 2025-03-01
-- Issue: Manual reject button shows success but orders don't change status and stock doesn't return

-- ============================================
-- STEP 1: Recreate auto_reject_expired_pending_cash_orders() with fixes
-- ============================================

CREATE OR REPLACE FUNCTION auto_reject_expired_pending_cash_orders()
RETURNS TABLE(
  rejected_count INTEGER,
  rejected_order_ids UUID[]
) AS $$
DECLARE
  expired_order RECORD;
  rejected_ids UUID[] := ARRAY[]::UUID[];
  rejected_total INTEGER := 0;
  stock_released BOOLEAN;
  update_count INTEGER;
BEGIN
  -- Find all expired PENDING_CASH orders that haven't been rejected yet
  -- CRITICAL: Check multiple conditions to ensure we catch all expired orders
  FOR expired_order IN
    SELECT 
      id,
      expires_at,
      created_at,
      status,
      stock_released as current_stock_released
    FROM public.orders
    WHERE status = 'PENDING_CASH'
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
      AND rejected_at IS NULL
    ORDER BY expires_at ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      -- CRITICAL: Release stock first (before status change)
      -- This uses the enhanced version with pass_type fallback
      SELECT release_order_stock_internal(expired_order.id) INTO stock_released;
      
      IF NOT stock_released THEN
        -- If stock release failed, log warning but continue
        -- The trigger will catch it as a safety net
        RAISE WARNING 'Stock release failed for order % (may already be released or pass_id missing)', expired_order.id;
      END IF;
      
      -- Update order to REJECTED status
      -- CRITICAL: Use explicit WHERE clause to ensure we only update if still PENDING_CASH
      UPDATE public.orders
      SET 
        status = 'REJECTED',
        rejected_at = NOW(),
        rejection_reason = 'Order expired automatically (expiration time reached)',
        updated_at = NOW()
      WHERE id = expired_order.id
        AND status = 'PENDING_CASH';  -- Double-check status hasn't changed
      
      GET DIAGNOSTICS update_count = ROW_COUNT;
      
      -- Only count if status was actually updated
      IF update_count > 0 THEN
        rejected_ids := array_append(rejected_ids, expired_order.id);
        rejected_total := rejected_total + 1;
        
        -- Log the auto-rejection
        BEGIN
          INSERT INTO public.order_logs (
            order_id,
            action,
            performed_by,
            performed_by_type,
            details
          ) VALUES (
            expired_order.id,
            'auto_rejected_expired',
            NULL,
            'system',
            jsonb_build_object(
              'reason', 'Order expired automatically',
              'expires_at', expired_order.expires_at,
              'created_at', expired_order.created_at,
              'stock_released', stock_released,
              'previous_stock_released', expired_order.current_stock_released,
              'auto_action', true,
              'rejected_at', NOW()
            )
          );
        EXCEPTION WHEN OTHERS THEN
          -- Log error but don't fail the rejection
          RAISE WARNING 'Failed to log rejection for order %: %', expired_order.id, SQLERRM;
        END;
        
        RAISE NOTICE 'Auto-rejected expired order % (expired at %, stock_released: %)', 
          expired_order.id, expired_order.expires_at, stock_released;
      ELSE
        -- Status update failed - order may have been changed by another process
        RAISE WARNING 'Failed to update status for order % (may have been changed by another process)', expired_order.id;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue with other orders
      RAISE WARNING 'Error auto-rejecting order %: %', expired_order.id, SQLERRM;
      -- Try to log the error
      BEGIN
        INSERT INTO public.order_logs (
          order_id,
          action,
          performed_by,
          performed_by_type,
          details
        ) VALUES (
          expired_order.id,
          'auto_reject_error',
          NULL,
          'system',
          jsonb_build_object(
            'error', SQLERRM,
            'expires_at', expired_order.expires_at,
            'attempted_at', NOW()
          )
        );
      EXCEPTION WHEN OTHERS THEN
        -- Ignore logging errors
        NULL;
      END;
    END;
  END LOOP;
  
  -- Log summary
  IF rejected_total > 0 THEN
    RAISE NOTICE 'Auto-rejection completed: % order(s) rejected', rejected_total;
  ELSE
    RAISE NOTICE 'Auto-rejection completed: No expired orders found';
  END IF;
  
  RETURN QUERY SELECT rejected_total, rejected_ids;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_reject_expired_pending_cash_orders() IS 'Automatically rejects expired PENDING_CASH orders. Uses enhanced release_order_stock_internal() with pass_type fallback. Releases stock before updating status. Returns count and IDs of rejected orders.';

-- ============================================
-- STEP 2: Grant execute permissions
-- ============================================

GRANT EXECUTE ON FUNCTION auto_reject_expired_pending_cash_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION auto_reject_expired_pending_cash_orders() TO service_role;

-- ============================================
-- STEP 3: Verify the enhanced release_order_stock_internal() exists
-- ============================================

-- This should already exist from migration 20250301000002, but verify
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'release_order_stock_internal'
      AND pg_get_function_arguments(p.oid) = 'order_id_param uuid'
  ) THEN
    RAISE EXCEPTION 'release_order_stock_internal() function not found. Please run migration 20250301000002-enhance-stock-release-with-fallback.sql first.';
  END IF;
  
  RAISE NOTICE '✓ Verified release_order_stock_internal() function exists';
END $$;

-- ============================================
-- STEP 4: Log migration completion
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Auto-Reject Expired Orders Fix Complete';
  RAISE NOTICE '============================================';
  RAISE NOTICE '✓ Fixed auto_reject_expired_pending_cash_orders() function';
  RAISE NOTICE '✓ Uses enhanced release_order_stock_internal() with pass_type fallback';
  RAISE NOTICE '✓ Added better error handling and logging';
  RAISE NOTICE '✓ Ensures status is actually updated before counting';
  RAISE NOTICE '============================================';
END $$;
