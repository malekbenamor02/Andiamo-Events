-- Fix pass_type constraint to allow 'mixed' for orders with multiple pass types
-- This migration removes any existing pass_type constraint and allows any TEXT value

-- Drop the constraint if it exists (using IF EXISTS to avoid errors)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_pass_type_check;

-- Also try to drop any other potential pass_type constraints
DO $$ 
DECLARE
  r RECORD;
BEGIN
  -- Find and drop all constraints related to pass_type
  FOR r IN 
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'public.orders'::regclass 
    AND conname LIKE '%pass_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

