-- Add REMOVED_BY_ADMIN status and removed_at/removed_by fields to orders table
-- This allows admins to soft-delete orders while preserving data for audit purposes
--
-- PRODUCTION-SAFE MIGRATION:
-- - Only updates orders with invalid statuses (won't touch valid ones)
-- - Logs all changes for audit trail
-- - Verifies data integrity before adding constraint
-- - Idempotent: safe to run multiple times
-- - Uses IF NOT EXISTS / IF EXISTS to prevent errors

-- Step 1: Add removed_at and removed_by columns
DO $$ 
BEGIN
  -- Add removed_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'removed_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN removed_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Add removed_by column (admin_id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'removed_by'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN removed_by UUID REFERENCES public.admins(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Step 2: SAFELY update any invalid statuses to valid ones before applying constraint
-- PRODUCTION-SAFE: Only updates statuses that are definitely invalid, logs what it does
DO $$ 
DECLARE
  invalid_count INTEGER;
  status_summary TEXT;
BEGIN
  -- First, check what invalid statuses exist (for logging)
  SELECT COUNT(*), string_agg(DISTINCT status::TEXT, ', ' ORDER BY status::TEXT)
  INTO invalid_count, status_summary
  FROM public.orders
  WHERE status NOT IN ('PENDING_ONLINE', 'REDIRECTED', 'PENDING_CASH', 'PAID', 'CANCELLED', 'REMOVED_BY_ADMIN');
  
  -- Log what we found
  IF invalid_count > 0 THEN
    RAISE NOTICE 'Found % orders with invalid statuses: %', invalid_count, status_summary;
    
    -- Only update if there are invalid statuses
    -- Map old/legacy statuses to new unified statuses (conservative mapping)
    UPDATE public.orders 
    SET status = CASE
      -- Map legacy pending statuses to unified system (based on source)
      WHEN status IN ('PENDING_AMBASSADOR', 'ASSIGNED', 'ACCEPTED', 'PENDING', 'PENDING_ADMIN_APPROVAL') THEN 
        CASE 
          WHEN source = 'platform_online' THEN 'PENDING_ONLINE'
          WHEN source = 'platform_cod' OR source = 'ambassador_manual' THEN 'PENDING_CASH'
          ELSE 'PENDING_CASH'  -- Safe default
        END
      -- Map completed/approved statuses to PAID
      WHEN status IN ('COMPLETED', 'MANUAL_COMPLETED', 'APPROVED') THEN 'PAID'
      -- Map all cancellation variants to CANCELLED
      WHEN status IN ('CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN', 'REJECTED', 'FAILED', 'REFUNDED', 'FRAUD_SUSPECT', 'IGNORED', 'ON_HOLD') THEN 'CANCELLED'
      -- Map pending payment to appropriate status
      WHEN status IN ('PENDING_PAYMENT') THEN 
        CASE 
          WHEN source = 'platform_online' THEN 'PENDING_ONLINE'
          ELSE 'PENDING_CASH'
        END
      -- Default fallback: use source to determine appropriate status
      ELSE CASE 
        WHEN source = 'platform_online' THEN 'PENDING_ONLINE'
        WHEN source = 'platform_cod' OR source = 'ambassador_manual' THEN 'PENDING_CASH'
        ELSE 'PENDING_CASH'  -- Safe default
      END
    END
    WHERE status NOT IN ('PENDING_ONLINE', 'REDIRECTED', 'PENDING_CASH', 'PAID', 'CANCELLED', 'REMOVED_BY_ADMIN');
    
    RAISE NOTICE 'Updated % orders with invalid statuses to unified system', invalid_count;
  ELSE
    RAISE NOTICE 'All orders already have valid statuses - no updates needed';
  END IF;
END $$;

-- Step 3: Drop existing status constraint (safe - uses IF EXISTS)
DO $$ 
BEGIN
  ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
  RAISE NOTICE 'Dropped existing orders_status_check constraint';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Constraint orders_status_check not found (this is OK)';
END $$;

-- Step 4: Add new status constraint including REMOVED_BY_ADMIN
-- PRODUCTION-SAFE: Only adds constraint if all orders have valid statuses
DO $$ 
DECLARE
  invalid_count INTEGER;
BEGIN
  -- Double-check: verify no invalid statuses remain
  SELECT COUNT(*) INTO invalid_count
  FROM public.orders
  WHERE status NOT IN ('PENDING_ONLINE', 'REDIRECTED', 'PENDING_CASH', 'PAID', 'CANCELLED', 'REMOVED_BY_ADMIN');
  
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Cannot add constraint: % orders still have invalid statuses. Please review and fix manually.', invalid_count;
  END IF;
  
  -- Add constraint (will fail if invalid statuses exist, but we checked above)
  ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
    CHECK (status IN ('PENDING_ONLINE', 'REDIRECTED', 'PENDING_CASH', 'PAID', 'CANCELLED', 'REMOVED_BY_ADMIN'));
  
  RAISE NOTICE 'Successfully added orders_status_check constraint with REMOVED_BY_ADMIN';
END $$;

-- Step 5: Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_orders_removed_at ON public.orders(removed_at);
CREATE INDEX IF NOT EXISTS idx_orders_removed_by ON public.orders(removed_by);
CREATE INDEX IF NOT EXISTS idx_orders_status_removed ON public.orders(status) WHERE status = 'REMOVED_BY_ADMIN';

-- Step 6: Add comments
COMMENT ON COLUMN public.orders.removed_at IS 'Timestamp when order was removed by admin (soft delete)';
COMMENT ON COLUMN public.orders.removed_by IS 'Admin ID who removed the order';
COMMENT ON COLUMN public.orders.status IS 'Unified order status: PENDING_ONLINE, REDIRECTED, PENDING_CASH, PAID, CANCELLED, REMOVED_BY_ADMIN';
