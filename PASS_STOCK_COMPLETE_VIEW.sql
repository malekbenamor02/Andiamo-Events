-- ============================================
-- COMPLETE PASS STOCK VIEW
-- Single comprehensive query showing all passes with full breakdown
-- ============================================

WITH pass_status_breakdown AS (
    SELECT 
        op.pass_id,
        -- Active/Reserved Orders (counted in sold_quantity)
        SUM(op.quantity) FILTER (
            WHERE o.status IN ('PAID', 'COMPLETED', 'MANUAL_COMPLETED')
            AND o.stock_released = false
        ) as active_orders_count,
        
        SUM(op.quantity) FILTER (
            WHERE o.status IN ('PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
            AND o.stock_released = false
        ) as pending_orders_count,
        
        -- Excluded Orders (NOT counted in sold_quantity)
        SUM(op.quantity) FILTER (WHERE o.status = 'REMOVED_BY_ADMIN') as removed_count,
        SUM(op.quantity) FILTER (WHERE o.status = 'REJECTED') as rejected_count,
        SUM(op.quantity) FILTER (WHERE o.status = 'CANCELLED') as cancelled_count,
        SUM(op.quantity) FILTER (WHERE o.status = 'CANCELLED_BY_AMBASSADOR') as cancelled_by_ambassador_count,
        SUM(op.quantity) FILTER (WHERE o.status = 'CANCELLED_BY_ADMIN') as cancelled_by_admin_count,
        SUM(op.quantity) FILTER (WHERE o.status = 'REFUNDED') as refunded_count,
        
        -- Stock Release Status
        SUM(op.quantity) FILTER (WHERE o.stock_released = true) as total_released,
        SUM(op.quantity) FILTER (WHERE o.stock_released = false) as total_reserved,
        
        -- Calculated sold_quantity (should match stored value)
        SUM(op.quantity) FILTER (
            WHERE o.stock_released = false
            AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN', 'REFUNDED')
            AND (
                o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED')
                OR o.status IN ('PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
            )
        ) as calculated_sold
    FROM public.order_passes op
    JOIN public.orders o ON o.id = op.order_id
    WHERE op.pass_id IS NOT NULL
    GROUP BY op.pass_id
)
SELECT 
    ep.id as pass_id,
    ep.name as pass_name,
    e.name as event_name,
    e.id as event_id,
    
    -- Stock Information
    ep.max_quantity as max_stock,
    ep.sold_quantity as current_sold,
    COALESCE(psb.calculated_sold, 0) as calculated_sold,
    (ep.max_quantity - ep.sold_quantity) as available_stock,
    ROUND((ep.sold_quantity::NUMERIC / NULLIF(ep.max_quantity, 0)) * 100, 2) as sold_percentage,
    
    -- Discrepancy Check
    (ep.sold_quantity - COALESCE(psb.calculated_sold, 0)) as discrepancy,
    CASE 
        WHEN (ep.sold_quantity - COALESCE(psb.calculated_sold, 0)) = 0 THEN '✅ Correct'
        WHEN (ep.sold_quantity - COALESCE(psb.calculated_sold, 0)) > 0 THEN '⚠️ Too High'
        ELSE '⚠️ Too Low'
    END as calculation_status,
    
    -- Active Orders Breakdown
    COALESCE(psb.active_orders_count, 0) as active_orders,
    COALESCE(psb.pending_orders_count, 0) as pending_orders,
    COALESCE(psb.active_orders_count, 0) + COALESCE(psb.pending_orders_count, 0) as total_counted,
    
    -- Excluded Orders Breakdown
    COALESCE(psb.removed_count, 0) as removed_by_admin,
    COALESCE(psb.rejected_count, 0) as rejected,
    COALESCE(psb.cancelled_count, 0) as cancelled,
    COALESCE(psb.cancelled_by_ambassador_count, 0) as cancelled_by_ambassador,
    COALESCE(psb.cancelled_by_admin_count, 0) as cancelled_by_admin,
    COALESCE(psb.refunded_count, 0) as refunded,
    (
        COALESCE(psb.removed_count, 0) + 
        COALESCE(psb.rejected_count, 0) + 
        COALESCE(psb.cancelled_count, 0) + 
        COALESCE(psb.cancelled_by_ambassador_count, 0) + 
        COALESCE(psb.cancelled_by_admin_count, 0) + 
        COALESCE(psb.refunded_count, 0)
    ) as total_excluded,
    
    -- Stock Release Status
    COALESCE(psb.total_released, 0) as stock_released,
    COALESCE(psb.total_reserved, 0) as stock_reserved,
    
    -- Stock Status Indicator
    CASE 
        WHEN ep.sold_quantity >= ep.max_quantity THEN '🔴 SOLD OUT'
        WHEN ep.sold_quantity >= (ep.max_quantity * 0.9) THEN '🟡 Almost Sold Out (>90%)'
        WHEN ep.sold_quantity >= (ep.max_quantity * 0.5) THEN '🟢 Good Sales (>50%)'
        WHEN ep.sold_quantity > 0 THEN '⚪ Has Sales'
        ELSE '⚪ No Sales'
    END as stock_status,
    
    -- Timestamps
    ep.created_at,
    ep.updated_at
    
FROM public.event_passes ep
JOIN public.events e ON e.id = ep.event_id
LEFT JOIN pass_status_breakdown psb ON psb.pass_id = ep.id
ORDER BY 
    e.name,
    ep.name;
