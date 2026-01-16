-- Migration: Fix orders_status_check constraint to include PENDING_ADMIN_APPROVAL and REJECTED
-- Issue: The 20250225000000 migration removed PENDING_ADMIN_APPROVAL and REJECTED from the constraint
-- This migration restores them so ambassadors can confirm orders (PENDING_CASH -> PENDING_ADMIN_APPROVAL)

-- Step 1: Drop the existing constraint
DO $$ 
BEGIN
  ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
  RAISE NOTICE 'Dropped existing orders_status_check constraint';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Constraint orders_status_check not found (this is OK)';
END $$;

-- Step 2: Verify no invalid statuses exist before adding constraint
DO $$ 
DECLARE
  invalid_count INTEGER;
  invalid_statuses TEXT;
BEGIN
  -- Check for any statuses that are not in our allowed list
  SELECT COUNT(*), string_agg(DISTINCT status, ', ')
  INTO invalid_count, invalid_statuses
  FROM public.orders
  WHERE status NOT IN (
    'PENDING_ONLINE', 
    'REDIRECTED', 
    'PENDING_CASH', 
    'PENDING_ADMIN_APPROVAL',  -- Required for ambassador confirm flow
    'PAID', 
    'REJECTED',  -- Required for admin rejection flow
    'CANCELLED', 
    'REMOVED_BY_ADMIN'
  );
  
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Cannot add constraint: % orders still have invalid statuses: %. Please review and fix manually.', 
      invalid_count, invalid_statuses;
  END IF;
  
  -- Add constraint with all required statuses
  ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
    CHECK (status IN (
      'PENDING_ONLINE', 
      'REDIRECTED', 
      'PENDING_CASH', 
      'PENDING_ADMIN_APPROVAL',  -- After ambassador confirms cash, before admin approval
      'PAID', 
      'REJECTED',  -- When admin rejects a PENDING_ADMIN_APPROVAL order
      'CANCELLED', 
      'REMOVED_BY_ADMIN'  -- Soft delete by admin
    ));
  
  RAISE NOTICE 'Successfully added orders_status_check constraint with all required statuses';
END $$;

-- Step 3: Add comment explaining the status flow
COMMENT ON CONSTRAINT orders_status_check ON public.orders IS 
  'Unified order status system:
   - PENDING_ONLINE: Online order waiting for payment
   - REDIRECTED: Order redirected to external payment
   - PENDING_CASH: COD order waiting for ambassador to confirm cash received
   - PENDING_ADMIN_APPROVAL: Ambassador confirmed cash, waiting for admin approval before sending tickets
   - PAID: Order is paid and tickets are sent
   - REJECTED: Order was rejected by admin
   - CANCELLED: Order is cancelled
   - REMOVED_BY_ADMIN: Order removed by admin (soft delete)';
