-- Reset all online orders to PENDING_PAYMENT since payment gateway is not yet integrated
-- This ensures all online orders start as pending until manually updated by admin
-- or until payment gateway integration is complete

-- Reset payment_status to PENDING_PAYMENT for all online orders
-- (unless they have payment gateway data indicating a real payment)
UPDATE public.orders 
SET payment_status = 'PENDING_PAYMENT'
WHERE source = 'platform_online' 
  AND (
    payment_status IS NULL 
    OR payment_status = 'PAID'
  )
  AND (
    -- Only reset if there's no payment gateway reference (meaning no real payment was processed)
    payment_gateway_reference IS NULL 
    AND transaction_id IS NULL
    AND payment_response_data IS NULL
  );

-- Add a comment explaining the payment status workflow
COMMENT ON COLUMN public.orders.payment_status IS 
  'Payment status for online orders. Values: PENDING_PAYMENT (default, no gateway yet), PAID (manually set by admin or via gateway), FAILED, REFUNDED. Without payment gateway, all orders start as PENDING_PAYMENT and must be manually updated by admin.';


