-- ============================================
-- INVESTIGATION: Stock Mismatch Analysis
-- Purpose: Compare max_quantity vs (PAID + PENDING_CASH) orders
-- ============================================

-- Query 1: Show current stock status for all passes
SELECT 
    ep.id as pass_id,
    ep.name as pass_name,
    ep.max_quantity,
    ep.sold_quantity as current_sold_quantity,
    ep.max_quantity - ep.sold_quantity as remaining_quantity,
    ep.event_id
FROM public.event_passes ep
WHERE ep.max_quantity IS NOT NULL
ORDER BY ep.event_id, ep.name;

-- Query 2: Calculate what sold_quantity SHOULD be (only PAID + PENDING_CASH)
-- This is what the user expects: max_stock = paid + pending_cash
WITH expected_calculation AS (
    SELECT 
        op.pass_id,
        -- Count PAID orders
        SUM(CASE 
            WHEN o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED') 
                AND o.stock_released = false 
            THEN op.quantity 
            ELSE 0 
        END) as paid_quantity,
        -- Count PENDING_CASH orders
        SUM(CASE 
            WHEN o.status = 'PENDING_CASH' 
                AND o.stock_released = false 
            THEN op.quantity 
            ELSE 0 
        END) as pending_cash_quantity,
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
    WHERE op.pass_id IS NOT NULL
        AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
    GROUP BY op.pass_id
)
SELECT 
    ep.id as pass_id,
    ep.name as pass_name,
    ep.max_quantity,
    ep.sold_quantity as current_sold_quantity,
    COALESCE(ec.expected_sold_quantity, 0) as expected_sold_quantity,
    COALESCE(ec.paid_quantity, 0) as paid_quantity,
    COALESCE(ec.pending_cash_quantity, 0) as pending_cash_quantity,
    ep.sold_quantity - COALESCE(ec.expected_sold_quantity, 0) as difference,
    CASE 
        WHEN ep.sold_quantity != COALESCE(ec.expected_sold_quantity, 0) THEN 'MISMATCH'
        ELSE 'OK'
    END as status
FROM public.event_passes ep
LEFT JOIN expected_calculation ec ON ec.pass_id = ep.id
WHERE ep.max_quantity IS NOT NULL
ORDER BY 
    CASE WHEN ep.sold_quantity != COALESCE(ec.expected_sold_quantity, 0) THEN 0 ELSE 1 END,
    ep.event_id, 
    ep.name;

-- Query 3: Show what OTHER pending statuses are being counted
-- (These are included in current sold_quantity but NOT in user's expected calculation)
WITH other_pending_statuses AS (
    SELECT 
        op.pass_id,
        o.status,
        SUM(op.quantity) as quantity
    FROM public.order_passes op
    JOIN public.orders o ON o.id = op.order_id
    WHERE op.pass_id IS NOT NULL
        AND o.stock_released = false
        AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
        AND o.status NOT IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED', 'PENDING_CASH')
        AND o.status IN ('PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
    GROUP BY op.pass_id, o.status
)
SELECT 
    ep.id as pass_id,
    ep.name as pass_name,
    ops.status,
    ops.quantity,
    ep.sold_quantity as current_sold_quantity
FROM public.event_passes ep
JOIN other_pending_statuses ops ON ops.pass_id = ep.id
WHERE ep.max_quantity IS NOT NULL
ORDER BY ep.event_id, ep.name, ops.status;

-- Query 4: Show orders with stock_released = true that might be incorrectly counted
-- (These should NOT be in sold_quantity)
SELECT 
    op.pass_id,
    ep.name as pass_name,
    o.id as order_id,
    o.status,
    o.stock_released,
    op.quantity,
    o.created_at
FROM public.order_passes op
JOIN public.orders o ON o.id = op.order_id
JOIN public.event_passes ep ON ep.id = op.pass_id
WHERE op.pass_id IS NOT NULL
    AND o.stock_released = true
    AND o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED', 'PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
    AND ep.max_quantity IS NOT NULL
ORDER BY ep.name, o.created_at DESC
LIMIT 50;

-- Query 5: Summary by status for each pass
SELECT 
    ep.id as pass_id,
    ep.name as pass_name,
    ep.max_quantity,
    ep.sold_quantity as current_sold_quantity,
    o.status,
    COUNT(DISTINCT o.id) as order_count,
    SUM(op.quantity) as total_quantity,
    SUM(CASE WHEN o.stock_released = true THEN 1 ELSE 0 END) as orders_with_stock_released
FROM public.event_passes ep
LEFT JOIN public.order_passes op ON op.pass_id = ep.id
LEFT JOIN public.orders o ON o.id = op.order_id
WHERE ep.max_quantity IS NOT NULL
    AND op.pass_id IS NOT NULL
    AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
GROUP BY ep.id, ep.name, ep.max_quantity, ep.sold_quantity, o.status
ORDER BY ep.event_id, ep.name, o.status;
