-- Migration: Add PENDING_ADMIN_APPROVAL status to unified system
-- This allows orders to be in PENDING_ADMIN_APPROVAL state after ambassador confirms cash
-- Admin can then approve to change status to PAID and trigger ticket generation

-- Step 1: Drop the existing constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Step 2: Add new constraint that includes PENDING_ADMIN_APPROVAL and REJECTED
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN (
    'PENDING_ONLINE', 
    'REDIRECTED', 
    'PENDING_CASH', 
    'PENDING_ADMIN_APPROVAL',  -- New: After ambassador confirms cash, before admin approval
    'PAID', 
    'REJECTED',  -- New: When admin rejects a PENDING_ADMIN_APPROVAL order
    'CANCELLED'
  ));

-- Step 3: Add comment explaining the status flow
COMMENT ON CONSTRAINT orders_status_check ON public.orders IS 
  'Unified order status system:
   - PENDING_ONLINE: Online order waiting for payment
   - REDIRECTED: Order redirected to external payment
   - PENDING_CASH: COD order waiting for ambassador to confirm cash received
   - PENDING_ADMIN_APPROVAL: Ambassador confirmed cash, waiting for admin approval before sending tickets
   - PAID: Order is paid and tickets are sent
   - REJECTED: Order was rejected by admin
   - CANCELLED: Order is cancelled';

