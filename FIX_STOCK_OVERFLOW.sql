-- ============================================
-- FIX STOCK OVERFLOW ISSUES
-- This script provides solutions to fix the overflow problems
-- ============================================

-- ============================================
-- STEP 1: Identify which orders to target
-- ============================================

-- Query: Find the most recent orders that caused overflow (for Zone A & B)
-- These are the orders you might want to reject if you choose Option 2
WITH order_sequence AS (
    SELECT 
        ep.id as pass_id,
        ep.name as pass_name,
        ep.max_quantity,
        o.id as order_id,
        o.status,
        op.quantity,
        o.created_at,
        SUM(op.quantity) OVER (
            PARTITION BY op.pass_id 
            ORDER BY o.created_at 
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) as running_total
    FROM public.order_passes op
    JOIN public.orders o ON o.id = op.order_id
    JOIN public.event_passes ep ON ep.id = op.pass_id
    WHERE op.pass_id IN (
        'cf1f8097-87c8-4136-8952-8897f56467e0', -- Zone A
        'c3b76e76-5481-466e-89e3-b44815d018f4'  -- Zone B
    )
        AND o.stock_released = false
        AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
        AND (
            o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED')
            OR o.status IN ('PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
        )
)
SELECT 
    pass_name,
    max_quantity,
    order_id,
    status,
    quantity,
    created_at,
    running_total,
    CASE 
        WHEN running_total > max_quantity THEN 
            CONCAT('OVERFLOW: This order pushed total to ', running_total, ' (exceeds max ', max_quantity, ' by ', running_total - max_quantity, ')')
        ELSE 'OK'
    END as overflow_info
FROM order_sequence
WHERE running_total > max_quantity
ORDER BY pass_name, created_at;

-- ============================================
-- OPTION 1: Increase max_quantity to match actual orders (RECOMMENDED)
-- ============================================
-- This honors all existing orders by increasing the stock limit

-- Step 1.1: Increase max_quantity for Zone A (from 50 to 51)
UPDATE public.event_passes 
SET max_quantity = 51 
WHERE id = 'cf1f8097-87c8-4136-8952-8897f56467e0';

-- Step 1.2: Increase max_quantity for Zone B (from 35 to 37)
UPDATE public.event_passes 
SET max_quantity = 37 
WHERE id = 'c3b76e76-5481-466e-89e3-b44815d018f4';

-- Step 1.3: Now recalculate sold_quantity (this will work now that max_quantity is increased)
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Reset all sold_quantity to 0
    UPDATE public.event_passes
    SET sold_quantity = 0;
    
    -- Recalculate sold_quantity correctly
    WITH pass_sales AS (
        SELECT 
            op.pass_id,
            SUM(op.quantity) as total_sold
        FROM public.order_passes op
        JOIN public.orders o ON o.id = op.order_id
        WHERE op.pass_id IS NOT NULL
          AND o.stock_released = false
          AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
          AND (
            o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED')
            OR o.status IN ('PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
          )
        GROUP BY op.pass_id
    )
    UPDATE public.event_passes
    SET sold_quantity = COALESCE(ps.total_sold, 0)
    FROM pass_sales ps
    WHERE public.event_passes.id = ps.pass_id;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Recalculated sold_quantity for % passes', updated_count;
END $$;

-- ============================================
-- OPTION 2: Reject most recent orders to bring under limit
-- ============================================
-- Use this if you DON'T want to increase max_quantity
-- WARNING: This will reject actual orders - use with caution!

-- Step 2.1: Find orders to reject (most recent PENDING_CASH orders)
-- Run this first to see which orders will be rejected:
/*
WITH order_sequence AS (
    SELECT 
        ep.id as pass_id,
        ep.name as pass_name,
        ep.max_quantity,
        o.id as order_id,
        o.status,
        op.quantity,
        o.created_at,
        SUM(op.quantity) OVER (
            PARTITION BY op.pass_id 
            ORDER BY o.created_at DESC
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) as running_total_from_end
    FROM public.order_passes op
    JOIN public.orders o ON o.id = op.order_id
    JOIN public.event_passes ep ON ep.id = op.pass_id
    WHERE op.pass_id IN (
        'cf1f8097-87c8-4136-8952-8897f56467e0', -- Zone A (need to remove 1)
        'c3b76e76-5481-466e-89e3-b44815d018f4'  -- Zone B (need to remove 2)
    )
        AND o.stock_released = false
        AND o.status = 'PENDING_CASH'  -- Only target pending orders
        AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
    ORDER BY op.pass_id, o.created_at DESC
)
SELECT 
    pass_name,
    order_id,
    status,
    quantity,
    created_at,
    'Will be rejected to fix overflow' as action
FROM order_sequence
WHERE pass_id = 'cf1f8097-87c8-4136-8952-8897f56467e0'  -- Zone A
    AND running_total_from_end <= 1  -- Most recent 1 order
UNION ALL
SELECT 
    pass_name,
    order_id,
    status,
    quantity,
    created_at,
    'Will be rejected to fix overflow' as action
FROM order_sequence
WHERE pass_id = 'c3b76e76-5481-466e-89e3-b44815d018f4'  -- Zone B
    AND running_total_from_end <= 2  -- Most recent 2 orders
ORDER BY pass_name, created_at DESC;
*/

-- Step 2.2: Actually reject the orders (UNCOMMENT TO USE - BE CAREFUL!)
/*
-- Reject 1 most recent PENDING_CASH order for Zone A
UPDATE public.orders
SET 
    status = 'REJECTED',
    rejected_at = NOW(),
    stock_released = true
WHERE id IN (
    SELECT o.id
    FROM public.order_passes op
    JOIN public.orders o ON o.id = op.order_id
    WHERE op.pass_id = 'cf1f8097-87c8-4136-8952-8897f56467e0'
        AND o.status = 'PENDING_CASH'
        AND o.stock_released = false
    ORDER BY o.created_at DESC
    LIMIT 1
);

-- Reject 2 most recent PENDING_CASH orders for Zone B
UPDATE public.orders
SET 
    status = 'REJECTED',
    rejected_at = NOW(),
    stock_released = true
WHERE id IN (
    SELECT o.id
    FROM public.order_passes op
    JOIN public.orders o ON o.id = op.order_id
    WHERE op.pass_id = 'c3b76e76-5481-466e-89e3-b44815d018f4'
        AND o.status = 'PENDING_CASH'
        AND o.stock_released = false
    ORDER BY o.created_at DESC
    LIMIT 2
);

-- Then recalculate sold_quantity
-- (Use the recalculation code from Option 1, Step 1.3)
*/

-- ============================================
-- OPTION 3: Fix Zone C sync issue (stored 87, should be 83)
-- ============================================
-- Zone C doesn't have overflow, just needs recalculation

-- This will be fixed automatically when you run the recalculation in Option 1, Step 1.3
-- Or run it separately:
/*
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    WITH pass_sales AS (
        SELECT 
            op.pass_id,
            SUM(op.quantity) as total_sold
        FROM public.order_passes op
        JOIN public.orders o ON o.id = op.order_id
        WHERE op.pass_id = 'c3f4b3d4-ae89-4dfd-91f7-76f5bd0c3b57'  -- Zone C
          AND o.stock_released = false
          AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
          AND (
            o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED')
            OR o.status IN ('PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
          )
        GROUP BY op.pass_id
    )
    UPDATE public.event_passes
    SET sold_quantity = COALESCE(ps.total_sold, 0)
    FROM pass_sales ps
    WHERE public.event_passes.id = ps.pass_id;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated Zone C sold_quantity';
END $$;
*/

-- ============================================
-- VERIFICATION: Check results after fix
-- ============================================
-- Run this after applying Option 1 to verify everything is fixed

SELECT 
    ep.id as pass_id,
    ep.name as pass_name,
    ep.max_quantity,
    ep.sold_quantity as stored_sold_quantity,
    COALESCE(SUM(CASE 
        WHEN o.stock_released = false
            AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
            AND (
                o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED')
                OR o.status IN ('PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
            )
        THEN op.quantity 
        ELSE 0 
    END), 0) as calculated_sold_quantity,
    ep.max_quantity - ep.sold_quantity as remaining_stock,
    CASE 
        WHEN ep.sold_quantity = COALESCE(SUM(CASE 
            WHEN o.stock_released = false
                AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
                AND (
                    o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED')
                    OR o.status IN ('PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
                )
            THEN op.quantity 
            ELSE 0 
        END), 0) THEN '✅ FIXED'
        WHEN ep.sold_quantity > ep.max_quantity THEN '⚠️ STILL OVERFLOW'
        ELSE '⚠️ STILL OUT OF SYNC'
    END as status
FROM public.event_passes ep
LEFT JOIN public.order_passes op ON op.pass_id = ep.id
LEFT JOIN public.orders o ON o.id = op.order_id
WHERE ep.id IN (
    'cf1f8097-87c8-4136-8952-8897f56467e0', -- Zone A
    'c3b76e76-5481-466e-89e3-b44815d018f4', -- Zone B
    'c3f4b3d4-ae89-4dfd-91f7-76f5bd0c3b57'  -- Zone C
)
GROUP BY ep.id, ep.name, ep.max_quantity, ep.sold_quantity
ORDER BY ep.name;
