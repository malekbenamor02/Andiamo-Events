-- ============================================
-- DETAILED STOCK ANALYSIS
-- Based on user's query results showing mismatches
-- ============================================

-- Analysis of the results:
-- Zone A: sold_quantity = 50, but PAID (38) + PENDING_CASH (13) = 51 (difference: -1)
-- Zone B: sold_quantity = 35, but PAID (32) + PENDING_CASH (5) = 37 (difference: -2)
-- Zone C: sold_quantity = 87, but PAID (70) + PENDING_CASH (13) = 83 (difference: +4)

-- Query 1: Find ALL order statuses for these specific passes
SELECT 
    ep.id as pass_id,
    ep.name as pass_name,
    ep.max_quantity,
    ep.sold_quantity as current_sold_quantity,
    o.status,
    COUNT(DISTINCT o.id) as order_count,
    SUM(op.quantity) as total_quantity,
    SUM(CASE WHEN o.stock_released = true THEN 1 ELSE 0 END) as orders_with_stock_released,
    SUM(CASE WHEN o.stock_released = true THEN op.quantity ELSE 0 END) as quantity_with_stock_released
FROM public.event_passes ep
LEFT JOIN public.order_passes op ON op.pass_id = ep.id
LEFT JOIN public.orders o ON o.id = op.order_id
WHERE ep.id IN (
    'cf1f8097-87c8-4136-8952-8897f56467e0', -- Zone A
    'c3b76e76-5481-466e-89e3-b44815d018f4', -- Zone B
    'c3f4b3d4-ae89-4dfd-91f7-76f5bd0c3b57'  -- Zone C
)
    AND op.pass_id IS NOT NULL
    AND o.status IS NOT NULL
GROUP BY ep.id, ep.name, ep.max_quantity, ep.sold_quantity, o.status
ORDER BY ep.name, o.status;

-- Query 2: Calculate expected vs actual for these passes
WITH pass_breakdown AS (
    SELECT 
        op.pass_id,
        ep.name as pass_name,
        ep.max_quantity,
        ep.sold_quantity as current_sold_quantity,
        -- PAID orders
        SUM(CASE 
            WHEN o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED') 
                AND o.stock_released = false 
            THEN op.quantity 
            ELSE 0 
        END) as paid_quantity,
        -- PENDING_CASH orders
        SUM(CASE 
            WHEN o.status = 'PENDING_CASH' 
                AND o.stock_released = false 
            THEN op.quantity 
            ELSE 0 
        END) as pending_cash_quantity,
        -- Other pending statuses (should NOT be counted per user expectation)
        SUM(CASE 
            WHEN o.status IN ('PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
                AND o.stock_released = false 
            THEN op.quantity 
            ELSE 0 
        END) as other_pending_quantity,
        -- Orders with stock_released = true (should NOT be counted)
        SUM(CASE 
            WHEN o.stock_released = true
                AND o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED', 'PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
            THEN op.quantity 
            ELSE 0 
        END) as released_stock_quantity,
        -- Total expected (PAID + PENDING_CASH only)
        SUM(CASE 
            WHEN (
                (o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED') AND o.stock_released = false)
                OR (o.status = 'PENDING_CASH' AND o.stock_released = false)
            )
            THEN op.quantity 
            ELSE 0 
        END) as expected_sold_quantity
    FROM public.order_passes op
    JOIN public.orders o ON o.id = op.order_id
    JOIN public.event_passes ep ON ep.id = op.pass_id
    WHERE op.pass_id IN (
        'cf1f8097-87c8-4136-8952-8897f56467e0', -- Zone A
        'c3b76e76-5481-466e-89e3-b44815d018f4', -- Zone B
        'c3f4b3d4-ae89-4dfd-91f7-76f5bd0c3b57'  -- Zone C
    )
        AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
    GROUP BY op.pass_id, ep.name, ep.max_quantity, ep.sold_quantity
)
SELECT 
    pass_id,
    pass_name,
    max_quantity,
    current_sold_quantity,
    paid_quantity,
    pending_cash_quantity,
    other_pending_quantity,
    released_stock_quantity,
    expected_sold_quantity,
    current_sold_quantity - expected_sold_quantity as difference,
    CASE 
        WHEN current_sold_quantity != expected_sold_quantity THEN 'MISMATCH'
        ELSE 'OK'
    END as status,
    -- Show what's causing the difference
    CASE 
        WHEN current_sold_quantity > expected_sold_quantity THEN 
            CONCAT('Sold quantity is HIGHER by ', current_sold_quantity - expected_sold_quantity, 
                   '. Likely includes: other_pending (', other_pending_quantity, 
                   ') or released_stock (', released_stock_quantity, ')')
        WHEN current_sold_quantity < expected_sold_quantity THEN 
            CONCAT('Sold quantity is LOWER by ', expected_sold_quantity - current_sold_quantity, 
                   '. Some orders may have stock_released=true or are in excluded statuses.')
        ELSE 'OK'
    END as explanation
FROM pass_breakdown
ORDER BY pass_name;

-- Query 3: Show individual orders that are causing the mismatch
-- This will help identify specific problematic orders
SELECT 
    ep.id as pass_id,
    ep.name as pass_name,
    o.id as order_id,
    o.status,
    o.stock_released,
    op.quantity,
    o.source,
    o.payment_method,
    o.created_at,
    CASE 
        WHEN o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED') AND o.stock_released = false THEN 'SHOULD COUNT'
        WHEN o.status = 'PENDING_CASH' AND o.stock_released = false THEN 'SHOULD COUNT'
        WHEN o.status IN ('PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION') AND o.stock_released = false THEN 'SHOULD NOT COUNT (other pending)'
        WHEN o.stock_released = true THEN 'SHOULD NOT COUNT (stock released)'
        ELSE 'SHOULD NOT COUNT (excluded status)'
    END as counting_status
FROM public.order_passes op
JOIN public.orders o ON o.id = op.order_id
JOIN public.event_passes ep ON ep.id = op.pass_id
WHERE op.pass_id IN (
    'cf1f8097-87c8-4136-8952-8897f56467e0', -- Zone A
    'c3b76e76-5481-466e-89e3-b44815d018f4', -- Zone B
    'c3f4b3d4-ae89-4dfd-91f7-76f5bd0c3b57'  -- Zone C
)
    AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
ORDER BY ep.name, 
    CASE 
        WHEN o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED') AND o.stock_released = false THEN 1
        WHEN o.status = 'PENDING_CASH' AND o.stock_released = false THEN 2
        WHEN o.status IN ('PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION') AND o.stock_released = false THEN 3
        WHEN o.stock_released = true THEN 4
        ELSE 5
    END,
    o.created_at DESC;
