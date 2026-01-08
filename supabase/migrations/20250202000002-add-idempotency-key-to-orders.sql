-- Add idempotency_key column to orders table
-- This prevents duplicate orders from being created if user clicks submit multiple times

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
  END IF;
END $$;

-- Create unique index on idempotency_key (only for non-null values)
-- This prevents duplicate orders with the same idempotency key
DO $$ 
BEGIN
  DROP INDEX IF EXISTS idx_orders_idempotency_key_unique;
  
  -- Create partial unique index (only for non-null values)
  CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key_unique 
    ON public.orders(idempotency_key) 
    WHERE idempotency_key IS NOT NULL;
    
  RAISE NOTICE 'Created unique index on idempotency_key';
EXCEPTION
  WHEN duplicate_table THEN
    RAISE NOTICE 'Index already exists';
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating index: %', SQLERRM;
END $$;

-- Add comment explaining idempotency protection
COMMENT ON COLUMN public.orders.idempotency_key IS 
  'Unique idempotency key to prevent duplicate orders if user submits multiple times. 
   Frontend generates UUID for each order creation request.
   If order with same idempotency_key exists, server returns existing order (idempotent response).';
