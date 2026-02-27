-- Add FAILED to orders_status_check for online payment failures
-- ClicToPay confirm API sets status=FAILED when payment fails; constraint was blocking the update

DO $$ 
BEGIN
  ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
  RAISE NOTICE 'Dropped existing orders_status_check constraint';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Constraint orders_status_check not found (this is OK)';
END $$;

ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN (
    'PENDING_ONLINE', 
    'REDIRECTED', 
    'PENDING_CASH', 
    'PENDING_ADMIN_APPROVAL',
    'PAID', 
    'FAILED',  -- Online payment failed (ClicToPay)
    'REJECTED',
    'CANCELLED', 
    'REMOVED_BY_ADMIN'
  ));

COMMENT ON CONSTRAINT orders_status_check ON public.orders IS 
  'Unified order status system:
   - PENDING_ONLINE: Online order waiting for payment
   - REDIRECTED: Order redirected to external payment
   - PENDING_CASH: COD order waiting for ambassador to confirm cash received
   - PENDING_ADMIN_APPROVAL: Ambassador confirmed cash, waiting for admin approval before sending tickets
   - PAID: Order is paid and tickets are sent
   - FAILED: Online payment failed (gateway/ClicToPay)
   - REJECTED: Order was rejected by admin
   - CANCELLED: Order is cancelled
   - REMOVED_BY_ADMIN: Order removed by admin (soft delete)';
