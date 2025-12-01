-- Remove Test Mode Support
-- This migration removes all test mode columns, tables, and settings

-- ============================================
-- 1. DELETE ALL TEST DATA
-- ============================================
-- Delete test order logs
DELETE FROM public.order_logs 
WHERE order_id IN (SELECT id FROM public.orders WHERE is_test = true);

-- Delete test orders
DELETE FROM public.orders WHERE is_test = true;

-- Delete test ambassadors
DELETE FROM public.ambassadors WHERE is_test = true;

-- Delete test round robin tracker
DELETE FROM public.round_robin_tracker_test;

-- ============================================
-- 2. DROP TEST MODE TABLES
-- ============================================
DROP TABLE IF EXISTS public.round_robin_tracker_test CASCADE;

-- ============================================
-- 3. REMOVE is_test COLUMNS
-- ============================================
-- Remove is_test from orders
ALTER TABLE public.orders DROP COLUMN IF EXISTS is_test;

-- Remove is_test from ambassadors
ALTER TABLE public.ambassadors DROP COLUMN IF EXISTS is_test;

-- Drop indexes
DROP INDEX IF EXISTS idx_orders_is_test;
DROP INDEX IF EXISTS idx_ambassadors_is_test;

-- ============================================
-- 4. REMOVE TEST MODE SETTINGS
-- ============================================
DELETE FROM site_content WHERE key = 'test_mode_settings';

-- ============================================
-- 5. RESTORE ORIGINAL ROUND ROBIN FUNCTIONS
-- ============================================
-- Restore assign_order_to_ambassador to original (without test mode logic)
CREATE OR REPLACE FUNCTION public.assign_order_to_ambassador(
  p_order_id UUID,
  p_ville TEXT
)
RETURNS UUID AS $$
DECLARE
  v_ambassador_id UUID;
  v_last_assigned_id UUID;
  v_available_ambassadors UUID[];
  v_next_index INTEGER;
  v_tracker_id UUID;
BEGIN
  -- Get the last assigned ambassador for this ville
  SELECT last_assigned_ambassador_id, id
  INTO v_last_assigned_id, v_tracker_id
  FROM public.round_robin_tracker
  WHERE ville = p_ville;

  -- Get all available ambassadors for this ville
  -- Filter out suspended/blocked ambassadors
  SELECT ARRAY_AGG(id ORDER BY created_at)
  INTO v_available_ambassadors
  FROM public.ambassadors
  WHERE ville = p_ville
    AND status = 'approved'
    AND (status != 'suspended' OR status IS NULL);

  -- If no ambassadors available, return NULL
  IF v_available_ambassadors IS NULL OR array_length(v_available_ambassadors, 1) = 0 THEN
    RETURN NULL;
  END IF;

  -- Find the next ambassador after last_assigned_id
  IF v_last_assigned_id IS NULL THEN
    -- First assignment for this ville
    v_ambassador_id := v_available_ambassadors[1];
    v_next_index := 1;
  ELSE
    -- Find the index of last assigned ambassador
    v_next_index := array_position(v_available_ambassadors, v_last_assigned_id);
    
    IF v_next_index IS NULL OR v_next_index >= array_length(v_available_ambassadors, 1) THEN
      -- Last ambassador in list, wrap around to first
      v_ambassador_id := v_available_ambassadors[1];
      v_next_index := 1;
    ELSE
      -- Get next ambassador
      v_ambassador_id := v_available_ambassadors[v_next_index + 1];
      v_next_index := v_next_index + 1;
    END IF;
  END IF;

  -- Update or insert round robin tracker
  IF v_tracker_id IS NULL THEN
    INSERT INTO public.round_robin_tracker (ville, last_assigned_ambassador_id, last_assigned_at)
    VALUES (p_ville, v_ambassador_id, NOW())
    ON CONFLICT (ville) DO UPDATE
    SET last_assigned_ambassador_id = v_ambassador_id,
        last_assigned_at = NOW(),
        updated_at = NOW();
  ELSE
    UPDATE public.round_robin_tracker
    SET last_assigned_ambassador_id = v_ambassador_id,
        last_assigned_at = NOW(),
        updated_at = NOW()
    WHERE id = v_tracker_id;
  END IF;

  -- Assign the order
  UPDATE public.orders
  SET ambassador_id = v_ambassador_id,
      status = 'ASSIGNED',
      assigned_at = NOW(),
      updated_at = NOW()
  WHERE id = p_order_id;

  -- Log the assignment
  INSERT INTO public.order_logs (order_id, action, performed_by, performed_by_type, details)
  VALUES (
    p_order_id,
    'assigned',
    v_ambassador_id,
    'system',
    jsonb_build_object('ville', p_ville, 'round_robin', true)
  );

  RETURN v_ambassador_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Restore get_next_ambassador_for_ville to original
CREATE OR REPLACE FUNCTION public.get_next_ambassador_for_ville(
  p_ville TEXT
)
RETURNS TABLE (
  ambassador_id UUID,
  ambassador_name TEXT,
  ambassador_phone TEXT,
  is_last_assigned BOOLEAN
) AS $$
DECLARE
  v_last_assigned_id UUID;
  v_available_ambassadors UUID[];
  v_next_index INTEGER;
BEGIN
  -- Get the last assigned ambassador
  SELECT last_assigned_ambassador_id
  INTO v_last_assigned_id
  FROM public.round_robin_tracker
  WHERE ville = p_ville;

  -- Get all available ambassadors
  SELECT ARRAY_AGG(id ORDER BY created_at)
  INTO v_available_ambassadors
  FROM public.ambassadors
  WHERE ville = p_ville
    AND status = 'approved'
    AND (status != 'suspended' OR status IS NULL);

  IF v_available_ambassadors IS NULL OR array_length(v_available_ambassadors, 1) = 0 THEN
    RETURN;
  END IF;

  -- Find next ambassador
  IF v_last_assigned_id IS NULL THEN
    v_next_index := 1;
  ELSE
    v_next_index := array_position(v_available_ambassadors, v_last_assigned_id);
    IF v_next_index IS NULL OR v_next_index >= array_length(v_available_ambassadors, 1) THEN
      v_next_index := 1;
    ELSE
      v_next_index := v_next_index + 1;
    END IF;
  END IF;

  -- Return next ambassador info
  RETURN QUERY
  SELECT 
    a.id,
    a.full_name,
    a.phone,
    (a.id = v_last_assigned_id) as is_last_assigned
  FROM public.ambassadors a
  WHERE a.id = v_available_ambassadors[v_next_index];
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Restore auto_reassign_ignored_orders to original
CREATE OR REPLACE FUNCTION public.auto_reassign_ignored_orders(
  p_ignore_minutes INTEGER DEFAULT 15
)
RETURNS INTEGER AS $$
DECLARE
  v_reassigned_count INTEGER := 0;
  v_order RECORD;
  v_new_ambassador_id UUID;
BEGIN
  -- Find orders that have been assigned but not accepted for more than p_ignore_minutes
  FOR v_order IN
    SELECT o.id, o.ville, o.ambassador_id
    FROM public.orders o
    WHERE o.status = 'ASSIGNED'
      AND o.assigned_at IS NOT NULL
      AND o.assigned_at < NOW() - (p_ignore_minutes || ' minutes')::INTERVAL
      AND o.accepted_at IS NULL
  LOOP
    -- Reassign using round robin
    v_new_ambassador_id := public.assign_order_to_ambassador(v_order.id, v_order.ville);
    
    IF v_new_ambassador_id IS NOT NULL AND v_new_ambassador_id != v_order.ambassador_id THEN
      -- Log the auto-reassignment
      INSERT INTO public.order_logs (order_id, action, performed_by, performed_by_type, details)
      VALUES (
        v_order.id,
        'auto_reassigned',
        NULL,
        'system',
        jsonb_build_object(
          'old_ambassador_id', v_order.ambassador_id,
          'new_ambassador_id', v_new_ambassador_id,
          'reason', 'Order ignored for more than ' || p_ignore_minutes || ' minutes'
        )
      );
      
      v_reassigned_count := v_reassigned_count + 1;
    END IF;
  END LOOP;

  RETURN v_reassigned_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

