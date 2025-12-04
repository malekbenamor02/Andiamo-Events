-- ============================================
-- ALL CRITICAL FIXES - COMBINED MIGRATION
-- Run this in Supabase Dashboard SQL Editor
-- ============================================

-- ============================================
-- MIGRATION 1: Fix pass_purchases to tickets
-- ============================================

-- Step 1: Drop invalid foreign key constraint on scans table
DO $$ 
DECLARE
  constraint_name TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'scans'
  ) THEN
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_schema = kcu.constraint_schema
      AND tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_schema = tc.constraint_schema
      AND ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_schema = 'public' 
      AND tc.table_name = 'scans'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'ticket_id'
      AND ccu.table_name = 'pass_purchases';
    
    IF constraint_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.scans DROP CONSTRAINT IF EXISTS %I', constraint_name);
      RAISE NOTICE 'Dropped invalid foreign key constraint: %', constraint_name;
    END IF;
  END IF;
END $$;

-- Step 2: Ensure scans.ticket_id references tickets table
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'scans'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_schema = kcu.constraint_schema
        AND tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_schema = tc.constraint_schema
        AND ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_schema = 'public' 
        AND tc.table_name = 'scans'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'ticket_id'
        AND ccu.table_name = 'tickets'
    ) THEN
      ALTER TABLE public.scans 
        ADD CONSTRAINT scans_ticket_id_fkey 
        FOREIGN KEY (ticket_id) 
        REFERENCES public.tickets(id) 
        ON DELETE CASCADE;
      RAISE NOTICE 'Added foreign key constraint: scans.ticket_id -> tickets.id';
    END IF;
  END IF;
END $$;

-- Step 3: Drop pass_purchases table if empty
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'pass_purchases'
  ) THEN
    IF EXISTS (SELECT 1 FROM public.pass_purchases LIMIT 1) THEN
      RAISE WARNING 'pass_purchases table exists with data - NOT DROPPING';
    ELSE
      DROP TABLE IF EXISTS public.pass_purchases CASCADE;
      RAISE NOTICE 'Dropped empty pass_purchases table';
    END IF;
  END IF;
END $$;

-- Step 4: Add index and comment (if scans table exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'scans'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_scans_ticket_id ON public.scans(ticket_id);
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'scans' 
      AND column_name = 'ticket_id'
    ) THEN
      COMMENT ON COLUMN public.scans.ticket_id IS 'References tickets.id (not pass_purchases). Updated in migration 20250202000000.';
    END IF;
  END IF;
END $$;

-- ============================================
-- MIGRATION 2: Add user_name, user_phone, user_email columns
-- ============================================

-- Add columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_phone TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Migrate data from old columns
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'customer_name'
  ) THEN
    UPDATE public.orders 
    SET user_name = COALESCE(user_name, customer_name, '')
    WHERE user_name IS NULL OR user_name = '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'phone'
  ) THEN
    UPDATE public.orders 
    SET user_phone = COALESCE(user_phone, phone, '')
    WHERE user_phone IS NULL OR user_phone = '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'email'
  ) THEN
    UPDATE public.orders 
    SET user_email = COALESCE(user_email, email)
    WHERE user_email IS NULL;
  END IF;
END $$;

-- Set defaults
UPDATE public.orders 
SET 
  user_name = COALESCE(user_name, ''),
  user_phone = COALESCE(user_phone, '')
WHERE user_name IS NULL OR user_phone IS NULL;

-- Make NOT NULL (if all rows have values)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE user_name IS NULL OR user_name = '') THEN
    ALTER TABLE public.orders ALTER COLUMN user_name SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE user_phone IS NULL OR user_phone = '') THEN
    ALTER TABLE public.orders ALTER COLUMN user_phone SET NOT NULL;
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_phone ON public.orders(user_phone);
CREATE INDEX IF NOT EXISTS idx_orders_user_email ON public.orders(user_email) WHERE user_email IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.orders.user_name IS 'Customer name (replaces customer_name). Added in migration 20250202000001.';
COMMENT ON COLUMN public.orders.user_phone IS 'Customer phone (replaces phone). Added in migration 20250202000001.';
COMMENT ON COLUMN public.orders.user_email IS 'Customer email (replaces email). Added in migration 20250202000001.';

-- ============================================
-- MIGRATION 3: Fix RLS policies for custom JWT
-- ============================================

-- SCANS TABLE POLICIES (only if table exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'scans'
  ) THEN
    DROP POLICY IF EXISTS "Ambassadors can view their own scans" ON public.scans;
    DROP POLICY IF EXISTS "Ambassadors can insert scans" ON public.scans;
    DROP POLICY IF EXISTS "Admins can view all scans" ON public.scans;
    DROP POLICY IF EXISTS "Admins can manage all scans" ON public.scans;

    CREATE POLICY "Service role can manage scans" ON public.scans
      FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
        OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
      );

    CREATE POLICY "Public can view scans" ON public.scans
      FOR SELECT USING (true);

    CREATE POLICY "Public can insert scans" ON public.scans
      FOR INSERT WITH CHECK (true);
    
    RAISE NOTICE 'Updated scans table RLS policies';
  ELSE
    RAISE NOTICE 'scans table does not exist - skipping RLS policy updates';
  END IF;
END $$;

-- AMBASSADORS TABLE POLICIES
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ambassadors'
  ) THEN
    DROP POLICY IF EXISTS "Ambassadors can view own data" ON public.ambassadors;
    DROP POLICY IF EXISTS "Anyone can insert ambassador applications" ON public.ambassadors;
    DROP POLICY IF EXISTS "Ambassadors can update own data" ON public.ambassadors;
    DROP POLICY IF EXISTS "Admin can view all ambassadors" ON public.ambassadors;

    CREATE POLICY "Service role can manage ambassadors" ON public.ambassadors
      FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
        OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
      );

    CREATE POLICY "Public can view ambassadors" ON public.ambassadors
      FOR SELECT USING (true);

    CREATE POLICY "Public can insert ambassadors" ON public.ambassadors
      FOR INSERT WITH CHECK (true);

    CREATE POLICY "Public can update ambassadors" ON public.ambassadors
      FOR UPDATE USING (true);
    
    RAISE NOTICE 'Updated ambassadors table RLS policies';
  END IF;
END $$;

-- CLIENTS TABLE POLICIES
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'clients'
  ) THEN
    DROP POLICY IF EXISTS "Ambassadors can view own clients" ON public.clients;
    DROP POLICY IF EXISTS "Ambassadors can insert own clients" ON public.clients;
    DROP POLICY IF EXISTS "Admin can view all clients" ON public.clients;

    CREATE POLICY "Service role can manage clients" ON public.clients
      FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
        OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
      );

    CREATE POLICY "Public can view clients" ON public.clients
      FOR SELECT USING (true);

    CREATE POLICY "Public can insert clients" ON public.clients
      FOR INSERT WITH CHECK (true);
    
    RAISE NOTICE 'Updated clients table RLS policies';
  END IF;
END $$;

-- AMBASSADOR_EVENTS TABLE POLICIES
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ambassador_events'
  ) THEN
    DROP POLICY IF EXISTS "Admin can view all ambassador events" ON public.ambassador_events;

    CREATE POLICY "Service role can manage ambassador_events" ON public.ambassador_events
      FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
        OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
      );

    CREATE POLICY "Public can view ambassador_events" ON public.ambassador_events
      FOR SELECT USING (true);
    
    RAISE NOTICE 'Updated ambassador_events table RLS policies';
  END IF;
END $$;

-- AMBASSADOR_PERFORMANCE TABLE POLICIES
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ambassador_performance'
  ) THEN
    DROP POLICY IF EXISTS "Admin can view all ambassador performance" ON public.ambassador_performance;

    CREATE POLICY "Service role can manage ambassador_performance" ON public.ambassador_performance
      FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
        OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
      );

    CREATE POLICY "Public can view ambassador_performance" ON public.ambassador_performance
      FOR SELECT USING (true);
    
    RAISE NOTICE 'Updated ambassador_performance table RLS policies';
  END IF;
END $$;

-- EMAIL_TRACKING TABLE POLICIES
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'email_tracking'
  ) THEN
    DROP POLICY IF EXISTS "Admins can view all email tracking" ON public.email_tracking;
    DROP POLICY IF EXISTS "Ambassadors can view their own email tracking" ON public.email_tracking;

    CREATE POLICY "Service role can manage email_tracking" ON public.email_tracking
      FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
        OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
      );

    CREATE POLICY "Public can view email_tracking" ON public.email_tracking
      FOR SELECT USING (true);
    
    RAISE NOTICE 'Updated email_tracking table RLS policies';
  END IF;
END $$;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

SELECT 'All migrations completed successfully!' AS status;

