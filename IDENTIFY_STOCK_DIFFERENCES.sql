-- ============================================
-- IDENTIFY EXACT ORDERS/STATUSES CAUSING STOCK DIFFERENCES
-- This query identifies which specific orders are causing the mismatch
-- ============================================

-- Query 1: Complete breakdown showing ALL orders and their counting status
WITH order_analysis AS (
    SELECT 
        ep.id as pass_id,
        ep.name as pass_name,
        ep.max_quantity,
        ep.sold_quantity as current_sold_quantity,
        o.id as order_id,
        o.status,
        o.stock_released,
        op.quantity,
        o.source,
        o.payment_method,
        o.created_at,
        -- Determine if this order SHOULD count (per user expectation: PAID + PENDING_CASH only)
        CASE 
            WHEN o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED') 
                AND o.stock_released = false 
            THEN 'SHOULD COUNT (PAID)'
            WHEN o.status = 'PENDING_CASH' 
                AND o.stock_released = false 
            THEN 'SHOULD COUNT (PENDING_CASH)'
            WHEN o.status IN ('PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
                AND o.stock_released = false 
            THEN 'SHOULD NOT COUNT (Other Pending)'
            WHEN o.stock_released = true 
            THEN 'SHOULD NOT COUNT (Stock Released)'
            WHEN o.status IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
            THEN 'SHOULD NOT COUNT (Excluded Status)'
            ELSE 'SHOULD NOT COUNT (Unknown)'
        END as counting_status,
        -- Determine if this order IS being counted by current system
        CASE 
            WHEN o.stock_released = false
                AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
                AND (
                    o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED')
                    OR o.status IN ('PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
                )
            THEN 'IS COUNTED (Current System)'
            ELSE 'NOT COUNTED (Current System)'
        END as system_counting_status,
        -- Flag for discrepancy
        CASE 
            WHEN (
                (o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED') AND o.stock_released = false)
                OR (o.status = 'PENDING_CASH' AND o.stock_released = false)
            )
            AND NOT (
                o.stock_released = false
                AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
                AND (
                    o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED')
                    OR o.status IN ('PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
                )
            )
            THEN 'MISSING (Should count but not counted)'
            WHEN NOT (
                (o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED') AND o.stock_released = false)
                OR (o.status = 'PENDING_CASH' AND o.stock_released = false)
            )
            AND (
                o.stock_released = false
                AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
                AND (
                    o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED')
                    OR o.status IN ('PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
                )
            )
            THEN 'EXTRA (Counted but should not count)'
            ELSE 'OK'
        END as discrepancy_flag
    FROM public.order_passes op
    JOIN public.orders o ON o.id = op.order_id
    JOIN public.event_passes ep ON ep.id = op.pass_id
    WHERE op.pass_id IN (
        'cf1f8097-87c8-4136-8952-8897f56467e0', -- Zone A
        'c3b76e76-5481-466e-89e3-b44815d018f4', -- Zone B
        'c3f4b3d4-ae89-4dfd-91f7-76f5bd0c3b57'  -- Zone C
    )
)
SELECT 
    pass_id,
    pass_name,
    order_id,
    status,
    stock_released,
    quantity,
    source,
    payment_method,
    created_at,
    counting_status,
    system_counting_status,
    discrepancy_flag
FROM order_analysis
WHERE discrepancy_flag != 'OK'
ORDER BY pass_name, discrepancy_flag, created_at DESC;

-- Query 2: Summary by status showing what's being counted vs what should be counted
WITH status_summary AS (
    SELECT 
        ep.id as pass_id,
        ep.name as pass_name,
        ep.max_quantity,
        ep.sold_quantity as current_sold_quantity,
        o.status,
        o.stock_released,
        COUNT(DISTINCT o.id) as order_count,
        SUM(op.quantity) as total_quantity,
        -- What SHOULD count (user expectation: PAID + PENDING_CASH only)
        SUM(CASE 
            WHEN (
                (o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED') AND o.stock_released = false)
                OR (o.status = 'PENDING_CASH' AND o.stock_released = false)
            )
            THEN op.quantity 
            ELSE 0 
        END) as should_count_quantity,
        -- What IS being counted (current system)
        SUM(CASE 
            WHEN o.stock_released = false
                AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
                AND (
                    o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED')
                    OR o.status IN ('PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
                )
            THEN op.quantity 
            ELSE 0 
        END) as is_counted_quantity
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
    GROUP BY ep.id, ep.name, ep.max_quantity, ep.sold_quantity, o.status, o.stock_released
)
SELECT 
    pass_id,
    pass_name,
    max_quantity,
    current_sold_quantity,
    status,
    stock_released,
    order_count,
    total_quantity,
    should_count_quantity,
    is_counted_quantity,
    is_counted_quantity - should_count_quantity as difference,
    CASE 
        WHEN is_counted_quantity > should_count_quantity THEN 'EXTRA (Being counted but should not)'
        WHEN is_counted_quantity < should_count_quantity THEN 'MISSING (Should count but not being counted)'
        ELSE 'OK'
    END as issue_type
FROM status_summary
WHERE is_counted_quantity != should_count_quantity
ORDER BY pass_name, status;

-- Query 3: Overall summary showing expected vs actual for each pass
WITH pass_totals AS (
    SELECT 
        op.pass_id,
        ep.name as pass_name,
        ep.max_quantity,
        ep.sold_quantity as current_sold_quantity,
        -- Expected (PAID + PENDING_CASH only)
        SUM(CASE 
            WHEN (
                (o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED') AND o.stock_released = false)
                OR (o.status = 'PENDING_CASH' AND o.stock_released = false)
            )
            THEN op.quantity 
            ELSE 0 
        END) as expected_sold_quantity,
        -- What system is actually counting
        SUM(CASE 
            WHEN o.stock_released = false
                AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
                AND (
                    o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED')
                    OR o.status IN ('PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
                )
            THEN op.quantity 
            ELSE 0 
        END) as system_calculated_quantity,
        -- Breakdown by category
        SUM(CASE 
            WHEN o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED') 
                AND o.stock_released = false 
            THEN op.quantity 
            ELSE 0 
        END) as paid_quantity,
        SUM(CASE 
            WHEN o.status = 'PENDING_CASH' 
                AND o.stock_released = false 
            THEN op.quantity 
            ELSE 0 
        END) as pending_cash_quantity,
        SUM(CASE 
            WHEN o.status IN ('PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
                AND o.stock_released = false 
            THEN op.quantity 
            ELSE 0 
        END) as other_pending_quantity
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
    current_sold_quantity as actual_sold_quantity,
    expected_sold_quantity,
    system_calculated_quantity,
    paid_quantity,
    pending_cash_quantity,
    other_pending_quantity,
    current_sold_quantity - expected_sold_quantity as difference_vs_expected,
    current_sold_quantity - system_calculated_quantity as difference_vs_system_calc,
    CASE 
        WHEN current_sold_quantity != expected_sold_quantity THEN 
            CASE 
                WHEN current_sold_quantity > expected_sold_quantity THEN 
                    CONCAT('HIGHER by ', current_sold_quantity - expected_sold_quantity, 
                           '. Likely includes other_pending (', other_pending_quantity, ')')
                ELSE 
                    CONCAT('LOWER by ', expected_sold_quantity - current_sold_quantity, 
                           '. Some orders may have stock_released=true or timing issue.')
            END
        ELSE 'MATCHES EXPECTED'
    END as explanation
FROM pass_totals
ORDER BY pass_name;

-- Query 4: List specific orders that are causing discrepancies
-- This shows orders that are being counted but shouldn't be, or vice versa
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
    o.updated_at,
    CASE 
        -- Orders that SHOULD count but system might not be counting
        WHEN (
            (o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED') AND o.stock_released = false)
            OR (o.status = 'PENDING_CASH' AND o.stock_released = false)
        )
        AND NOT (
            o.stock_released = false
            AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
            AND (
                o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED')
                OR o.status IN ('PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
            )
        )
        THEN 'MISSING: Should count but system not counting'
        -- Orders that are being counted but SHOULD NOT count
        WHEN NOT (
            (o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED') AND o.stock_released = false)
            OR (o.status = 'PENDING_CASH' AND o.stock_released = false)
        )
        AND (
            o.stock_released = false
            AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
            AND (
                o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED')
                OR o.status IN ('PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
            )
        )
        THEN CONCAT('EXTRA: Being counted but should not (Status: ', o.status, ')')
        ELSE NULL
    END as discrepancy_reason
FROM public.order_passes op
JOIN public.orders o ON o.id = op.order_id
JOIN public.event_passes ep ON ep.id = op.pass_id
WHERE op.pass_id IN (
    'cf1f8097-87c8-4136-8952-8897f56467e0', -- Zone A
    'c3b76e76-5481-466e-89e3-b44815d018f4', -- Zone B
    'c3f4b3d4-ae89-4dfd-91f7-76f5bd0c3b57'  -- Zone C
)
    AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
    AND (
        -- Show orders that are causing discrepancies
        (
            (o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED') AND o.stock_released = false)
            OR (o.status = 'PENDING_CASH' AND o.stock_released = false)
        )
        AND NOT (
            o.stock_released = false
            AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
            AND (
                o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED')
                OR o.status IN ('PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
            )
        )
        OR
        (
            NOT (
                (o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED') AND o.stock_released = false)
                OR (o.status = 'PENDING_CASH' AND o.stock_released = false)
            )
            AND (
                o.stock_released = false
                AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
                AND (
                    o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED')
                    OR o.status IN ('PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
                )
            )
        )
    )
ORDER BY ep.name, discrepancy_reason, o.created_at DESC;
