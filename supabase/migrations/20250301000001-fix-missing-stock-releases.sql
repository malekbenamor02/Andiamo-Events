-- Fix orders that should have stock released but don't
-- This handles edge cases where stock release failed or was missed
--
-- PRODUCTION-SAFE MIGRATION:
-- - Finds orders that should have stock released
-- - Releases stock for those orders
-- - Idempotent: safe to run multiple times
--
-- Date: 2025-03-01
-- Issue: Some REMOVED_BY_ADMIN/REJECTED/CANCELLED orders have stock_released = false

-- ============================================
-- STEP 1: Find orders that need stock release
-- ============================================

DO $$
DECLARE
    problematic_orders RECORD;
    fixed_count INTEGER := 0;
    total_problematic INTEGER := 0;
BEGIN
    -- Find orders that should have stock released but don't
    -- Include orders even if pass_id is NULL (will try to match by pass_type)
    FOR problematic_orders IN
        SELECT DISTINCT
            o.id as order_id,
            o.status,
            o.stock_released,
            o.event_id
        FROM orders o
        JOIN order_passes op ON op.order_id = o.id
        WHERE o.status IN (
            'REMOVED_BY_ADMIN',
            'REJECTED',
            'CANCELLED',
            'CANCELLED_BY_AMBASSADOR',
            'CANCELLED_BY_ADMIN',
            'REFUNDED'
        )
          AND o.stock_released = false
        GROUP BY o.id, o.status, o.stock_released, o.event_id
    LOOP
        total_problematic := total_problematic + 1;
        
        RAISE NOTICE 'Found problematic order: ID=%, Status=%', 
            problematic_orders.order_id,
            problematic_orders.status;
        
        -- Release stock for this order
        BEGIN
            -- Set stock_released flag first
            UPDATE orders
            SET stock_released = true
            WHERE id = problematic_orders.order_id
              AND stock_released = false;
            
            IF NOT FOUND THEN
                RAISE NOTICE '⚠️ Order % already has stock_released = true, skipping', problematic_orders.order_id;
                CONTINUE;
            END IF;
            
            -- Decrement sold_quantity for each pass
            -- First try with pass_id (if available)
            UPDATE event_passes ep
            SET sold_quantity = GREATEST(0, sold_quantity - op.quantity)
            FROM order_passes op
            WHERE op.order_id = problematic_orders.order_id
              AND op.pass_id = ep.id
              AND op.pass_id IS NOT NULL
              AND ep.sold_quantity >= op.quantity;
            
            -- If no rows updated and pass_id is NULL, try matching by pass_type
            IF NOT FOUND THEN
                RAISE NOTICE '   Trying to match by pass_type for order %...', problematic_orders.order_id;
                
                UPDATE event_passes ep
                SET sold_quantity = GREATEST(0, sold_quantity - op.quantity)
                FROM order_passes op
                JOIN orders o ON o.id = op.order_id
                WHERE op.order_id = problematic_orders.order_id
                  AND op.pass_id IS NULL
                  AND ep.name = op.pass_type
                  AND ep.event_id = o.event_id
                  AND ep.sold_quantity >= op.quantity;
                
                IF FOUND THEN
                    RAISE NOTICE '   ✅ Matched by pass_type and released stock';
                ELSE
                    RAISE WARNING '   ⚠️ Could not find matching pass for order % (pass_type may not match any event_pass)', problematic_orders.order_id;
                END IF;
            END IF;
            
            fixed_count := fixed_count + 1;
            
            RAISE NOTICE '✅ Fixed order %: Released stock', problematic_orders.order_id;
                
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '❌ Failed to fix order %: %', 
                problematic_orders.order_id,
                SQLERRM;
        END;
    END LOOP;
    
    IF total_problematic = 0 THEN
        RAISE NOTICE '✅ No problematic orders found - all stock releases are correct!';
    ELSE
        RAISE NOTICE '============================================';
        RAISE NOTICE 'Stock Release Fix Complete';
        RAISE NOTICE '============================================';
        RAISE NOTICE 'Total problematic orders found: %', total_problematic;
        RAISE NOTICE 'Successfully fixed: %', fixed_count;
        RAISE NOTICE 'Failed to fix: %', (total_problematic - fixed_count);
        RAISE NOTICE '============================================';
    END IF;
END $$;

-- ============================================
-- STEP 2: Verify all orders are fixed
-- ============================================

DO $$
DECLARE
    remaining_problematic INTEGER;
BEGIN
    SELECT COUNT(DISTINCT o.id) INTO remaining_problematic
    FROM orders o
    WHERE o.status IN (
        'REMOVED_BY_ADMIN',
        'REJECTED',
        'CANCELLED',
        'CANCELLED_BY_AMBASSADOR',
        'CANCELLED_BY_ADMIN',
        'REFUNDED'
    )
      AND o.stock_released = false;
    
    IF remaining_problematic = 0 THEN
        RAISE NOTICE '✅ Verification passed: All orders have stock properly released!';
    ELSE
        RAISE WARNING '⚠️ Verification found % orders still need stock release', remaining_problematic;
        RAISE NOTICE 'Run this query to see which orders still need fixing:';
        RAISE NOTICE 'SELECT id, status, stock_released FROM orders WHERE status IN (''REMOVED_BY_ADMIN'', ''REJECTED'', ''CANCELLED'', ''CANCELLED_BY_AMBASSADOR'', ''CANCELLED_BY_ADMIN'', ''REFUNDED'') AND stock_released = false;';
    END IF;
END $$;
