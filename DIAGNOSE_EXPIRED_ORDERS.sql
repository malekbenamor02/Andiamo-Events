-- ============================================
-- DIAGNOSTIC QUERIES FOR EXPIRED ORDERS
-- Use these to identify why orders aren't being rejected
-- ============================================

-- ============================================
-- Query 1: Find all expired PENDING_CASH orders
-- ============================================
SELECT 
    o.id,
    o.status,
    o.expires_at,
    o.created_at,
    o.rejected_at,
    o.stock_released,
    o.updated_at,
    CASE 
        WHEN o.expires_at < NOW() THEN '✅ EXPIRED'
        ELSE '⏳ Not yet expired'
    END as expiration_status,
    EXTRACT(EPOCH FROM (NOW() - o.expires_at))/3600 as hours_expired,
    COUNT(op.id) as pass_count,
    SUM(op.quantity) as total_pass_quantity
FROM public.orders o
LEFT JOIN public.order_passes op ON op.order_id = o.id
WHERE o.status = 'PENDING_CASH'
  AND o.expires_at IS NOT NULL
GROUP BY o.id, o.status, o.expires_at, o.created_at, o.rejected_at, o.stock_released, o.updated_at
ORDER BY o.expires_at ASC;

-- ============================================
-- Query 2: Orders that SHOULD be rejected but aren't
-- ============================================
SELECT 
    o.id,
    o.status,
    o.expires_at,
    o.created_at,
    o.rejected_at,
    o.stock_released,
    CASE 
        WHEN o.rejected_at IS NOT NULL THEN '❌ Already rejected'
        WHEN o.expires_at >= NOW() THEN '⏳ Not expired yet'
        WHEN o.status != 'PENDING_CASH' THEN '⚠️ Wrong status'
        ELSE '✅ Should be rejected'
    END as rejection_status,
    COUNT(op.id) as pass_count,
    SUM(op.quantity) as total_pass_quantity
FROM public.orders o
LEFT JOIN public.order_passes op ON op.order_id = o.id
WHERE o.status = 'PENDING_CASH'
  AND o.expires_at IS NOT NULL
  AND o.expires_at < NOW()
GROUP BY o.id, o.status, o.expires_at, o.created_at, o.rejected_at, o.stock_released
ORDER BY o.expires_at ASC;

-- ============================================
-- Query 3: Check if orders have pass_id set
-- ============================================
SELECT 
    o.id as order_id,
    o.status,
    o.expires_at,
    COUNT(op.id) as total_passes,
    COUNT(op.id) FILTER (WHERE op.pass_id IS NOT NULL) as passes_with_id,
    COUNT(op.id) FILTER (WHERE op.pass_id IS NULL) as passes_without_id,
    STRING_AGG(DISTINCT op.pass_type, ', ') as pass_types
FROM public.orders o
LEFT JOIN public.order_passes op ON op.order_id = o.id
WHERE o.status = 'PENDING_CASH'
  AND o.expires_at IS NOT NULL
  AND o.expires_at < NOW()
  AND o.rejected_at IS NULL
GROUP BY o.id, o.status, o.expires_at
HAVING COUNT(op.id) FILTER (WHERE op.pass_id IS NULL) > 0
ORDER BY o.expires_at ASC;

-- ============================================
-- Query 4: Test the auto-reject function manually
-- ============================================
-- Run this to test the function:
SELECT * FROM auto_reject_expired_pending_cash_orders();

-- ============================================
-- Query 5: Check recent order_logs for auto-rejections
-- ============================================
SELECT 
    ol.order_id,
    ol.action,
    ol.performed_by_type,
    ol.details,
    ol.created_at,
    o.status as current_order_status,
    o.rejected_at,
    o.stock_released
FROM public.order_logs ol
JOIN public.orders o ON o.id = ol.order_id
WHERE ol.action IN ('auto_rejected_expired', 'auto_reject_error')
  AND ol.created_at > NOW() - INTERVAL '24 hours'
ORDER BY ol.created_at DESC
LIMIT 50;

-- ============================================
-- Query 6: Verify stock release status
-- ============================================
SELECT 
    o.id,
    o.status,
    o.expires_at,
    o.stock_released,
    o.rejected_at,
    COUNT(op.id) as pass_count,
    SUM(op.quantity) as total_quantity,
    STRING_AGG(DISTINCT 
        CASE 
            WHEN op.pass_id IS NOT NULL THEN 'Has pass_id'
            ELSE 'Missing pass_id'
        END, 
        ', '
    ) as pass_id_status
FROM public.orders o
LEFT JOIN public.order_passes op ON op.order_id = o.id
WHERE o.status = 'PENDING_CASH'
  AND o.expires_at IS NOT NULL
  AND o.expires_at < NOW()
  AND o.rejected_at IS NULL
GROUP BY o.id, o.status, o.expires_at, o.stock_released, o.rejected_at
ORDER BY o.expires_at ASC;
