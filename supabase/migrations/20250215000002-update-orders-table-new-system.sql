-- Update orders table for new unified order system
-- Adds: cancelled_by, external_app_reference
-- Updates: status constraint, payment_method constraint

-- Step 1: Add cancelled_by column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'cancelled_by'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN cancelled_by TEXT 
      CHECK (cancelled_by IS NULL OR cancelled_by IN ('admin', 'ambassador', 'system'));
  END IF;
END $$;

-- Step 2: Add external_app_reference column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'external_app_reference'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN external_app_reference TEXT;
  END IF;
END $$;

-- Step 3: Drop existing status constraint and triggers (safe - will be recreated)
DO $$ 
BEGIN
  -- Drop status constraint if it exists
  ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Constraint orders_status_check not found (this is OK)';
END $$;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS validate_order_status_trigger ON public.orders;

-- Step 4: Migrate existing status values to new unified system
-- Map old statuses to new ones
UPDATE public.orders
SET status = CASE
  -- COD orders (platform_cod)
  WHEN source = 'platform_cod' AND status IN ('PENDING_AMBASSADOR', 'ASSIGNED', 'ACCEPTED') THEN 'PENDING_CASH'
  WHEN source = 'platform_cod' AND status = 'COMPLETED' THEN 'PAID'
  WHEN source = 'platform_cod' AND status IN ('CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN') THEN 'CANCELLED'
  
  -- Online orders (platform_online)
  WHEN source = 'platform_online' AND status IN ('PENDING', 'PENDING_PAYMENT') THEN 'PENDING_ONLINE'
  WHEN source = 'platform_online' AND status = 'PAID' THEN 'PAID'
  WHEN source = 'platform_online' AND status = 'FAILED' THEN 'CANCELLED'
  WHEN source = 'platform_online' AND status = 'REFUNDED' THEN 'CANCELLED'
  
  -- Manual orders (ambassador_manual)
  WHEN source = 'ambassador_manual' AND status IN ('MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL') THEN 'PENDING_CASH'
  WHEN source = 'ambassador_manual' AND status = 'MANUAL_COMPLETED' THEN 'PAID'
  
  -- Keep valid new statuses
  WHEN status IN ('PENDING_ONLINE', 'REDIRECTED', 'PENDING_CASH', 'PAID', 'CANCELLED') THEN status
  
  -- Default fallback
  ELSE CASE
    WHEN source = 'platform_online' THEN 'PENDING_ONLINE'
    WHEN source = 'platform_cod' THEN 'PENDING_CASH'
    WHEN source = 'ambassador_manual' THEN 'PENDING_CASH'
    ELSE 'PENDING_CASH'
  END
END;

-- Step 5: Add new status constraint (unified system)
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('PENDING_ONLINE', 'REDIRECTED', 'PENDING_CASH', 'PAID', 'CANCELLED'));

-- Step 6: Update payment_method constraint to include 'external_app' and 'ambassador_cash'
-- Current constraint only allows 'online' and 'cod'
-- New constraint allows 'online', 'external_app', and 'ambassador_cash' (cod is replaced by ambassador_cash)
-- 
-- IMPORTANT: We must drop the constraint, update data, then add new constraint
-- because we can't update 'cod' to 'ambassador_cash' while old constraint exists,
-- and we can't add new constraint while 'cod' values exist

-- Step 6a: Drop existing constraint first
DO $$ 
BEGIN
  -- Drop existing constraint
  ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Constraint orders_payment_method_check not found (this is OK)';
END $$;

-- Step 6b: Update existing 'cod' values to 'ambassador_cash' (now that constraint is dropped)
UPDATE public.orders
SET payment_method = 'ambassador_cash'
WHERE payment_method = 'cod';

-- Step 6c: Add new constraint with updated values (now that all values are valid)
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check 
  CHECK (payment_method IN ('online', 'external_app', 'ambassador_cash'));

-- Step 7: Set cancelled_by for existing cancelled orders (default to 'admin' for old records)
UPDATE public.orders
SET cancelled_by = 'admin'
WHERE status = 'CANCELLED' AND cancelled_by IS NULL;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_orders_cancelled_by ON public.orders(cancelled_by);
CREATE INDEX IF NOT EXISTS idx_orders_external_app_reference ON public.orders(external_app_reference);

-- Add comments
COMMENT ON COLUMN public.orders.cancelled_by IS 'Who cancelled the order: admin, ambassador, or system';
COMMENT ON COLUMN public.orders.external_app_reference IS 'Transaction ID or reference from external payment app';
COMMENT ON COLUMN public.orders.status IS 'Unified order status: PENDING_ONLINE, REDIRECTED, PENDING_CASH, PAID, CANCELLED';
COMMENT ON COLUMN public.orders.payment_method IS 'Payment method: online, external_app, or ambassador_cash';

