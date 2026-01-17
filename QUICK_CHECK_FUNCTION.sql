-- ============================================
-- QUICK CHECK: Verify Auto-Reject Function Setup
-- Run this to quickly diagnose the issue
-- ============================================

-- Check 1: Does the function exist?
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Function exists'
        ELSE '❌ Function does NOT exist - Run migration 20250301000003'
    END as function_status,
    COUNT(*) as function_count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'auto_reject_expired_pending_cash_orders';

-- Check 2: Does release_order_stock_internal exist? (Required dependency)
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Dependency exists'
        ELSE '❌ Dependency missing - Run migration 20250301000002 FIRST'
    END as dependency_status,
    COUNT(*) as dependency_count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'release_order_stock_internal'
  AND pg_get_function_arguments(p.oid) = 'order_id_param uuid';

-- Check 3: Does service_role have permission?
SELECT 
    CASE 
        WHEN has_function_privilege('service_role'::regrole, 'auto_reject_expired_pending_cash_orders()'::regprocedure, 'EXECUTE') 
        THEN '✅ service_role has permission'
        ELSE '❌ service_role missing permission - Run: GRANT EXECUTE ON FUNCTION auto_reject_expired_pending_cash_orders() TO service_role;'
    END as service_role_permission;

-- Check 4: Try to call the function (if it exists)
DO $$
DECLARE
    func_exists BOOLEAN;
    test_result RECORD;
BEGIN
    -- Check if function exists
    SELECT EXISTS (
        SELECT 1 
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'auto_reject_expired_pending_cash_orders'
    ) INTO func_exists;
    
    IF func_exists THEN
        BEGIN
            SELECT * INTO test_result FROM auto_reject_expired_pending_cash_orders() LIMIT 1;
            RAISE NOTICE '✅ Function call successful: rejected_count = %, rejected_order_ids = %', 
                test_result.rejected_count, 
                test_result.rejected_order_ids;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '❌ Function call failed: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE '⚠️ Function does not exist - cannot test';
    END IF;
END $$;

-- Check 5: How many expired orders exist?
SELECT 
    COUNT(*) as expired_orders_count,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Found expired orders to reject'
        ELSE 'ℹ️ No expired orders found (this is OK)'
    END as status
FROM public.orders
WHERE status = 'PENDING_CASH'
  AND expires_at IS NOT NULL
  AND expires_at < NOW()
  AND rejected_at IS NULL;
