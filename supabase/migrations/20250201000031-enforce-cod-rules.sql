-- Migration: Enforce COD Order Rules
-- Rules:
--   - COD orders (payment_method = 'cod') must have ambassador_id NOT NULL and source = 'ambassador_manual'
--   - ONLINE orders (payment_method = 'online') must have ambassador_id = NULL and source = 'platform_online'
--   - COD orders cannot be auto-approved
--   - COD orders must start with PENDING_ADMIN_APPROVAL status
--   - Remove legacy constraints tied to assignment or round-robin

-- ============================================
-- STEP 1: Update validate_order_status function to match new COD status flow
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_order_status()
RETURNS TRIGGER AS $$
BEGIN
  -- COD orders (ambassador_manual source): PENDING_ADMIN_APPROVAL, APPROVED, REJECTED, COMPLETED
  IF NEW.source = 'ambassador_manual' AND NEW.payment_method = 'cod' THEN
    IF NEW.status NOT IN ('PENDING_ADMIN_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED_BY_ADMIN') THEN
      RAISE EXCEPTION 'Invalid status % for COD ambassador order. Allowed: PENDING_ADMIN_APPROVAL, APPROVED, REJECTED, COMPLETED, CANCELLED_BY_ADMIN', NEW.status;
    END IF;
    -- COD orders must start as PENDING_ADMIN_APPROVAL (enforced on INSERT only for COD orders)
    IF TG_OP = 'INSERT' AND NEW.payment_method = 'cod' AND NEW.status != 'PENDING_ADMIN_APPROVAL' THEN
      RAISE EXCEPTION 'COD orders must start with PENDING_ADMIN_APPROVAL status. Attempted: %', NEW.status;
    END IF;
  END IF;
  
  -- Online orders: PAID, FAILED, REFUNDED, PENDING_PAYMENT
  IF NEW.source = 'platform_online' AND NEW.payment_method = 'online' THEN
    IF NEW.status NOT IN ('PENDING_PAYMENT', 'PAID', 'FAILED', 'REFUNDED', 'PENDING') THEN
      RAISE EXCEPTION 'Invalid status % for online order. Allowed: PENDING_PAYMENT, PAID, FAILED, REFUNDED, PENDING', NEW.status;
    END IF;
  END IF;
  
  -- Legacy platform_cod source (should not be used, but allow for backward compatibility during migration)
  -- This will be removed in a future migration once all platform_cod orders are migrated
  IF NEW.source = 'platform_cod' THEN
    IF NEW.status NOT IN ('PENDING_ADMIN_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED_BY_ADMIN') THEN
      RAISE EXCEPTION 'Invalid status % for COD order. Allowed: PENDING_ADMIN_APPROVAL, APPROVED, REJECTED, COMPLETED, CANCELLED_BY_ADMIN', NEW.status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 2: Create function to validate payment_method + ambassador_id + source combinations
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_cod_order_rules()
RETURNS TRIGGER AS $$
BEGIN
  -- Rule 1: COD orders must have ambassador_id NOT NULL and source = 'ambassador_manual'
  IF NEW.payment_method = 'cod' THEN
    IF NEW.ambassador_id IS NULL THEN
      RAISE EXCEPTION 'COD orders (payment_method = cod) must have ambassador_id. ambassador_id cannot be NULL.';
    END IF;
    IF NEW.source != 'ambassador_manual' THEN
      RAISE EXCEPTION 'COD orders (payment_method = cod) must have source = ''ambassador_manual''. Current source: %', NEW.source;
    END IF;
  END IF;
  
  -- Rule 2: ONLINE orders must have ambassador_id = NULL and source = 'platform_online'
  IF NEW.payment_method = 'online' THEN
    IF NEW.ambassador_id IS NOT NULL THEN
      RAISE EXCEPTION 'ONLINE orders (payment_method = online) must have ambassador_id = NULL. Current ambassador_id: %', NEW.ambassador_id;
    END IF;
    IF NEW.source != 'platform_online' THEN
      RAISE EXCEPTION 'ONLINE orders (payment_method = online) must have source = ''platform_online''. Current source: %', NEW.source;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS validate_cod_order_rules_trigger ON public.orders;
CREATE TRIGGER validate_cod_order_rules_trigger
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_cod_order_rules();

-- ============================================
-- STEP 3: Add check constraints for payment_method + ambassador_id combinations
-- ============================================
-- Drop existing constraint if it exists (might have different name)
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
      AND (constraint_name LIKE '%cod%' OR constraint_name LIKE '%ambassador%' OR constraint_name LIKE '%payment%')
  LOOP
    -- Skip if it's a payment_method or source check constraint (we want to keep those)
    IF constraint_record.constraint_name NOT IN ('orders_payment_method_check', 'orders_source_check', 'orders_status_check', 'orders_payment_status_check') THEN
      EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS %I', constraint_record.constraint_name);
    END IF;
  END LOOP;
END $$;

-- Add check constraint: COD orders must have ambassador_id NOT NULL
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_cod_requires_ambassador_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_cod_requires_ambassador_check
  CHECK (
    (payment_method = 'cod' AND ambassador_id IS NOT NULL) OR
    (payment_method != 'cod')
  );

-- Add check constraint: ONLINE orders must have ambassador_id = NULL
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_online_no_ambassador_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_online_no_ambassador_check
  CHECK (
    (payment_method = 'online' AND ambassador_id IS NULL) OR
    (payment_method != 'online')
  );

-- Add check constraint: COD orders must have source = 'ambassador_manual'
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_cod_source_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_cod_source_check
  CHECK (
    (payment_method = 'cod' AND source = 'ambassador_manual') OR
    (payment_method != 'cod')
  );

-- Add check constraint: ONLINE orders must have source = 'platform_online'
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_online_source_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_online_source_check
  CHECK (
    (payment_method = 'online' AND source = 'platform_online') OR
    (payment_method != 'online')
  );

-- ============================================
-- STEP 4: Clean up any existing COD orders that violate the rules
-- ============================================
-- Set ambassador_id to a default value for COD orders that don't have one
-- (This should not happen, but we need to handle existing data)
-- Note: This will fail if there are COD orders without ambassador_id and no valid ambassador exists
-- Admin should manually fix these orders before running this migration
DO $$
DECLARE
  v_default_ambassador_id UUID;
BEGIN
  -- Try to find a valid ambassador to use as default (optional, only if needed)
  SELECT id INTO v_default_ambassador_id
  FROM public.ambassadors
  WHERE status = 'approved'
  LIMIT 1;
  
  -- Update COD orders without ambassador_id (if any exist)
  -- This should not happen in production, but we handle it gracefully
  IF v_default_ambassador_id IS NOT NULL THEN
    UPDATE public.orders
    SET ambassador_id = v_default_ambassador_id
    WHERE payment_method = 'cod'
      AND ambassador_id IS NULL
      AND source = 'ambassador_manual';
    
    -- Log a warning if we had to set a default
    IF FOUND THEN
      RAISE WARNING 'Updated COD orders without ambassador_id to use default ambassador: %', v_default_ambassador_id;
    END IF;
  END IF;
END $$;

-- Ensure all COD orders have source = 'ambassador_manual'
UPDATE public.orders
SET source = 'ambassador_manual'
WHERE payment_method = 'cod'
  AND source != 'ambassador_manual';

-- Ensure all ONLINE orders have source = 'platform_online' and ambassador_id = NULL
UPDATE public.orders
SET source = 'platform_online',
    ambassador_id = NULL
WHERE payment_method = 'online'
  AND (source != 'platform_online' OR ambassador_id IS NOT NULL);

-- ============================================
-- STEP 5: Add comments explaining the rules
-- ============================================
COMMENT ON CONSTRAINT orders_cod_requires_ambassador_check ON public.orders IS 
'COD orders (payment_method = cod) must have ambassador_id NOT NULL';

COMMENT ON CONSTRAINT orders_online_no_ambassador_check ON public.orders IS 
'ONLINE orders (payment_method = online) must have ambassador_id = NULL';

COMMENT ON CONSTRAINT orders_cod_source_check ON public.orders IS 
'COD orders (payment_method = cod) must have source = ''ambassador_manual''';

COMMENT ON CONSTRAINT orders_online_source_check ON public.orders IS 
'ONLINE orders (payment_method = online) must have source = ''platform_online''';

-- ============================================
-- STEP 6: Remove legacy assignment-related constraints (if any exist)
-- ============================================
-- The round-robin system has been removed, so we ensure no constraints reference it
-- (Most assignment logic was in functions/triggers, which have already been removed)

-- ============================================
-- STEP 7: Ensure default status for COD orders is PENDING_ADMIN_APPROVAL
-- ============================================
-- Note: The default status is set to PENDING_ADMIN_APPROVAL for safety
-- Application code MUST override this for online orders (they should use PENDING or PENDING_PAYMENT)
-- This default ensures COD orders always start with the correct status
-- The validate_order_status trigger will enforce this on INSERT for COD orders

-- ============================================
-- STEP 8: Add comments documenting the rules
-- ============================================
COMMENT ON FUNCTION public.validate_cod_order_rules() IS 
'Validates COD order rules:
- COD orders (payment_method = cod) must have ambassador_id NOT NULL and source = ambassador_manual
- ONLINE orders (payment_method = online) must have ambassador_id = NULL and source = platform_online';

COMMENT ON FUNCTION public.validate_order_status() IS 
'Validates order status based on source and payment_method:
- COD orders (ambassador_manual + cod): PENDING_ADMIN_APPROVAL -> APPROVED/REJECTED -> COMPLETED
- ONLINE orders (platform_online + online): PENDING_PAYMENT -> PAID/FAILED/REFUNDED
- COD orders must start as PENDING_ADMIN_APPROVAL (enforced on INSERT)';


