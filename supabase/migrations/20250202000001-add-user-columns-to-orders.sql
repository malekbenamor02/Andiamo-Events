-- ============================================
-- Fix Issue #3: Add missing user_name, user_phone, user_email columns to orders
-- ============================================

-- Step 1: Add user_name column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'user_name'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN user_name TEXT;
    RAISE NOTICE 'Added user_name column';
  ELSE
    RAISE NOTICE 'user_name column already exists';
  END IF;
END $$;

-- Step 2: Add user_phone column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'user_phone'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN user_phone TEXT;
    RAISE NOTICE 'Added user_phone column';
  ELSE
    RAISE NOTICE 'user_phone column already exists';
  END IF;
END $$;

-- Step 3: Add user_email column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'user_email'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN user_email TEXT;
    RAISE NOTICE 'Added user_email column';
  ELSE
    RAISE NOTICE 'user_email column already exists';
  END IF;
END $$;

-- Step 4: Migrate data from old columns to new columns (if old columns exist)
DO $$ 
BEGIN
  -- Migrate customer_name -> user_name
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'customer_name'
  ) THEN
    UPDATE public.orders 
    SET user_name = COALESCE(user_name, customer_name, '')
    WHERE user_name IS NULL OR user_name = '';
    RAISE NOTICE 'Migrated customer_name -> user_name';
  END IF;

  -- Migrate phone -> user_phone
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'phone'
  ) THEN
    UPDATE public.orders 
    SET user_phone = COALESCE(user_phone, phone, '')
    WHERE user_phone IS NULL OR user_phone = '';
    RAISE NOTICE 'Migrated phone -> user_phone';
  END IF;

  -- Migrate email -> user_email
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'email'
  ) THEN
    UPDATE public.orders 
    SET user_email = COALESCE(user_email, email)
    WHERE user_email IS NULL;
    RAISE NOTICE 'Migrated email -> user_email';
  END IF;
END $$;

-- Step 5: Set default values for NULL values (safety measure)
UPDATE public.orders 
SET 
  user_name = COALESCE(user_name, ''),
  user_phone = COALESCE(user_phone, '')
WHERE user_name IS NULL OR user_phone IS NULL;

-- Step 6: Make columns NOT NULL after migration (only if all rows have values)
DO $$ 
BEGIN
  -- Check if all rows have user_name
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE user_name IS NULL OR user_name = '') THEN
    ALTER TABLE public.orders ALTER COLUMN user_name SET NOT NULL;
    RAISE NOTICE 'Set user_name to NOT NULL';
  ELSE
    RAISE WARNING 'Cannot set user_name to NOT NULL - some rows have NULL or empty values';
  END IF;

  -- Check if all rows have user_phone
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE user_phone IS NULL OR user_phone = '') THEN
    ALTER TABLE public.orders ALTER COLUMN user_phone SET NOT NULL;
    RAISE NOTICE 'Set user_phone to NOT NULL';
  ELSE
    RAISE WARNING 'Cannot set user_phone to NOT NULL - some rows have NULL or empty values';
  END IF;
END $$;

-- Step 7: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_user_phone ON public.orders(user_phone);
CREATE INDEX IF NOT EXISTS idx_orders_user_email ON public.orders(user_email) WHERE user_email IS NOT NULL;

-- Step 8: Add comments for documentation
COMMENT ON COLUMN public.orders.user_name IS 'Customer name (replaces customer_name). Added in migration 20250202000001.';
COMMENT ON COLUMN public.orders.user_phone IS 'Customer phone (replaces phone). Added in migration 20250202000001.';
COMMENT ON COLUMN public.orders.user_email IS 'Customer email (replaces email). Added in migration 20250202000001.';

