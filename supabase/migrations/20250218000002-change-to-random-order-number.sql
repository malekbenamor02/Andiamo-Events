-- Migration: Change order_number from sequential to random
-- This migration replaces the sequence with a random number generator function

-- Create a function to generate random unique order numbers
-- (We create the function first before removing the sequence dependency)
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

-- First, remove the sequence dependency by changing the default value
ALTER TABLE public.orders 
  ALTER COLUMN order_number 
  SET DEFAULT generate_random_order_number();

-- Now we can safely drop the sequence (no longer in use)
DROP SEQUENCE IF EXISTS order_number_seq;

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

