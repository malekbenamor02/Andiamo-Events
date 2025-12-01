-- Quick fix: Add is_test columns if they don't exist
-- This ensures the columns are added even if the previous migration wasn't applied

-- Add is_test to ambassadors if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ambassadors' 
    AND column_name = 'is_test'
  ) THEN
    ALTER TABLE public.ambassadors ADD COLUMN is_test BOOLEAN DEFAULT FALSE NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_ambassadors_is_test ON public.ambassadors(is_test);
    RAISE NOTICE 'Added is_test column to ambassadors table';
  END IF;
END $$;

-- Add is_test to orders if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'is_test'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN is_test BOOLEAN DEFAULT FALSE NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_orders_is_test ON public.orders(is_test);
    RAISE NOTICE 'Added is_test column to orders table';
  END IF;
END $$;

-- Ensure test_mode_settings exists in site_content
INSERT INTO site_content (key, content) VALUES 
('test_mode_settings', '{"enabled": false, "auto_simulation": false}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  content = EXCLUDED.content,
  updated_at = now();


