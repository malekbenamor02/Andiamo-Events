-- Comprehensive Orders Schema Refactor
-- This migration transforms the orders table into a unified, scalable, production-ready schema
-- with proper foreign keys, multiple pass types support, and source-specific status constraints

-- ============================================
-- STEP 1: Create order_passes table
-- ============================================
-- Create table without foreign key constraint (we'll add it separately to avoid conflicts)
CREATE TABLE IF NOT EXISTS public.order_passes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  pass_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Drop any existing foreign key constraints on order_id (they might have different names)
DO $$ 
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_schema = kcu.constraint_schema
      AND tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_schema = 'public' 
      AND tc.table_name = 'order_passes'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'order_id'
  LOOP
    EXECUTE format('ALTER TABLE public.order_passes DROP CONSTRAINT IF EXISTS %I', constraint_record.constraint_name);
  END LOOP;
END $$;

-- Add foreign key constraint with explicit name (only if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'order_passes' 
    AND constraint_name = 'order_passes_order_id_fkey'
  ) THEN
    ALTER TABLE public.order_passes 
    ADD CONSTRAINT order_passes_order_id_fkey 
    FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_passes_order_id ON public.order_passes(order_id);
CREATE INDEX IF NOT EXISTS idx_order_passes_pass_type ON public.order_passes(pass_type);

-- Trigger for updated_at
CREATE TRIGGER update_order_passes_updated_at
  BEFORE UPDATE ON public.order_passes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.order_passes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public read access for order_passes
CREATE POLICY "Public can view order passes" ON public.order_passes
  FOR SELECT USING (true);

-- RLS Policy: Admins can manage all order passes
CREATE POLICY "Admins can manage all order passes" ON public.order_passes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admins WHERE id = auth.uid()
    )
  );

-- ============================================
-- STEP 2: Add city_id and ville_id columns to orders
-- ============================================
DO $$ 
BEGIN
  -- Add city_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'city_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL;
  END IF;

  -- Add ville_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'ville_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN ville_id UUID REFERENCES public.villes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- STEP 3: Migrate existing city/ville text data to foreign keys
-- ============================================
-- Migrate city text to city_id
UPDATE public.orders o
SET city_id = (
  SELECT id FROM public.cities c 
  WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(o.city))
  LIMIT 1
)
WHERE o.city_id IS NULL AND o.city IS NOT NULL AND o.city != '';

-- Migrate ville text to ville_id (only if city_id is found and ville is specified)
UPDATE public.orders o
SET ville_id = (
  SELECT v.id FROM public.villes v
  WHERE v.city_id = o.city_id
    AND LOWER(TRIM(v.name)) = LOWER(TRIM(o.ville))
  LIMIT 1
)
WHERE o.ville_id IS NULL 
  AND o.ville IS NOT NULL 
  AND o.ville != ''
  AND o.city_id IS NOT NULL;

-- ============================================
-- STEP 4: Migrate existing pass_type data to order_passes table
-- ============================================
-- First, backfill order_passes from existing orders
INSERT INTO public.order_passes (order_id, pass_type, quantity, price, created_at, updated_at)
SELECT 
  o.id,
  o.pass_type,
  COALESCE(o.quantity, 1),
  CASE 
    WHEN o.quantity > 0 THEN o.total_price / NULLIF(o.quantity, 0)
    ELSE o.total_price
  END as price,
  o.created_at,
  o.updated_at
FROM public.orders o
WHERE NOT EXISTS (
  SELECT 1 FROM public.order_passes op 
  WHERE op.order_id = o.id
)
AND o.pass_type IS NOT NULL;

-- ============================================
-- STEP 5: Drop any existing status constraints first
-- ============================================
-- Drop ALL possible status check constraints (they might have different names from previous migrations)
DO $$ 
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'orders'
      AND constraint_type = 'CHECK'
      AND constraint_name LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS %I', constraint_record.constraint_name);
  END LOOP;
END $$;

-- ============================================
-- STEP 6: Update status values to unified system
-- ============================================
-- Normalize all status values and map to new unified values based on source
-- This also validates that existing new statuses match their source
UPDATE public.orders
SET status = CASE
  -- If status is already a valid new status, validate it matches the source
  WHEN status IN ('MANUAL_ACCEPTED', 'MANUAL_COMPLETED') THEN
    CASE 
      WHEN source = 'ambassador_manual' THEN status
      WHEN source = 'platform_cod' THEN 
        CASE WHEN status = 'MANUAL_ACCEPTED' THEN 'PENDING_AMBASSADOR' ELSE 'COMPLETED' END
      WHEN source = 'platform_online' THEN 'PAID'
      ELSE 'PENDING_AMBASSADOR'
    END
  WHEN status IN ('PAID', 'FAILED', 'REFUNDED') THEN
    CASE 
      WHEN source = 'platform_online' THEN status
      WHEN source = 'platform_cod' THEN 'PENDING_AMBASSADOR'
      WHEN source = 'ambassador_manual' THEN 'MANUAL_ACCEPTED'
      ELSE 'PENDING_AMBASSADOR'
    END
  WHEN status IN ('PENDING_AMBASSADOR', 'ASSIGNED', 'ACCEPTED', 'CANCELLED_BY_AMBASSADOR', 'COMPLETED') THEN
    CASE 
      WHEN source = 'platform_cod' THEN status
      WHEN source = 'platform_online' THEN 'PAID'
      WHEN source = 'ambassador_manual' THEN 
        CASE 
          WHEN status IN ('PENDING_AMBASSADOR', 'ASSIGNED', 'ACCEPTED') THEN 'MANUAL_ACCEPTED'
          WHEN status = 'COMPLETED' THEN 'MANUAL_COMPLETED'
          ELSE 'MANUAL_ACCEPTED'
        END
      ELSE status
    END
  -- Map old statuses to new unified statuses based on source
  WHEN LOWER(status) IN ('pending_ambassador') THEN 
    CASE 
      WHEN source = 'platform_cod' THEN 'PENDING_AMBASSADOR'
      WHEN source = 'platform_online' THEN 'PAID'
      WHEN source = 'ambassador_manual' THEN 'MANUAL_ACCEPTED'
      ELSE 'PENDING_AMBASSADOR'
    END
  WHEN LOWER(status) IN ('assigned') THEN 
    CASE 
      WHEN source = 'platform_cod' THEN 'ASSIGNED'
      WHEN source = 'platform_online' THEN 'PAID'
      WHEN source = 'ambassador_manual' THEN 'MANUAL_ACCEPTED'
      ELSE 'ASSIGNED'
    END
  WHEN LOWER(status) IN ('accepted') THEN 
    CASE 
      WHEN source = 'platform_cod' THEN 'ACCEPTED'
      WHEN source = 'platform_online' THEN 'PAID'
      WHEN source = 'ambassador_manual' THEN 'MANUAL_ACCEPTED'
      ELSE 'ACCEPTED'
    END
  WHEN LOWER(status) IN ('cancelled', 'cancelled_by_ambassador') THEN 
    CASE 
      WHEN source = 'platform_cod' THEN 'CANCELLED_BY_AMBASSADOR'
      WHEN source = 'platform_online' THEN 'REFUNDED'
      WHEN source = 'ambassador_manual' THEN 'MANUAL_ACCEPTED'
      ELSE 'CANCELLED_BY_AMBASSADOR'
    END
  WHEN LOWER(status) IN ('completed') THEN 
    CASE 
      WHEN source = 'platform_cod' THEN 'COMPLETED'
      WHEN source = 'platform_online' THEN 'PAID'
      WHEN source = 'ambassador_manual' THEN 'MANUAL_COMPLETED'
      ELSE 'COMPLETED'
    END
  WHEN LOWER(status) IN ('refunded') THEN 
    CASE 
      WHEN source IN ('platform_cod', 'ambassador_manual') THEN 
        CASE WHEN source = 'platform_cod' THEN 'COMPLETED' ELSE 'MANUAL_COMPLETED' END
      WHEN source = 'platform_online' THEN 'REFUNDED'
      ELSE 'REFUNDED'
    END
  WHEN LOWER(status) IN ('fraud_flagged') THEN 
    CASE 
      WHEN source = 'platform_online' THEN 'REFUNDED'
      ELSE 'CANCELLED_BY_AMBASSADOR'
    END
  WHEN LOWER(status) IN ('paid') THEN 
    CASE 
      WHEN source = 'platform_online' THEN 'PAID'
      WHEN source = 'platform_cod' THEN 'PENDING_AMBASSADOR'
      WHEN source = 'ambassador_manual' THEN 'MANUAL_ACCEPTED'
      ELSE 'PENDING_AMBASSADOR'
    END
  WHEN LOWER(status) IN ('failed') THEN 
    CASE 
      WHEN source = 'platform_online' THEN 'FAILED'
      ELSE 'PENDING_AMBASSADOR'
    END
  -- Default fallback: set based on source
  ELSE 
    CASE 
      WHEN source = 'platform_cod' THEN 'PENDING_AMBASSADOR'
      WHEN source = 'platform_online' THEN 'PAID'
      WHEN source = 'ambassador_manual' THEN 'MANUAL_ACCEPTED'
      ELSE 'PENDING_AMBASSADOR'
    END
END
WHERE status IS NOT NULL;

-- ============================================
-- STEP 7: Create new unified status constraints
-- ============================================
-- Constraints have already been dropped in STEP 5, now create the new ones

-- Create a function to validate status based on source
CREATE OR REPLACE FUNCTION public.validate_order_status()
RETURNS TRIGGER AS $$
BEGIN
  -- COD orders: PENDING_AMBASSADOR, ASSIGNED, ACCEPTED, CANCELLED_BY_AMBASSADOR, COMPLETED
  IF NEW.source = 'platform_cod' THEN
    IF NEW.status NOT IN ('PENDING_AMBASSADOR', 'ASSIGNED', 'ACCEPTED', 'CANCELLED_BY_AMBASSADOR', 'COMPLETED') THEN
      RAISE EXCEPTION 'Invalid status % for COD order. Allowed: PENDING_AMBASSADOR, ASSIGNED, ACCEPTED, CANCELLED_BY_AMBASSADOR, COMPLETED', NEW.status;
    END IF;
  END IF;
  
  -- Online orders: PAID, FAILED, REFUNDED
  IF NEW.source = 'platform_online' THEN
    IF NEW.status NOT IN ('PAID', 'FAILED', 'REFUNDED') THEN
      RAISE EXCEPTION 'Invalid status % for online order. Allowed: PAID, FAILED, REFUNDED', NEW.status;
    END IF;
  END IF;
  
  -- Manual orders: MANUAL_ACCEPTED, MANUAL_COMPLETED
  IF NEW.source = 'ambassador_manual' THEN
    IF NEW.status NOT IN ('MANUAL_ACCEPTED', 'MANUAL_COMPLETED') THEN
      RAISE EXCEPTION 'Invalid status % for manual order. Allowed: MANUAL_ACCEPTED, MANUAL_COMPLETED', NEW.status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for source-specific validation (with better error messages)
DROP TRIGGER IF EXISTS validate_order_status_trigger ON public.orders;
CREATE TRIGGER validate_order_status_trigger
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_status();

-- Also add a basic check constraint that allows all valid statuses (for database-level validation)
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
  CHECK (
    status IN (
      -- COD statuses
      'PENDING_AMBASSADOR', 'ASSIGNED', 'ACCEPTED', 'CANCELLED_BY_AMBASSADOR', 'COMPLETED',
      -- Online statuses
      'PAID', 'FAILED', 'REFUNDED',
      -- Manual statuses
      'MANUAL_ACCEPTED', 'MANUAL_COMPLETED'
    )
  );

-- ============================================
-- STEP 8: Ensure payment_status constraint is correct
-- ============================================
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;

ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check 
  CHECK (
    payment_status IS NULL OR payment_status IN ('PENDING_PAYMENT', 'PAID', 'FAILED', 'REFUNDED')
  );

-- ============================================
-- STEP 9: Ensure source constraint is correct
-- ============================================
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_source_check;

ALTER TABLE public.orders ADD CONSTRAINT orders_source_check 
  CHECK (source IN ('platform_online', 'platform_cod', 'ambassador_manual'));

-- ============================================
-- STEP 10: Ensure payment_method constraint is correct
-- ============================================
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check 
  CHECK (payment_method IN ('online', 'cod'));

-- ============================================
-- STEP 11: Set default status (source-dependent status should be set by application)
-- ============================================
-- Set default status to PENDING_AMBASSADOR (works for COD orders)
-- Application code should override with the appropriate status based on source:
-- - platform_cod: PENDING_AMBASSADOR
-- - platform_online: PAID (after payment) or FAILED (if payment fails)
-- - ambassador_manual: MANUAL_ACCEPTED
DO $$ 
BEGIN
  -- Set default to PENDING_AMBASSADOR for backward compatibility
  -- Application should override based on source
  ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'PENDING_AMBASSADOR';
END $$;

-- ============================================
-- STEP 12: Add indexes for city_id and ville_id
-- ============================================
CREATE INDEX IF NOT EXISTS idx_orders_city_id ON public.orders(city_id);
CREATE INDEX IF NOT EXISTS idx_orders_ville_id ON public.orders(ville_id);

-- Ensure all other required indexes exist
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_ambassador_id ON public.orders(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_orders_source ON public.orders(source);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_event_id ON public.orders(event_id);

-- ============================================
-- STEP 13: Update triggers to handle new status values
-- ============================================
-- The existing log_order_action function should still work, but we may need to update it
-- to handle new status values. Let's check and update if needed.

CREATE OR REPLACE FUNCTION public.log_order_action()
RETURNS TRIGGER AS $$
BEGIN
  -- Log status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_logs (order_id, action, performed_by, performed_by_type, details)
    VALUES (
      NEW.id,
      CASE 
        WHEN NEW.status = 'ASSIGNED' THEN 'assigned'
        WHEN NEW.status = 'ACCEPTED' OR NEW.status = 'MANUAL_ACCEPTED' THEN 'accepted'
        WHEN NEW.status = 'CANCELLED_BY_AMBASSADOR' THEN 'cancelled'
        WHEN NEW.status = 'COMPLETED' OR NEW.status = 'MANUAL_COMPLETED' THEN 'completed'
        WHEN NEW.status = 'REFUNDED' THEN 'admin_refunded'
        WHEN NEW.status = 'FAILED' THEN 'status_changed'
        WHEN NEW.status = 'PAID' THEN 'status_changed'
        ELSE 'status_changed'
      END,
      NEW.ambassador_id,
      CASE 
        WHEN NEW.status IN ('MANUAL_ACCEPTED', 'MANUAL_COMPLETED') THEN 'ambassador'
        WHEN NEW.status IN ('ACCEPTED', 'COMPLETED', 'CANCELLED_BY_AMBASSADOR') THEN 'ambassador'
        ELSE 'system'
      END,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'cancellation_reason', NEW.cancellation_reason
      )
    );
  END IF;

  -- Log assignment
  IF OLD.ambassador_id IS DISTINCT FROM NEW.ambassador_id AND NEW.ambassador_id IS NOT NULL THEN
    INSERT INTO public.order_logs (order_id, action, performed_by, performed_by_type, details)
    VALUES (
      NEW.id,
      'assigned',
      NEW.ambassador_id,
      'system',
      jsonb_build_object(
        'old_ambassador_id', OLD.ambassador_id,
        'new_ambassador_id', NEW.ambassador_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 14: Add comments for documentation
-- ============================================
COMMENT ON TABLE public.order_passes IS 'Stores multiple pass types per order, allowing orders to have different pass types with different quantities and prices';
COMMENT ON COLUMN public.orders.city_id IS 'Foreign key to cities table. Replaces the city text field for data consistency.';
COMMENT ON COLUMN public.orders.ville_id IS 'Foreign key to villes table. Replaces the ville text field for data consistency.';
COMMENT ON COLUMN public.orders.status IS 'Order status. Allowed values depend on source: COD (PENDING_AMBASSADOR, ASSIGNED, ACCEPTED, CANCELLED_BY_AMBASSADOR, COMPLETED), Online (PAID, FAILED, REFUNDED), Manual (MANUAL_ACCEPTED, MANUAL_COMPLETED)';
COMMENT ON COLUMN public.orders.payment_status IS 'Payment status for online orders. Allowed: PENDING_PAYMENT, PAID, FAILED, REFUNDED. NULL for COD/manual orders.';

-- ============================================
-- STEP 15: Keep city and ville columns for backward compatibility during migration
-- They can be dropped in a future migration after application code is updated
-- ============================================
-- We keep city and ville as TEXT columns for now to allow gradual migration
-- Application code should be updated to use city_id and ville_id instead

-- ============================================
-- STEP 16: Make pass_type nullable (being replaced by order_passes)
-- ============================================
-- Make pass_type nullable to allow gradual migration to order_passes table
-- New orders should use order_passes table instead of pass_type column
DO $$ 
BEGIN
  -- Make pass_type nullable (if it's currently NOT NULL)
  -- This allows new orders to not have pass_type if they use order_passes instead
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'pass_type'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.orders ALTER COLUMN pass_type DROP NOT NULL;
  END IF;
END $$;

-- Add comment to indicate pass_type is deprecated
COMMENT ON COLUMN public.orders.pass_type IS 'DEPRECATED: Use order_passes table instead. This column is kept for backward compatibility during migration.';

