-- Fix orders table structure - ensure all required columns exist
-- This migration ensures the orders table has all necessary columns

DO $$ 
BEGIN
  -- Add customer_name if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'customer_name'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN customer_name TEXT NOT NULL DEFAULT '';
  END IF;

  -- Add phone if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN phone TEXT NOT NULL DEFAULT '';
  END IF;

  -- Add email if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'email'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN email TEXT;
  END IF;

  -- Add city if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'city'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN city TEXT NOT NULL DEFAULT '';
  END IF;

  -- Add ville if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'ville'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN ville TEXT;
  END IF;

  -- Add source if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'source'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN source TEXT NOT NULL DEFAULT 'platform_cod';
    ALTER TABLE public.orders ADD CONSTRAINT orders_source_check 
      CHECK (source IN ('platform_cod', 'platform_online', 'ambassador_manual'));
  END IF;

  -- Add ambassador_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'ambassador_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN ambassador_id UUID REFERENCES public.ambassadors(id) ON DELETE SET NULL;
  END IF;

  -- Add pass_type if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'pass_type'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN pass_type TEXT NOT NULL DEFAULT 'standard';
  END IF;

  -- Add quantity if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'quantity'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE public.orders ADD CONSTRAINT orders_quantity_check CHECK (quantity > 0);
  END IF;

  -- Add total_price if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'total_price'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN total_price DECIMAL(10,2) NOT NULL DEFAULT 0;
    ALTER TABLE public.orders ADD CONSTRAINT orders_total_price_check CHECK (total_price >= 0);
  END IF;

  -- Add status if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN status TEXT NOT NULL DEFAULT 'pending_ambassador';
    ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
      CHECK (status IN ('pending_ambassador', 'assigned', 'accepted', 'cancelled', 'completed', 'refunded', 'fraud_flagged'));
  END IF;

  -- Add cancellation_reason if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'cancellation_reason'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN cancellation_reason TEXT;
  END IF;

  -- Add timestamp columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'assigned_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN assigned_at TIMESTAMP WITH TIME ZONE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'accepted_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN accepted_at TIMESTAMP WITH TIME ZONE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN cancelled_at TIMESTAMP WITH TIME ZONE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;

END $$;

-- Refresh the schema cache by running a simple query
SELECT 1 FROM public.orders LIMIT 1;




