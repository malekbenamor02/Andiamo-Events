-- Quick fix for the specific problematic order
-- Order ID: 59cd3891-3673-4366-9f47-c0944fb6bdf6
-- Status: REMOVED_BY_ADMIN
-- Issue: stock_released = false, should be true

-- Step 1: Check if order_passes has pass_id
SELECT 
    op.id,
    op.order_id,
    op.pass_id,
    op.pass_type,
    op.quantity
FROM order_passes op
WHERE op.order_id = '59cd3891-3673-4366-9f47-c0944fb6bdf6';

-- Step 2: Fix the order (run this after checking step 1)
DO $$
DECLARE
    order_id_to_fix UUID := '59cd3891-3673-4366-9f47-c0944fb6bdf6';
    pass_id_found UUID;
    quantity_to_release INTEGER;
    current_sold INTEGER;
BEGIN
    -- First, check if order_passes has pass_id
    SELECT op.pass_id, op.quantity
    INTO pass_id_found, quantity_to_release
    FROM order_passes op
    WHERE op.order_id = order_id_to_fix
      AND op.pass_id IS NOT NULL
    LIMIT 1;
    
    IF pass_id_found IS NULL THEN
        RAISE NOTICE '⚠️ Order % has no pass_id in order_passes. Trying to find pass by pass_type...', order_id_to_fix;
        
        -- Try to find pass_id by matching pass_type to event_passes.name
        SELECT ep.id, op.quantity
        INTO pass_id_found, quantity_to_release
        FROM order_passes op
        JOIN orders o ON o.id = op.order_id
        JOIN event_passes ep ON ep.name = op.pass_type AND ep.event_id = o.event_id
        WHERE op.order_id = order_id_to_fix
        LIMIT 1;
        
        IF pass_id_found IS NULL THEN
            RAISE WARNING '❌ Cannot find pass_id for order %. Cannot release stock automatically.', order_id_to_fix;
            RAISE NOTICE 'You may need to manually update the order_passes table to set pass_id.';
            RETURN;
        ELSE
            RAISE NOTICE '✅ Found pass_id % by matching pass_type', pass_id_found;
        END IF;
    END IF;
    
    -- Set stock_released flag
    UPDATE orders
    SET stock_released = true
    WHERE id = order_id_to_fix
      AND stock_released = false;
    
    IF NOT FOUND THEN
        RAISE NOTICE '⚠️ Order % already has stock_released = true or order not found', order_id_to_fix;
        RETURN;
    END IF;
    
    -- Get current sold_quantity
    SELECT sold_quantity INTO current_sold
    FROM event_passes
    WHERE id = pass_id_found;
    
    -- Decrement sold_quantity
    UPDATE event_passes
    SET sold_quantity = GREATEST(0, sold_quantity - quantity_to_release)
    WHERE id = pass_id_found
      AND sold_quantity >= quantity_to_release;
    
    IF FOUND THEN
        RAISE NOTICE '✅ Stock released successfully!';
        RAISE NOTICE '   Order ID: %', order_id_to_fix;
        RAISE NOTICE '   Pass ID: %', pass_id_found;
        RAISE NOTICE '   Quantity released: %', quantity_to_release;
        RAISE NOTICE '   Previous sold_quantity: %', current_sold;
        RAISE NOTICE '   New sold_quantity: %', (current_sold - quantity_to_release);
    ELSE
        RAISE WARNING '⚠️ Could not decrement sold_quantity (may be less than quantity to release)';
    END IF;
    
    -- Log the fix
    INSERT INTO order_logs (
        order_id,
        action,
        performed_by,
        performed_by_type,
        details
    ) VALUES (
        order_id_to_fix,
        'stock_released',
        NULL,
        'system',
        jsonb_build_object(
            'reason', 'Manual fix for missing stock release',
            'pass_id', pass_id_found,
            'quantity', quantity_to_release,
            'fixed_at', NOW()
        )
    );
    
    RAISE NOTICE '✅ Stock release logged in order_logs';
    
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ Error fixing order %: %', order_id_to_fix, SQLERRM;
END $$;

-- Step 3: Verify the fix
SELECT 
    o.id,
    o.status,
    o.stock_released,
    COUNT(op.id) as pass_count
FROM orders o
LEFT JOIN order_passes op ON op.order_id = o.id
WHERE o.id = '59cd3891-3673-4366-9f47-c0944fb6bdf6'
GROUP BY o.id, o.status, o.stock_released;

-- Should show stock_released = true
