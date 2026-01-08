-- QUICK FIX: Add idempotency_key column to orders table
-- Copy and paste this into Supabase SQL Editor and run it

-- Add idempotency_key column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN idempotency_key UUID;
    RAISE NOTICE 'Added idempotency_key column to orders table';
  ELSE
    RAISE NOTICE 'idempotency_key column already exists';
  END IF;
END $$;

-- Create unique index on idempotency_key (only for non-null values)
DROP INDEX IF EXISTS idx_orders_idempotency_key_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key_unique 
  ON public.orders(idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.orders.idempotency_key IS 
  'Unique idempotency key to prevent duplicate orders if user submits multiple times. 
   Frontend generates UUID for each order creation request.
   If order with same idempotency_key exists, server returns existing order (idempotent response).';
