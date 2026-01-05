-- Migration: Fix order_number sequence to avoid duplicate key errors
-- This migration resets the sequence to start after the maximum existing order_number

-- Get the maximum order_number and set sequence to start after it
DO $$
DECLARE
  max_order_number INTEGER;
BEGIN
  -- Get the maximum order_number from existing orders
  SELECT COALESCE(MAX(order_number), 999) INTO max_order_number
  FROM public.orders
  WHERE order_number IS NOT NULL;
  
  -- Reset the sequence to start after the maximum
  -- Add 1 to ensure next value is unique
  EXECUTE format('ALTER SEQUENCE order_number_seq RESTART WITH %s', max_order_number + 1);
  
  RAISE NOTICE 'Sequence order_number_seq reset to start at %', max_order_number + 1;
END $$;

