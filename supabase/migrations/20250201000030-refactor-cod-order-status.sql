-- Migration: Refactor COD Order Status Logic
-- Removes: PENDING_AMBASSADOR, ASSIGNED
-- Adds: APPROVED, REJECTED
-- New COD flow: PENDING_ADMIN_APPROVAL -> APPROVED/REJECTED -> COMPLETED (optional)

-- ============================================
-- STEP 1: Update existing COD orders status
-- ============================================
-- Update any existing orders with old statuses
UPDATE public.orders 
SET status = 'PENDING_ADMIN_APPROVAL'
WHERE status IN ('PENDING_AMBASSADOR', 'ASSIGNED', 'PENDING') 
  AND payment_method = 'cod';

-- ============================================
-- STEP 2: Drop old status constraint
-- ============================================
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- ============================================
-- STEP 3: Add new status constraint
-- ============================================
-- COD statuses: PENDING_ADMIN_APPROVAL, APPROVED, REJECTED, COMPLETED
-- Online statuses: PENDING_PAYMENT, PAID, FAILED, REFUNDED (handled via payment_status)
-- Manual statuses: PENDING_ADMIN_APPROVAL, APPROVED, REJECTED, COMPLETED
-- Legacy/other: CANCELLED_BY_AMBASSADOR, CANCELLED_BY_ADMIN, FRAUD_SUSPECT, IGNORED, ON_HOLD
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
  CHECK (
    status IN (
      -- COD and Manual order statuses
      'PENDING_ADMIN_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED',
      -- Online order statuses (legacy, but kept for backward compatibility)
      'PENDING_PAYMENT', 'PAID', 'FAILED', 'REFUNDED',
      -- Cancellation statuses
      'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN',
      -- Other statuses
      'FRAUD_SUSPECT', 'IGNORED', 'ON_HOLD',
      -- Legacy statuses (for backward compatibility, will be migrated)
      'PENDING', 'ACCEPTED', 'MANUAL_ACCEPTED', 'MANUAL_COMPLETED'
    )
  );

-- ============================================
-- STEP 4: Add approved_at and rejected_at timestamp columns
-- ============================================
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;

-- ============================================
-- STEP 5: Add rejection_reason column
-- ============================================
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ============================================
-- STEP 6: Add comment explaining the status flow
-- ============================================
COMMENT ON COLUMN public.orders.status IS 
'Order status. COD orders flow: PENDING_ADMIN_APPROVAL -> APPROVED/REJECTED -> COMPLETED (optional). 
Online orders use payment_status for payment tracking. 
Only Admin/Super Admin can change COD order status from PENDING_ADMIN_APPROVAL.';

COMMENT ON COLUMN public.orders.approved_at IS 
'Timestamp when order was approved by admin (COD orders only)';

COMMENT ON COLUMN public.orders.rejected_at IS 
'Timestamp when order was rejected by admin (COD orders only)';

COMMENT ON COLUMN public.orders.rejection_reason IS 
'Reason for order rejection (COD orders only)';













