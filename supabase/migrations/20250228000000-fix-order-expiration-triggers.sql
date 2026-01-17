-- Fix Order Expiration Triggers
-- Ensures new PENDING_CASH orders get expiration dates when feature is active
-- Also handles UPDATEs in case order status changes to PENDING_CASH
--
-- PRODUCTION-SAFE MIGRATION:
-- - Improves trigger to handle NULL settings gracefully
-- - Adds UPDATE trigger for edge cases
-- - Idempotent: safe to run multiple times

-- Step 1: Improve the INSERT trigger function to handle NULL settings better
CREATE OR REPLACE FUNCTION auto_set_pending_cash_expiration()
RETURNS TRIGGER AS $$
DECLARE
  expiration_hours INTEGER;
  setting_active BOOLEAN;
BEGIN
  -- Only process PENDING_CASH orders that don't have expiration set
  IF NEW.status = 'PENDING_CASH' AND NEW.expires_at IS NULL THEN
    -- Get expiration setting for PENDING_CASH
    SELECT default_expiration_hours, is_active
    INTO expiration_hours, setting_active
    FROM public.order_expiration_settings
    WHERE order_status = 'PENDING_CASH'
    LIMIT 1;
    
    -- If setting exists, is active, and has valid hours, set expiration from creation date
    -- Handle case where setting doesn't exist (both will be NULL)
    IF setting_active = true AND expiration_hours IS NOT NULL AND expiration_hours > 0 THEN
      -- Use COALESCE to handle case where created_at might be NULL (shouldn't happen, but safe)
      NEW.expires_at := COALESCE(NEW.created_at, NOW()) + (expiration_hours || ' hours')::INTERVAL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create UPDATE trigger function to handle status changes to PENDING_CASH
CREATE OR REPLACE FUNCTION auto_set_pending_cash_expiration_on_update()
RETURNS TRIGGER AS $$
DECLARE
  expiration_hours INTEGER;
  setting_active BOOLEAN;
BEGIN
  -- Only process when status changes TO PENDING_CASH and expiration is not set
  IF NEW.status = 'PENDING_CASH' 
     AND (OLD.status IS NULL OR OLD.status != 'PENDING_CASH')
     AND NEW.expires_at IS NULL THEN
    -- Get expiration setting for PENDING_CASH
    SELECT default_expiration_hours, is_active
    INTO expiration_hours, setting_active
    FROM public.order_expiration_settings
    WHERE order_status = 'PENDING_CASH'
    LIMIT 1;
    
    -- If setting exists, is active, and has valid hours, set expiration from creation date
    IF setting_active = true AND expiration_hours IS NOT NULL AND expiration_hours > 0 THEN
      -- Use creation date or current time if created_at is NULL
      NEW.expires_at := COALESCE(NEW.created_at, NOW()) + (expiration_hours || ' hours')::INTERVAL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Ensure INSERT trigger exists (idempotent)
DROP TRIGGER IF EXISTS trigger_auto_set_pending_cash_expiration ON public.orders;
CREATE TRIGGER trigger_auto_set_pending_cash_expiration
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_pending_cash_expiration();

-- Step 4: Create UPDATE trigger (idempotent)
DROP TRIGGER IF EXISTS trigger_auto_set_pending_cash_expiration_on_update ON public.orders;
CREATE TRIGGER trigger_auto_set_pending_cash_expiration_on_update
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_pending_cash_expiration_on_update();

-- Step 5: Add comments
COMMENT ON FUNCTION auto_set_pending_cash_expiration() IS 'Automatically sets expiration date for new PENDING_CASH orders based on creation date and global settings. Only sets expiration if feature is active.';
COMMENT ON FUNCTION auto_set_pending_cash_expiration_on_update() IS 'Automatically sets expiration date when order status changes to PENDING_CASH. Only sets expiration if feature is active and expiration is not already set.';
COMMENT ON TRIGGER trigger_auto_set_pending_cash_expiration ON public.orders IS 'Trigger that automatically sets expiration date for new PENDING_CASH orders when expiration feature is active.';
COMMENT ON TRIGGER trigger_auto_set_pending_cash_expiration_on_update ON public.orders IS 'Trigger that automatically sets expiration date when order status changes to PENDING_CASH and expiration feature is active.';
