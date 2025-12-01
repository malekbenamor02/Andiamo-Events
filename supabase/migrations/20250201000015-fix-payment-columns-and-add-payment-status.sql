-- Fix payment columns and add payment_status
-- This migration handles the actual database structure where 'pay' column exists
-- and adds the payment_status column for online orders

-- First, check if 'pay' column exists and rename it to 'payment_method' if needed
DO $$ 
BEGIN
  -- If 'pay' column exists, rename it to 'payment_method' for consistency
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'pay'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE public.orders RENAME COLUMN pay TO payment_method;
    RAISE NOTICE 'Renamed pay column to payment_method';
  END IF;

  -- Update payment_method values: 'coc' -> 'cod', 'onl' -> 'online'
  UPDATE public.orders 
  SET payment_method = CASE 
    WHEN payment_method = 'coc' THEN 'cod'
    WHEN payment_method = 'onl' THEN 'online'
    ELSE payment_method
  END
  WHERE payment_method IN ('coc', 'onl');
END $$;

-- Add payment_method column if it doesn't exist (and 'pay' doesn't exist either)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'payment_method'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'pay'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN payment_method TEXT;
    -- Set default based on source
    UPDATE public.orders 
    SET payment_method = CASE 
      WHEN source = 'platform_online' THEN 'online'
      WHEN source = 'platform_cod' THEN 'cod'
      ELSE 'cod'
    END
    WHERE payment_method IS NULL;
  END IF;
END $$;

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
    -- ALL online orders start as PENDING_PAYMENT until payment gateway is integrated
    -- Admin can manually update to PAID, FAILED, or REFUNDED
    UPDATE public.orders 
    SET payment_status = 'PENDING_PAYMENT'
    WHERE source = 'platform_online' AND payment_status IS NULL;
    
    -- Add check constraint for payment_status
    ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check 
      CHECK (payment_status IS NULL OR payment_status IN ('PENDING_PAYMENT', 'PAID', 'FAILED', 'REFUNDED'));
  END IF;
END $$;

-- Add payment_gateway_reference column if it doesn't exist
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

-- Add payment_response_data column if it doesn't exist
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

-- Add transaction_id column if it doesn't exist
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


