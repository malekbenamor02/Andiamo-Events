-- Remove duplicate/unused columns from orders table
-- We're using user_name, user_phone, user_email instead of customer_name, phone, email
-- We're using payment_method instead of payment_type (they're duplicates)
-- We keep payment_reference for storing transaction IDs/payment gateway references

DO $$ 
BEGIN
  -- Drop customer_name column if it exists (we use user_name instead)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'customer_name'
  ) THEN
    ALTER TABLE public.orders DROP COLUMN customer_name;
    RAISE NOTICE 'Dropped customer_name column';
  END IF;

  -- Drop phone column if it exists (we use user_phone instead)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.orders DROP COLUMN phone;
    RAISE NOTICE 'Dropped phone column';
  END IF;

  -- Drop email column if it exists (we use user_email instead)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'email'
  ) THEN
    ALTER TABLE public.orders DROP COLUMN email;
    RAISE NOTICE 'Dropped email column';
  END IF;

  -- Drop payment_type column if it exists (we use payment_method instead - they're duplicates)
  -- payment_method is more standard naming and is already NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'payment_type'
  ) THEN
    ALTER TABLE public.orders DROP COLUMN payment_type;
    RAISE NOTICE 'Dropped payment_type column (using payment_method instead)';
  END IF;

END $$;

