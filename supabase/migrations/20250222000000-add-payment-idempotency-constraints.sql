-- Add idempotency constraints for payment processing
-- This migration ensures:
-- 1. One active payment per order (payment_gateway_reference unique where not null)
-- 2. One ticket generation per order (tickets.order_id unique constraint via application logic)
-- 3. Prevents duplicate payment processing

-- ============================================
-- 1. Add unique constraint on payment_gateway_reference
-- ============================================
-- Note: We use a partial unique index since payment_gateway_reference can be NULL
-- This ensures one active payment per order, but allows NULL for orders without payment yet

DO $$ 
BEGIN
  -- Drop existing index if it exists (might be a regular index)
  DROP INDEX IF EXISTS idx_orders_payment_gateway_reference_unique;
  
  -- Create partial unique index (only for non-null values)
  -- This ensures one payment_gateway_reference per order when it exists
  CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_gateway_reference_unique 
    ON public.orders(payment_gateway_reference) 
    WHERE payment_gateway_reference IS NOT NULL;
    
  RAISE NOTICE 'Created unique index on payment_gateway_reference';
EXCEPTION
  WHEN duplicate_table THEN
    RAISE NOTICE 'Index already exists';
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating index: %', SQLERRM;
END $$;

-- ============================================
-- 2. Add payment_created_at column if it doesn't exist
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'payment_created_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN payment_created_at TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE 'Added payment_created_at column';
  END IF;
END $$;

-- ============================================
-- 3. Add comment explaining idempotency protection
-- ============================================
COMMENT ON COLUMN public.orders.payment_gateway_reference IS 
  'Unique payment gateway reference (payment_id from Flouci). 
   Enforced by unique index to prevent duplicate payments per order.
   NULL allowed for orders without payment gateway yet.';

COMMENT ON COLUMN public.orders.payment_created_at IS 
  'Timestamp when payment was created in payment gateway.
   Used for tracking payment lifecycle and timeout handling.';

-- ============================================
-- 4. Note on tickets.idempotency
-- ============================================
-- Tickets table already has order_id foreign key
-- Application logic ensures one ticket generation per order
-- (checked in generateTicketsAndSendEmail function)
-- We don't add a unique constraint on tickets.order_id because
-- multiple tickets can exist per order (one per pass quantity)

COMMENT ON TABLE public.tickets IS 
  'Stores individual digital tickets generated for each pass in an order. 
   Each ticket has a unique secure token and QR code for verification at event entry.
   IDEMPOTENCY: Application logic ensures tickets are only generated once per order.';

