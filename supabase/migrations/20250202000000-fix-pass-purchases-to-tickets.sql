-- ============================================
-- Fix Issue #1: Replace pass_purchases with tickets table
-- ============================================

-- Step 1: Drop invalid foreign key constraint on scans table
-- (if it exists, it references non-existent pass_purchases table)
-- Only proceed if scans table exists
DO $$ 
DECLARE
  constraint_name TEXT;
BEGIN
  -- First check if scans table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'scans'
  ) THEN
    -- Find the constraint name by checking referenced table via constraint_column_usage
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
    
    -- Drop it if found
    IF constraint_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.scans DROP CONSTRAINT IF EXISTS %I', constraint_name);
      RAISE NOTICE 'Dropped invalid foreign key constraint: %', constraint_name;
    ELSE
      -- Also try to drop any constraint on ticket_id (in case referenced table check fails)
      -- This is a fallback to ensure we clean up any invalid constraints
      FOR constraint_name IN
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_schema = kcu.constraint_schema
          AND tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_schema = 'public' 
          AND tc.table_name = 'scans'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'ticket_id'
      LOOP
        -- Try to drop, but ignore errors if constraint doesn't exist or is valid
        BEGIN
          EXECUTE format('ALTER TABLE public.scans DROP CONSTRAINT IF EXISTS %I', constraint_name);
          RAISE NOTICE 'Dropped foreign key constraint on ticket_id: %', constraint_name;
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'Could not drop constraint % (may be valid): %', constraint_name, SQLERRM;
        END;
      END LOOP;
    END IF;
  ELSE
    RAISE NOTICE 'scans table does not exist yet - skipping constraint drop';
  END IF;
END $$;

-- Step 2: Ensure scans.ticket_id references tickets table
-- Check if constraint already exists with correct reference
-- Only proceed if scans table exists
DO $$ 
BEGIN
  -- First check if scans table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'scans'
  ) THEN
    -- Check if correct constraint exists
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
      -- Add correct foreign key constraint
      ALTER TABLE public.scans 
        ADD CONSTRAINT scans_ticket_id_fkey 
        FOREIGN KEY (ticket_id) 
        REFERENCES public.tickets(id) 
        ON DELETE CASCADE;
      
      RAISE NOTICE 'Added foreign key constraint: scans.ticket_id -> tickets.id';
    ELSE
      RAISE NOTICE 'Foreign key constraint already exists correctly';
    END IF;
  ELSE
    RAISE NOTICE 'scans table does not exist yet - skipping foreign key constraint creation';
  END IF;
END $$;

-- Step 3: Drop pass_purchases table if it exists (legacy table)
-- WARNING: Only drop if table is empty or you're sure it's not needed
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'pass_purchases'
  ) THEN
    -- Check if table has data
    IF EXISTS (SELECT 1 FROM public.pass_purchases LIMIT 1) THEN
      RAISE WARNING 'pass_purchases table exists with data - NOT DROPPING. Please migrate data manually.';
    ELSE
      DROP TABLE IF EXISTS public.pass_purchases CASCADE;
      RAISE NOTICE 'Dropped empty pass_purchases table';
    END IF;
  ELSE
    RAISE NOTICE 'pass_purchases table does not exist - nothing to drop';
  END IF;
END $$;

-- Step 4: Verify scans table structure
-- Ensure ticket_id column exists and is correct type
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scans' 
    AND column_name = 'ticket_id'
  ) THEN
    ALTER TABLE public.scans ADD COLUMN ticket_id UUID;
    RAISE NOTICE 'Added ticket_id column to scans table';
  END IF;
END $$;

-- Step 5: Add index for performance (if not exists and table exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'scans'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_scans_ticket_id ON public.scans(ticket_id);
    RAISE NOTICE 'Created index idx_scans_ticket_id';
  ELSE
    RAISE NOTICE 'scans table does not exist - skipping index creation';
  END IF;
END $$;

-- Step 6: Add comment for documentation (if table exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'scans'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scans' 
    AND column_name = 'ticket_id'
  ) THEN
    COMMENT ON COLUMN public.scans.ticket_id IS 'References tickets.id (not pass_purchases). Updated in migration 20250202000000.';
    RAISE NOTICE 'Added comment to scans.ticket_id';
  ELSE
    RAISE NOTICE 'scans table or ticket_id column does not exist - skipping comment';
  END IF;
END $$;

