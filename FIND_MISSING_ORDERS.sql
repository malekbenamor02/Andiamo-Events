-- ============================================
-- FIND MISSING ORDERS CAUSING STOCK DIFFERENCES
-- This identifies specific orders that should be counted but aren't reflected in sold_quantity
-- ============================================

-- Query 1: Find orders that should count but sold_quantity doesn't reflect them
-- This will show the exact orders causing Zone A & B to be lower
SELECT 
    ep.id as pass_id,
    ep.name as pass_name,
    ep.sold_quantity as stored_sold_quantity,
    o.id as order_id,
    o.status,
    o.stock_released,
    op.quantity,
    o.source,
    o.payment_method,
    o.created_at,
    o.updated_at,
    'SHOULD BE COUNTED' as reason
FROM public.order_passes op
JOIN public.orders o ON o.id = op.order_id
JOIN public.event_passes ep ON ep.id = op.pass_id
WHERE op.pass_id IN (
    'cf1f8097-87c8-4136-8952-8897f56467e0', -- Zone A
    'c3b76e76-5481-466e-89e3-b44815d018f4'  -- Zone B
)
    AND o.stock_released = false
    AND (
        o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED')
        OR o.status = 'PENDING_CASH'
    )
    AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
ORDER BY ep.name, o.created_at DESC;

-- Query 2: For Zone C - Find what's causing the +4 difference
-- Check if there are orders with other statuses or if sold_quantity was manually set
SELECT 
    ep.id as pass_id,
    ep.name as pass_name,
    ep.sold_quantity as stored_sold_quantity,
    o.id as order_id,
    o.status,
    o.stock_released,
    op.quantity,
    o.source,
    o.payment_method,
    o.created_at,
    o.updated_at,
    CASE 
        WHEN o.status IN ('PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
        THEN CONCAT('EXTRA: Status ', o.status, ' being counted')
        ELSE 'UNKNOWN - Check this order'
    END as reason
FROM public.order_passes op
JOIN public.orders o ON o.id = op.order_id
JOIN public.event_passes ep ON ep.id = op.pass_id
WHERE op.pass_id = 'c3f4b3d4-ae89-4dfd-91f7-76f5bd0c3b57'  -- Zone C
    AND o.stock_released = false
    AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
    AND (
        o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED', 'PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
    )
ORDER BY o.status, o.created_at DESC;

-- Query 3: Check if sold_quantity was manually modified (compare with calculated value)
-- This shows the exact discrepancy
WITH calculated_values AS (
    SELECT 
        op.pass_id,
        SUM(op.quantity) as calculated_total
    FROM public.order_passes op
    JOIN public.orders o ON o.id = op.order_id
    WHERE op.pass_id IN (
        'cf1f8097-87c8-4136-8952-8897f56467e0', -- Zone A
        'c3b76e76-5481-466e-89e3-b44815d018f4', -- Zone B
        'c3f4b3d4-ae89-4dfd-91f7-76f5bd0c3b57'  -- Zone C
    )
        AND o.stock_released = false
        AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
        AND (
            o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED')
            OR o.status IN ('PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
        )
    GROUP BY op.pass_id
)
SELECT 
    ep.id as pass_id,
    ep.name as pass_name,
    ep.max_quantity,
    ep.sold_quantity as stored_value,
    COALESCE(cv.calculated_total, 0) as calculated_value,
    ep.sold_quantity - COALESCE(cv.calculated_total, 0) as difference,
    ep.updated_at as pass_updated_at,
    CASE 
        WHEN ep.sold_quantity > COALESCE(cv.calculated_total, 0) THEN 
            CONCAT('STORED VALUE IS HIGHER by ', ep.sold_quantity - COALESCE(cv.calculated_total, 0), 
                   ' - sold_quantity needs to be recalculated')
        WHEN ep.sold_quantity < COALESCE(cv.calculated_total, 0) THEN 
            CONCAT('STORED VALUE IS LOWER by ', COALESCE(cv.calculated_total, 0) - ep.sold_quantity, 
                   ' - sold_quantity needs to be recalculated')
        ELSE 'STORED VALUE MATCHES CALCULATED'
    END as action_needed
FROM public.event_passes ep
LEFT JOIN calculated_values cv ON cv.pass_id = ep.id
WHERE ep.id IN (
    'cf1f8097-87c8-4136-8952-8897f56467e0', -- Zone A
    'c3b76e76-5481-466e-89e3-b44815d018f4', -- Zone B
    'c3f4b3d4-ae89-4dfd-91f7-76f5bd0c3b57'  -- Zone C
)
ORDER BY ep.name;

-- Query 4: Show all order statuses for Zone C to find the +4
SELECT 
    ep.name as pass_name,
    o.status,
    o.stock_released,
    COUNT(DISTINCT o.id) as order_count,
    SUM(op.quantity) as total_quantity
FROM public.order_passes op
JOIN public.orders o ON o.id = op.order_id
JOIN public.event_passes ep ON ep.id = op.pass_id
WHERE op.pass_id = 'c3f4b3d4-ae89-4dfd-91f7-76f5bd0c3b57'  -- Zone C
    AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
GROUP BY ep.name, o.status, o.stock_released
ORDER BY o.status;
