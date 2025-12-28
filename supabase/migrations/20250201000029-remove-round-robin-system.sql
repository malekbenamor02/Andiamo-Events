-- Remove Round Robin Assignment System
-- This migration removes all round-robin and automatic assignment logic

-- ============================================
-- 1. DROP FUNCTIONS
-- ============================================

-- Drop assign_order_to_ambassador function
DROP FUNCTION IF EXISTS public.assign_order_to_ambassador(UUID, TEXT);

-- Drop get_next_ambassador_for_ville function
DROP FUNCTION IF EXISTS public.get_next_ambassador_for_ville(TEXT);

-- Drop auto_reassign_ignored_orders function (if exists)
DROP FUNCTION IF EXISTS public.auto_reassign_ignored_orders(INTEGER);

-- ============================================
-- 2. DROP TABLES
-- ============================================

-- Drop round_robin_tracker table
DROP TABLE IF EXISTS public.round_robin_tracker CASCADE;

-- Drop round_robin_tracker_test table (if exists for test mode)
DROP TABLE IF EXISTS public.round_robin_tracker_test CASCADE;

-- ============================================
-- 3. UPDATE ORDER STATUSES
-- ============================================

-- Update any PENDING_AMBASSADOR orders to PENDING
UPDATE public.orders
SET status = 'PENDING'
WHERE status = 'PENDING_AMBASSADOR';

-- Update any ASSIGNED orders to PENDING (they need manual assignment now)
UPDATE public.orders
SET status = 'PENDING',
    ambassador_id = NULL,
    assigned_at = NULL
WHERE status = 'ASSIGNED';

-- ============================================
-- 4. CLEANUP ORDER LOGS
-- ============================================

-- Optionally delete assignment-related log entries
-- Uncomment the line below if you want to clean up old assignment logs
-- DELETE FROM public.order_logs WHERE action = 'assigned' AND performed_by_type = 'system';

-- ============================================
-- 5. UPDATE STATUS CONSTRAINTS (if needed)
-- ============================================

-- Note: The status check constraint on orders table should be updated to remove
-- PENDING_AMBASSADOR and ASSIGNED from allowed values if they're explicitly listed.
-- However, if the constraint uses a general pattern, no changes needed.

