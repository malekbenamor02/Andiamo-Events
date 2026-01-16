-- Restrict Order Expiration to PENDING_CASH Only
-- Auto-set expiration from order creation date
-- Apply/clear expiration to existing orders when settings change
--
-- PRODUCTION-SAFE MIGRATION:
-- - Removes other statuses from expiration settings
-- - Creates trigger to auto-set expiration on PENDING_CASH order creation
-- - Creates functions to apply/clear expiration on existing orders
-- - Idempotent: safe to run multiple times

-- Step 1: Remove PENDING_ONLINE and PENDING_ADMIN_APPROVAL from settings
DELETE FROM public.order_expiration_settings 
WHERE order_status IN ('PENDING_ONLINE', 'PENDING_ADMIN_APPROVAL');

-- Step 2: Update CHECK constraint to only allow PENDING_CASH
ALTER TABLE public.order_expiration_settings 
DROP CONSTRAINT IF EXISTS order_expiration_settings_order_status_check;

ALTER TABLE public.order_expiration_settings 
ADD CONSTRAINT order_expiration_settings_order_status_check 
CHECK (order_status = 'PENDING_CASH');

-- Step 3: Ensure PENDING_CASH setting exists with default
INSERT INTO public.order_expiration_settings (order_status, default_expiration_hours, is_active)
VALUES ('PENDING_CASH', 48, true)
ON CONFLICT (order_status) DO NOTHING;

-- Step 4: Create function to auto-set expiration for PENDING_CASH orders
CREATE OR REPLACE FUNCTION auto_set_pending_cash_expiration()
RETURNS TRIGGER AS $$
DECLARE
  expiration_hours INTEGER;
  setting_active BOOLEAN;
BEGIN
  -- Only process PENDING_CASH orders
  IF NEW.status = 'PENDING_CASH' AND NEW.expires_at IS NULL THEN
    -- Get expiration setting for PENDING_CASH
    SELECT default_expiration_hours, is_active
    INTO expiration_hours, setting_active
    FROM public.order_expiration_settings
    WHERE order_status = 'PENDING_CASH'
    LIMIT 1;
    
    -- If setting exists and is active, set expiration from creation date
    IF setting_active = true AND expiration_hours IS NOT NULL THEN
      NEW.expires_at := NEW.created_at + (expiration_hours || ' hours')::INTERVAL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger to call function on INSERT
DROP TRIGGER IF EXISTS trigger_auto_set_pending_cash_expiration ON public.orders;
CREATE TRIGGER trigger_auto_set_pending_cash_expiration
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_pending_cash_expiration();

-- Step 6: Create function to release stock for an order
CREATE OR REPLACE FUNCTION release_order_stock_internal(order_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  order_record RECORD;
  order_pass_record RECORD;
  updated_count INTEGER;
BEGIN
  -- Check and set stock_released flag atomically
  UPDATE public.orders
  SET stock_released = true
  WHERE id = order_id_param
    AND stock_released = false
  RETURNING id, status INTO order_record;
  
  -- If no rows updated, stock was already released
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Decrement sold_quantity for each pass in order_passes
  FOR order_pass_record IN
    SELECT pass_id, quantity
    FROM public.order_passes
    WHERE order_id = order_id_param
      AND pass_id IS NOT NULL
  LOOP
    -- Atomically decrement sold_quantity (prevent negative values)
    UPDATE public.event_passes
    SET 
      sold_quantity = GREATEST(0, sold_quantity - order_pass_record.quantity),
      updated_at = NOW()
    WHERE id = order_pass_record.pass_id
      AND sold_quantity >= order_pass_record.quantity;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    IF updated_count > 0 THEN
      RAISE NOTICE 'Released % units for pass_id %', order_pass_record.quantity, order_pass_record.pass_id;
    END IF;
  END LOOP;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create function to apply expiration to all existing PENDING_CASH orders
CREATE OR REPLACE FUNCTION apply_expiration_to_existing_pending_cash_orders()
RETURNS TABLE(
  updated_count INTEGER,
  updated_order_ids UUID[]
) AS $$
DECLARE
  expiration_hours INTEGER;
  setting_active BOOLEAN;
  order_record RECORD;
  updated_ids UUID[] := ARRAY[]::UUID[];
  updated_total INTEGER := 0;
BEGIN
  -- Get expiration setting
  SELECT default_expiration_hours, is_active
  INTO expiration_hours, setting_active
  FROM public.order_expiration_settings
  WHERE order_status = 'PENDING_CASH'
  LIMIT 1;
  
  -- Only proceed if setting is active and hours are set
  IF setting_active = true AND expiration_hours IS NOT NULL THEN
    -- Update all PENDING_CASH orders without expiration
    FOR order_record IN
      SELECT id, created_at
      FROM public.orders
      WHERE status = 'PENDING_CASH'
        AND expires_at IS NULL
        AND created_at IS NOT NULL
        AND rejected_at IS NULL
      FOR UPDATE SKIP LOCKED
    LOOP
      UPDATE public.orders
      SET 
        expires_at = order_record.created_at + (expiration_hours || ' hours')::INTERVAL,
        updated_at = NOW()
      WHERE id = order_record.id
        AND status = 'PENDING_CASH'
        AND expires_at IS NULL;
      
      IF FOUND THEN
        updated_ids := array_append(updated_ids, order_record.id);
        updated_total := updated_total + 1;
      END IF;
    END LOOP;
  END IF;
  
  RETURN QUERY SELECT updated_total, updated_ids;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create function to clear expiration from all existing PENDING_CASH orders
CREATE OR REPLACE FUNCTION clear_expiration_from_existing_pending_cash_orders()
RETURNS TABLE(
  cleared_count INTEGER,
  cleared_order_ids UUID[]
) AS $$
DECLARE
  order_record RECORD;
  cleared_ids UUID[] := ARRAY[]::UUID[];
  cleared_total INTEGER := 0;
BEGIN
  -- Clear expiration from all PENDING_CASH orders that have expiration
  FOR order_record IN
    SELECT id
    FROM public.orders
    WHERE status = 'PENDING_CASH'
      AND expires_at IS NOT NULL
      AND rejected_at IS NULL
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.orders
    SET 
      expires_at = NULL,
      expiration_set_by = NULL,
      expiration_notes = NULL,
      updated_at = NOW()
    WHERE id = order_record.id
      AND status = 'PENDING_CASH'
      AND expires_at IS NOT NULL;
    
    IF FOUND THEN
      cleared_ids := array_append(cleared_ids, order_record.id);
      cleared_total := cleared_total + 1;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT cleared_total, cleared_ids;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Create function to auto-reject expired PENDING_CASH orders
CREATE OR REPLACE FUNCTION auto_reject_expired_pending_cash_orders()
RETURNS TABLE(
  rejected_count INTEGER,
  rejected_order_ids UUID[]
) AS $$
DECLARE
  expired_order RECORD;
  rejected_ids UUID[] := ARRAY[]::UUID[];
  rejected_total INTEGER := 0;
  stock_released BOOLEAN;
BEGIN
  -- Find all expired PENDING_CASH orders that haven't been rejected yet
  FOR expired_order IN
    SELECT 
      id,
      expires_at,
      created_at,
      status
    FROM public.orders
    WHERE status = 'PENDING_CASH'
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
      AND rejected_at IS NULL
    ORDER BY expires_at ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      -- Release stock first (before status change)
      SELECT release_order_stock_internal(expired_order.id) INTO stock_released;
      
      -- Update order to REJECTED status
      UPDATE public.orders
      SET 
        status = 'REJECTED',
        rejected_at = NOW(),
        rejection_reason = 'Order expired automatically (expiration time reached)',
        updated_at = NOW()
      WHERE id = expired_order.id
        AND status = 'PENDING_CASH';
      
      -- Only count if status was actually updated
      IF FOUND THEN
        rejected_ids := array_append(rejected_ids, expired_order.id);
        rejected_total := rejected_total + 1;
        
        -- Log the auto-rejection
        INSERT INTO public.order_logs (
          order_id,
          action,
          performed_by,
          performed_by_type,
          details
        ) VALUES (
          expired_order.id,
          'auto_rejected_expired',
          NULL,
          'system',
          jsonb_build_object(
            'reason', 'Order expired automatically',
            'expires_at', expired_order.expires_at,
            'created_at', expired_order.created_at,
            'stock_released', stock_released,
            'auto_action', true
          )
        );
        
        RAISE NOTICE 'Auto-rejected expired order % (expired at %)', expired_order.id, expired_order.expires_at;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue with other orders
      RAISE WARNING 'Error auto-rejecting order %: %', expired_order.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT rejected_total, rejected_ids;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Add comments
COMMENT ON FUNCTION auto_set_pending_cash_expiration() IS 'Automatically sets expiration date for PENDING_CASH orders based on creation date and global settings';
COMMENT ON FUNCTION release_order_stock_internal(UUID) IS 'Internal helper function to release stock for an order. Used by auto-rejection and other cancellation flows.';
COMMENT ON FUNCTION apply_expiration_to_existing_pending_cash_orders() IS 'Applies expiration to all existing PENDING_CASH orders based on their creation date and current expiration settings. Called when admin activates expiration.';
COMMENT ON FUNCTION clear_expiration_from_existing_pending_cash_orders() IS 'Clears expiration from all existing PENDING_CASH orders. Called when admin deactivates expiration.';
COMMENT ON FUNCTION auto_reject_expired_pending_cash_orders() IS 'Automatically rejects expired PENDING_CASH orders. Releases stock and logs the action. Returns count and IDs of rejected orders.';

-- Step 11: Grant execute permissions
GRANT EXECUTE ON FUNCTION auto_set_pending_cash_expiration() TO authenticated;
GRANT EXECUTE ON FUNCTION release_order_stock_internal(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_expiration_to_existing_pending_cash_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION clear_expiration_from_existing_pending_cash_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION auto_reject_expired_pending_cash_orders() TO authenticated;

-- Step 12: Update existing PENDING_CASH orders without expiration (if setting is active)
DO $$
DECLARE
  expiration_hours INTEGER;
  setting_active BOOLEAN;
BEGIN
  -- Get expiration setting
  SELECT default_expiration_hours, is_active
  INTO expiration_hours, setting_active
  FROM public.order_expiration_settings
  WHERE order_status = 'PENDING_CASH'
  LIMIT 1;
  
  -- Update existing PENDING_CASH orders without expiration
  IF setting_active = true AND expiration_hours IS NOT NULL THEN
    UPDATE public.orders
    SET expires_at = created_at + (expiration_hours || ' hours')::INTERVAL
    WHERE status = 'PENDING_CASH'
      AND expires_at IS NULL
      AND created_at IS NOT NULL;
  END IF;
END $$;
