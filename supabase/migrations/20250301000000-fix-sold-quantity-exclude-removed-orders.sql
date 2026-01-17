-- Fix sold_quantity calculation to exclude REMOVED_BY_ADMIN, REJECTED, and CANCELLED orders
-- This ensures stock counts match across all views in the application
--
-- PRODUCTION-SAFE MIGRATION:
-- - Recalculates sold_quantity correctly
-- - Excludes orders that should not count toward stock
-- - Idempotent: safe to run multiple times
--
-- Date: 2025-03-01
-- Issue: sold_quantity was counting REMOVED_BY_ADMIN orders, causing discrepancies

-- ============================================
-- STEP 1: Recalculate sold_quantity correctly
-- ============================================

-- Recalculate sold_quantity for all passes, excluding:
-- - REMOVED_BY_ADMIN orders (should have stock_released = true)
-- - REJECTED orders (should have stock_released = true)
-- - CANCELLED orders (should have stock_released = true)
-- 
-- Only count:
-- - PAID, COMPLETED, MANUAL_COMPLETED orders (always count)
-- - PENDING_CASH, PENDING_ONLINE, MANUAL_ACCEPTED orders where stock_released = false (reserved stock)

DO $$
DECLARE
    updated_count INTEGER;
    total_passes INTEGER;
    passes_with_stock INTEGER;
BEGIN
    -- First, reset all sold_quantity to 0
    UPDATE public.event_passes
    SET sold_quantity = 0;
    
    GET DIAGNOSTICS total_passes = ROW_COUNT;
    RAISE NOTICE 'Reset sold_quantity to 0 for % passes', total_passes;
    
    -- Recalculate sold_quantity correctly
    -- CRITICAL: Only count orders where stock has NOT been released
    -- This ensures that rejected, cancelled, expired, and removed orders are excluded
    WITH pass_sales AS (
        SELECT 
            op.pass_id,
            SUM(op.quantity) as total_sold
        FROM public.order_passes op
        JOIN public.orders o ON o.id = op.order_id
        WHERE op.pass_id IS NOT NULL
          -- CRITICAL: Never count orders where stock has been released
          AND o.stock_released = false
          -- Exclude orders that should not count toward stock (defensive check)
          AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
          -- Only count orders that represent actual sold/reserved stock
          AND (
            -- Completed/paid orders (always count if stock not released)
            o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED')
            -- Pending orders that haven't released stock (reserved stock)
            OR o.status IN ('PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
          )
        GROUP BY op.pass_id
    )
    UPDATE public.event_passes
    SET sold_quantity = COALESCE(ps.total_sold, 0)
    FROM pass_sales ps
    WHERE public.event_passes.id = ps.pass_id;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Count passes that have stock
    SELECT COUNT(*) INTO passes_with_stock
    FROM public.event_passes
    WHERE sold_quantity > 0;
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Stock Recalculation Complete';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Total passes: %', total_passes;
    RAISE NOTICE 'Passes with stock: %', passes_with_stock;
    RAISE NOTICE 'Updated sold_quantity for % passes', updated_count;
    RAISE NOTICE '============================================';
END $$;

-- ============================================
-- STEP 2: Create verification function
-- ============================================

-- Function to verify stock calculations are correct
CREATE OR REPLACE FUNCTION verify_stock_calculations()
RETURNS TABLE(
    pass_id UUID,
    pass_name TEXT,
    max_quantity INTEGER,
    current_sold_quantity INTEGER,
    calculated_sold_quantity BIGINT,
    discrepancy INTEGER,
    status_breakdown JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH pass_calculations AS (
        SELECT 
            ep.id as pass_id,
            ep.name as pass_name,
            ep.max_quantity,
            ep.sold_quantity as current_sold_quantity,
            -- Calculate what sold_quantity SHOULD be
            -- CRITICAL: Only count orders where stock_released = false
            COALESCE(SUM(
                CASE 
                    WHEN o.stock_released = false
                        AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
                        AND (
                            o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED')
                            OR o.status IN ('PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
                        )
                    THEN op.quantity
                    ELSE 0
                END
            ), 0) as calculated_sold_quantity
        FROM public.event_passes ep
        LEFT JOIN public.order_passes op ON op.pass_id = ep.id
        LEFT JOIN public.orders o ON o.id = op.order_id
        GROUP BY ep.id, ep.name, ep.max_quantity, ep.sold_quantity
    ),
    status_breakdowns AS (
        SELECT 
            status_totals.pass_id,
            jsonb_object_agg(
                status_totals.status::TEXT, 
                status_totals.total_quantity::BIGINT
            ) as status_breakdown
        FROM (
            SELECT 
                op.pass_id,
                o.status,
                SUM(op.quantity) as total_quantity
            FROM public.order_passes op
            JOIN public.orders o ON o.id = op.order_id
            WHERE op.pass_id IS NOT NULL
              AND o.status IS NOT NULL
            GROUP BY op.pass_id, o.status
        ) status_totals
        GROUP BY status_totals.pass_id
    )
    SELECT 
        pc.pass_id,
        pc.pass_name,
        pc.max_quantity,
        pc.current_sold_quantity::INTEGER,
        pc.calculated_sold_quantity,
        (pc.current_sold_quantity - pc.calculated_sold_quantity)::INTEGER as discrepancy,
        COALESCE(sb.status_breakdown, '{}'::jsonb) as status_breakdown
    FROM pass_calculations pc
    LEFT JOIN status_breakdowns sb ON sb.pass_id = pc.pass_id
    WHERE pc.current_sold_quantity != pc.calculated_sold_quantity
       OR pc.current_sold_quantity > 0
    ORDER BY ABS(pc.current_sold_quantity - pc.calculated_sold_quantity) DESC, pc.pass_name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION verify_stock_calculations() IS 'Verifies that sold_quantity matches actual order counts. Returns passes with discrepancies or passes that have stock. Use this to verify stock calculations are correct.';

-- ============================================
-- STEP 3: Grant permissions
-- ============================================

GRANT EXECUTE ON FUNCTION verify_stock_calculations() TO authenticated;
GRANT EXECUTE ON FUNCTION verify_stock_calculations() TO service_role;

-- ============================================
-- STEP 4: Run verification and log results
-- ============================================

DO $$
DECLARE
    verification_results RECORD;
    discrepancy_count INTEGER := 0;
    total_checked INTEGER := 0;
BEGIN
    -- Check for discrepancies
    FOR verification_results IN 
        SELECT * FROM verify_stock_calculations()
    LOOP
        total_checked := total_checked + 1;
        
        IF verification_results.discrepancy != 0 THEN
            discrepancy_count := discrepancy_count + 1;
            RAISE WARNING 'Discrepancy found for pass "%" (ID: %): Current: %, Calculated: %, Difference: %', 
                verification_results.pass_name,
                verification_results.pass_id,
                verification_results.current_sold_quantity,
                verification_results.calculated_sold_quantity,
                verification_results.discrepancy;
        END IF;
    END LOOP;
    
    IF discrepancy_count = 0 THEN
        RAISE NOTICE '✅ Stock verification passed: All % passes have correct sold_quantity', total_checked;
    ELSE
        RAISE WARNING '⚠️ Stock verification found % discrepancies out of % passes checked', discrepancy_count, total_checked;
        RAISE NOTICE 'Run SELECT * FROM verify_stock_calculations() WHERE discrepancy != 0; to see details';
    END IF;
END $$;
