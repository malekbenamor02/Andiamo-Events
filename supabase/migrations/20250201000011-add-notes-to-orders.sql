-- Add notes column to orders table for storing JSON data (multiple pass types, etc.)

DO $$ 
BEGIN
  -- Add notes column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'notes'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN notes TEXT;
    COMMENT ON COLUMN public.orders.notes IS 'JSON string storing additional order data like multiple pass types, payment gateway info, etc.';
  END IF;
END $$;




