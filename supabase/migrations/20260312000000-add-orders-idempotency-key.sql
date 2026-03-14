-- Add idempotency_key to orders for duplicate order creation prevention
-- Client sends idempotencyKey; server returns existing order if key was already used

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN idempotency_key TEXT UNIQUE;
    CREATE INDEX IF NOT EXISTS idx_orders_idempotency_key
      ON public.orders(idempotency_key)
      WHERE idempotency_key IS NOT NULL;
    RAISE NOTICE 'Added idempotency_key column to orders';
  ELSE
    RAISE NOTICE 'Column orders.idempotency_key already exists';
  END IF;
END $$;

COMMENT ON COLUMN public.orders.idempotency_key IS 'Client-supplied key for idempotent order creation. Duplicate key returns existing order.';
