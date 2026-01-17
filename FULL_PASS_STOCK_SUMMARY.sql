-- ============================================
-- FULL PASS STOCK SUMMARY
-- Complete calculation and breakdown for all passes
-- ============================================

-- ============================================
-- SUMMARY 1: All Passes with Stock Overview
-- ============================================
SELECT 
    ep.id as pass_id,
    ep.name as pass_name,
    e.name as event_name,
    ep.max_quantity,
    ep.sold_quantity,
    (ep.max_quantity - ep.sold_quantity) as available_stock,
    ROUND((ep.sold_quantity::NUMERIC / NULLIF(ep.max_quantity, 0)) * 100, 2) as sold_percentage,
    CASE 
        WHEN ep.sold_quantity >= ep.max_quantity THEN '🔴 SOLD OUT'
        WHEN ep.sold_quantity >= (ep.max_quantity * 0.9) THEN '🟡 Almost Sold Out'
        WHEN ep.sold_quantity >= (ep.max_quantity * 0.5) THEN '🟢 Good Sales'
        ELSE '⚪ Available'
    END as stock_status
FROM public.event_passes ep
JOIN public.events e ON e.id = ep.event_id
ORDER BY e.name, ep.name;

-- ============================================
-- SUMMARY 2: Detailed Breakdown by Order Status
-- ============================================
SELECT 
    ep.id as pass_id,
    ep.name as pass_name,
    e.name as event_name,
    ep.max_quantity,
    ep.sold_quantity as current_sold_quantity,
    -- Breakdown by status
    COALESCE(SUM(op.quantity) FILTER (WHERE o.status = 'PAID'), 0) as paid_count,
    COALESCE(SUM(op.quantity) FILTER (WHERE o.status = 'COMPLETED'), 0) as completed_count,
    COALESCE(SUM(op.quantity) FILTER (WHERE o.status = 'MANUAL_COMPLETED'), 0) as manual_completed_count,
    COALESCE(SUM(op.quantity) FILTER (WHERE o.status = 'PENDING_CASH' AND o.stock_released = false), 0) as pending_cash_count,
    COALESCE(SUM(op.quantity) FILTER (WHERE o.status = 'PENDING_ONLINE' AND o.stock_released = false), 0) as pending_online_count,
    COALESCE(SUM(op.quantity) FILTER (WHERE o.status = 'MANUAL_ACCEPTED' AND o.stock_released = false), 0) as manual_accepted_count,
    COALESCE(SUM(op.quantity) FILTER (WHERE o.status = 'PENDING_ADMIN_APPROVAL' AND o.stock_released = false), 0) as pending_admin_approval_count,
    COALESCE(SUM(op.quantity) FILTER (WHERE o.status = 'PENDING_AMBASSADOR_CONFIRMATION' AND o.stock_released = false), 0) as pending_ambassador_confirmation_count,
    -- Excluded orders (should not count)
    COALESCE(SUM(op.quantity) FILTER (WHERE o.status = 'REMOVED_BY_ADMIN'), 0) as removed_by_admin_count,
    COALESCE(SUM(op.quantity) FILTER (WHERE o.status = 'REJECTED'), 0) as rejected_count,
    COALESCE(SUM(op.quantity) FILTER (WHERE o.status = 'CANCELLED'), 0) as cancelled_count,
    COALESCE(SUM(op.quantity) FILTER (WHERE o.status = 'CANCELLED_BY_AMBASSADOR'), 0) as cancelled_by_ambassador_count,
    COALESCE(SUM(op.quantity) FILTER (WHERE o.status = 'CANCELLED_BY_ADMIN'), 0) as cancelled_by_admin_count,
    COALESCE(SUM(op.quantity) FILTER (WHERE o.status = 'REFUNDED'), 0) as refunded_count,
    -- Stock release status
    COALESCE(SUM(op.quantity) FILTER (WHERE o.stock_released = true), 0) as stock_released_count,
    COALESCE(SUM(op.quantity) FILTER (WHERE o.stock_released = false), 0) as stock_reserved_count,
    -- Calculated total (should match sold_quantity)
    COALESCE(SUM(op.quantity) FILTER (
        WHERE o.stock_released = false
        AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN', 'REFUNDED')
        AND (
            o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED')
            OR o.status IN ('PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
        )
    ), 0) as calculated_sold_quantity,
    -- Discrepancy check
    (ep.sold_quantity - COALESCE(SUM(op.quantity) FILTER (
        WHERE o.stock_released = false
        AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN', 'REFUNDED')
        AND (
            o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED')
            OR o.status IN ('PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
        )
    ), 0)) as discrepancy
FROM public.event_passes ep
JOIN public.events e ON e.id = ep.event_id
LEFT JOIN public.order_passes op ON op.pass_id = ep.id
LEFT JOIN public.orders o ON o.id = op.order_id
GROUP BY ep.id, ep.name, e.name, ep.max_quantity, ep.sold_quantity
ORDER BY e.name, ep.name;

-- ============================================
-- SUMMARY 3: Order Status Summary (All Passes)
-- ============================================
SELECT 
    o.status,
    COUNT(DISTINCT o.id) as order_count,
    COUNT(DISTINCT op.pass_id) as affected_passes,
    SUM(op.quantity) as total_pass_quantity,
    COUNT(*) FILTER (WHERE o.stock_released = true) as orders_with_stock_released,
    COUNT(*) FILTER (WHERE o.stock_released = false) as orders_with_stock_reserved
FROM public.orders o
JOIN public.order_passes op ON op.order_id = o.id
WHERE op.pass_id IS NOT NULL
GROUP BY o.status
ORDER BY 
    CASE o.status
        WHEN 'PAID' THEN 1
        WHEN 'COMPLETED' THEN 2
        WHEN 'MANUAL_COMPLETED' THEN 3
        WHEN 'PENDING_CASH' THEN 4
        WHEN 'PENDING_ONLINE' THEN 5
        WHEN 'MANUAL_ACCEPTED' THEN 6
        WHEN 'PENDING_ADMIN_APPROVAL' THEN 7
        WHEN 'PENDING_AMBASSADOR_CONFIRMATION' THEN 8
        WHEN 'REMOVED_BY_ADMIN' THEN 9
        WHEN 'REJECTED' THEN 10
        WHEN 'CANCELLED' THEN 11
        WHEN 'CANCELLED_BY_AMBASSADOR' THEN 12
        WHEN 'CANCELLED_BY_ADMIN' THEN 13
        WHEN 'REFUNDED' THEN 14
        ELSE 99
    END;

-- ============================================
-- SUMMARY 4: Verification Check
-- ============================================
-- This uses the verify_stock_calculations() function
-- Shows any discrepancies between stored and calculated values
SELECT 
    pass_id,
    pass_name,
    max_quantity,
    current_sold_quantity,
    calculated_sold_quantity,
    discrepancy,
    CASE 
        WHEN discrepancy = 0 THEN '✅ Correct'
        WHEN discrepancy > 0 THEN '⚠️ Too High'
        ELSE '⚠️ Too Low'
    END as status,
    status_breakdown
FROM verify_stock_calculations()
WHERE discrepancy != 0 OR current_sold_quantity > 0
ORDER BY ABS(discrepancy) DESC, pass_name;

-- ============================================
-- SUMMARY 5: Problematic Orders Check
-- ============================================
-- Orders that should have stock released but don't
SELECT 
    o.status,
    COUNT(*) as order_count,
    SUM(op.quantity) as total_pass_quantity,
    COUNT(DISTINCT op.pass_id) as affected_passes
FROM public.orders o
JOIN public.order_passes op ON op.order_id = o.id
WHERE o.status IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN', 'REFUNDED')
  AND o.stock_released = false
  AND op.pass_id IS NOT NULL
GROUP BY o.status
ORDER BY o.status;

-- ============================================
-- SUMMARY 6: Event-Level Summary
-- ============================================
SELECT 
    e.id as event_id,
    e.name as event_name,
    COUNT(DISTINCT ep.id) as total_passes,
    SUM(ep.max_quantity) as total_max_stock,
    SUM(ep.sold_quantity) as total_sold,
    SUM(ep.max_quantity - ep.sold_quantity) as total_available,
    ROUND((SUM(ep.sold_quantity)::NUMERIC / NULLIF(SUM(ep.max_quantity), 0)) * 100, 2) as overall_sold_percentage,
    COUNT(DISTINCT ep.id) FILTER (WHERE ep.sold_quantity >= ep.max_quantity) as sold_out_passes,
    COUNT(DISTINCT ep.id) FILTER (WHERE ep.sold_quantity >= (ep.max_quantity * 0.9) AND ep.sold_quantity < ep.max_quantity) as almost_sold_out_passes
FROM public.events e
JOIN public.event_passes ep ON ep.event_id = e.id
GROUP BY e.id, e.name
ORDER BY e.name;
