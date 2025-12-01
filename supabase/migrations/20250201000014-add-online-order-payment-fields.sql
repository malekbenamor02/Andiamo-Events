-- Add payment status and payment gateway fields for online orders
-- This migration adds fields to support online payment processing

-- Add payment_status column for online orders
-- Values: PENDING_PAYMENT, PAID, FAILED, REFUNDED
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN payment_status TEXT;
    
    -- Set default payment_status for online orders
    -- ALL online orders default to PENDING_PAYMENT (no payment gateway yet)
    -- Admin must manually update to PAID, FAILED, or REFUNDED
    UPDATE public.orders 
    SET payment_status = 'PENDING_PAYMENT' 
    WHERE source = 'platform_online' AND payment_status IS NULL;
    
    -- Add check constraint for payment_status
    ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check 
      CHECK (payment_status IS NULL OR payment_status IN ('PENDING_PAYMENT', 'PAID', 'FAILED', 'REFUNDED'));
  END IF;
END $$;

-- Add payment_gateway_reference column (e.g., transaction ID from payment gateway)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'payment_gateway_reference'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN payment_gateway_reference TEXT;
  END IF;
END $$;

-- Add payment_response_data column (JSONB for storing full payment gateway response)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'payment_response_data'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN payment_response_data JSONB;
  END IF;
END $$;

-- Add transaction_id column (alternative transaction identifier)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'transaction_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN transaction_id TEXT;
  END IF;
END $$;

-- Create indexes for online order queries
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_gateway_reference ON public.orders(payment_gateway_reference);
CREATE INDEX IF NOT EXISTS idx_orders_transaction_id ON public.orders(transaction_id);
CREATE INDEX IF NOT EXISTS idx_orders_source_payment_status ON public.orders(source, payment_status);

-- Update existing online orders to have PENDING_PAYMENT status if they don't have one
UPDATE public.orders 
SET payment_status = 'PENDING_PAYMENT' 
WHERE source = 'platform_online' 
  AND payment_status IS NULL;


