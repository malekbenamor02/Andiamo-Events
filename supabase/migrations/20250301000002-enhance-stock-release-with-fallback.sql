-- Enhance stock release to handle orders without pass_id
-- Adds fallback logic to match by pass_type if pass_id is NULL
-- Also adds database trigger as safety net
--
-- PRODUCTION-SAFE MIGRATION:
-- - Enhances release_order_stock_internal() function
-- - Adds database trigger to ensure stock release on status change
-- - Idempotent: safe to run multiple times
--
-- Date: 2025-03-01
-- Issue: Stock release fails silently if pass_id is NULL

-- ============================================
-- STEP 1: Enhance release_order_stock_internal() function
-- ============================================

CREATE OR REPLACE FUNCTION release_order_stock_internal(order_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  order_record RECORD;
  order_pass_record RECORD;
  pass_id_found UUID;
  updated_count INTEGER;
  total_released INTEGER := 0;
BEGIN
  -- Check and set stock_released flag atomically
  UPDATE public.orders
  SET stock_released = true
  WHERE id = order_id_param
    AND stock_released = false
  RETURNING id, status, event_id INTO order_record;
  
  -- If no rows updated, stock was already released
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Decrement sold_quantity for each pass in order_passes
  FOR order_pass_record IN
    SELECT 
      op.id,
      op.pass_id,
      op.pass_type,
      op.quantity,
      order_record.event_id
    FROM public.order_passes op
    WHERE op.order_id = order_id_param
  LOOP
    -- Try to use pass_id first
    IF order_pass_record.pass_id IS NOT NULL THEN
      pass_id_found := order_pass_record.pass_id;
    ELSE
      -- Fallback: Try to find pass_id by matching pass_type to event_passes.name
      SELECT ep.id INTO pass_id_found
      FROM public.event_passes ep
      WHERE ep.name = order_pass_record.pass_type
        AND ep.event_id = order_record.event_id
      LIMIT 1;
      
      IF pass_id_found IS NULL THEN
        RAISE WARNING 'Cannot find pass_id for pass_type "%" in event % - skipping stock release for this pass', 
          order_pass_record.pass_type, 
          order_record.event_id;
        CONTINUE;
      END IF;
    END IF;
    
    -- Atomically decrement sold_quantity (prevent negative values)
    UPDATE public.event_passes
    SET 
      sold_quantity = GREATEST(0, sold_quantity - order_pass_record.quantity),
      updated_at = NOW()
    WHERE id = pass_id_found
      AND sold_quantity >= order_pass_record.quantity;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    IF updated_count > 0 THEN
      total_released := total_released + 1;
      RAISE NOTICE 'Released % units for pass_id % (pass_type: %)', 
        order_pass_record.quantity, 
        pass_id_found,
        order_pass_record.pass_type;
    ELSE
      RAISE WARNING 'Could not release stock for pass_id % (sold_quantity may be less than quantity to release)', 
        pass_id_found;
    END IF;
  END LOOP;
  
  IF total_released = 0 THEN
    RAISE WARNING 'No stock was released for order % (no matching passes found or all releases failed)', order_id_param;
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION release_order_stock_internal(UUID) IS 'Enhanced internal helper function to release stock for an order. Handles both pass_id and pass_type matching. Used by auto-rejection and other cancellation flows.';

-- ============================================
-- STEP 2: Create database trigger as safety net
-- ============================================

-- Trigger function to ensure stock is released when order status changes to
-- REMOVED_BY_ADMIN, REJECTED, CANCELLED, etc.
CREATE OR REPLACE FUNCTION ensure_stock_released_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act on status changes to cancellation/rejection statuses
  IF NEW.status IN (
    'REMOVED_BY_ADMIN',
    'REJECTED',
    'CANCELLED',
    'CANCELLED_BY_AMBASSADOR',
    'CANCELLED_BY_ADMIN',
    'REFUNDED'
  ) AND (OLD.status IS NULL OR OLD.status != NEW.status) THEN
    -- If stock hasn't been released yet, release it
    -- The function will set stock_released = true, so we just call it
    IF NEW.stock_released = false THEN
      PERFORM release_order_stock_internal(NEW.id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION ensure_stock_released_on_status_change() IS 'Database trigger function that ensures stock is automatically released when order status changes to REMOVED_BY_ADMIN, REJECTED, CANCELLED, etc. This is a safety net in case application code fails to release stock.';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_ensure_stock_released_on_status_change ON public.orders;

-- Create the trigger
CREATE TRIGGER trigger_ensure_stock_released_on_status_change
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (
    NEW.status IN (
      'REMOVED_BY_ADMIN',
      'REJECTED',
      'CANCELLED',
      'CANCELLED_BY_AMBASSADOR',
      'CANCELLED_BY_ADMIN',
      'REFUNDED'
    )
    AND NEW.stock_released = false
  )
  EXECUTE FUNCTION ensure_stock_released_on_status_change();

COMMENT ON TRIGGER trigger_ensure_stock_released_on_status_change ON public.orders IS 'Safety net trigger: Automatically releases stock when order status changes to cancellation/rejection statuses. Ensures stock is always released even if application code fails.';

-- ============================================
-- STEP 3: Grant permissions
-- ============================================

GRANT EXECUTE ON FUNCTION release_order_stock_internal(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION release_order_stock_internal(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION ensure_stock_released_on_status_change() TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_stock_released_on_status_change() TO service_role;

-- ============================================
-- STEP 4: Log migration completion
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Stock Release Enhancement Complete';
  RAISE NOTICE '============================================';
  RAISE NOTICE '✓ Enhanced release_order_stock_internal() with pass_type fallback';
  RAISE NOTICE '✓ Added database trigger as safety net';
  RAISE NOTICE '✓ Stock will now be released even if pass_id is NULL';
  RAISE NOTICE '============================================';
END $$;
