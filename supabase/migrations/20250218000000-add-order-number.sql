-- Migration: Add order_number field to orders table
-- This field provides a random, unique number for each order
-- Used for SMS notifications and easy order reference

-- Add order_number column (nullable initially for existing orders)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'order_number'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN order_number INTEGER;
    
    -- Create unique index (allows NULL for existing orders)
    CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number 
      ON public.orders(order_number) 
      WHERE order_number IS NOT NULL;
  END IF;
END $$;

-- Create a function to generate random unique order numbers
-- Format: 6-digit random number (100000 to 999999)
CREATE OR REPLACE FUNCTION generate_random_order_number()
RETURNS INTEGER AS $$
DECLARE
  new_number INTEGER;
  exists_check INTEGER;
  max_attempts INTEGER := 100; -- Prevent infinite loop
  attempts INTEGER := 0;
BEGIN
  LOOP
    -- Generate random 6-digit number (100000 to 999999)
    new_number := floor(random() * 900000 + 100000)::INTEGER;
    
    -- Check if this number already exists
    SELECT COUNT(*) INTO exists_check
    FROM public.orders
    WHERE order_number = new_number;
    
    -- If number doesn't exist, return it
    IF exists_check = 0 THEN
      RETURN new_number;
    END IF;
    
    -- Prevent infinite loop
    attempts := attempts + 1;
    IF attempts >= max_attempts THEN
      -- Fallback: use timestamp-based number if too many collisions
      new_number := (EXTRACT(EPOCH FROM NOW())::BIGINT % 900000 + 100000)::INTEGER;
      RETURN new_number;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Set default value to use the random function
ALTER TABLE public.orders 
  ALTER COLUMN order_number 
  SET DEFAULT generate_random_order_number();

-- Update existing NULL order_numbers with random numbers
DO $$
DECLARE
  order_record RECORD;
  new_number INTEGER;
BEGIN
  FOR order_record IN 
    SELECT id FROM public.orders WHERE order_number IS NULL
  LOOP
    -- Generate unique random number for each order
    SELECT generate_random_order_number() INTO new_number;
    
    -- Update the order
    UPDATE public.orders 
    SET order_number = new_number 
    WHERE id = order_record.id;
  END LOOP;
END $$;

