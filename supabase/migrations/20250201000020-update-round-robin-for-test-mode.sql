-- Update Round Robin Functions to Support Test Mode
-- This migration modifies the round robin functions to use test ambassadors when test mode is enabled

-- ============================================
-- 1. UPDATE assign_order_to_ambassador FUNCTION
-- ============================================
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
  v_test_mode_enabled BOOLEAN;
  v_order_is_test BOOLEAN;
  v_tracker_table TEXT;
BEGIN
  -- Check if test mode is enabled
  SELECT (content->>'enabled')::boolean INTO v_test_mode_enabled
  FROM site_content
  WHERE key = 'test_mode_settings';
  
  -- If test mode setting doesn't exist, default to false
  IF v_test_mode_enabled IS NULL THEN
    v_test_mode_enabled := FALSE;
  END IF;

  -- Check if the order is a test order
  SELECT is_test INTO v_order_is_test
  FROM public.orders
  WHERE id = p_order_id;

  -- Determine which tracker table to use
  IF v_test_mode_enabled AND (v_order_is_test = TRUE) THEN
    v_tracker_table := 'round_robin_tracker_test';
  ELSE
    v_tracker_table := 'round_robin_tracker';
  END IF;

  -- Get the last assigned ambassador for this ville from appropriate tracker
  IF v_tracker_table = 'round_robin_tracker_test' THEN
    SELECT last_assigned_ambassador_id, id
    INTO v_last_assigned_id, v_tracker_id
    FROM public.round_robin_tracker_test
    WHERE ville = p_ville;
  ELSE
    SELECT last_assigned_ambassador_id, id
    INTO v_last_assigned_id, v_tracker_id
    FROM public.round_robin_tracker
    WHERE ville = p_ville;
  END IF;

  -- Get all available ambassadors for this ville
  -- If test mode is enabled and order is test, only get test ambassadors
  -- Otherwise, exclude test ambassadors
  IF v_test_mode_enabled AND (v_order_is_test = TRUE) THEN
    SELECT ARRAY_AGG(id ORDER BY created_at)
    INTO v_available_ambassadors
    FROM public.ambassadors
    WHERE ville = p_ville
      AND status = 'approved'
      AND is_test = TRUE
      AND (status != 'suspended' OR status IS NULL);
  ELSE
    SELECT ARRAY_AGG(id ORDER BY created_at)
    INTO v_available_ambassadors
    FROM public.ambassadors
    WHERE ville = p_ville
      AND status = 'approved'
      AND (is_test = FALSE OR is_test IS NULL)
      AND (status != 'suspended' OR status IS NULL);
  END IF;

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

  -- Update or insert round robin tracker (use appropriate table)
  IF v_tracker_table = 'round_robin_tracker_test' THEN
    IF v_tracker_id IS NULL THEN
      INSERT INTO public.round_robin_tracker_test (ville, last_assigned_ambassador_id, last_assigned_at)
      VALUES (p_ville, v_ambassador_id, NOW())
      ON CONFLICT (ville) DO UPDATE
      SET last_assigned_ambassador_id = v_ambassador_id,
          last_assigned_at = NOW(),
          updated_at = NOW();
    ELSE
      UPDATE public.round_robin_tracker_test
      SET last_assigned_ambassador_id = v_ambassador_id,
          last_assigned_at = NOW(),
          updated_at = NOW()
      WHERE id = v_tracker_id;
    END IF;
  ELSE
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
    jsonb_build_object('ville', p_ville, 'round_robin', true, 'test_mode', v_test_mode_enabled, 'is_test', v_order_is_test)
  );

  RETURN v_ambassador_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. UPDATE get_next_ambassador_for_ville FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.get_next_ambassador_for_ville(
  p_ville TEXT,
  p_test_mode BOOLEAN DEFAULT FALSE
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
  -- Get the last assigned ambassador from appropriate tracker
  IF p_test_mode THEN
    SELECT last_assigned_ambassador_id
    INTO v_last_assigned_id
    FROM public.round_robin_tracker_test
    WHERE ville = p_ville;
  ELSE
    SELECT last_assigned_ambassador_id
    INTO v_last_assigned_id
    FROM public.round_robin_tracker
    WHERE ville = p_ville;
  END IF;

  -- Get all available ambassadors (test or real based on p_test_mode)
  IF p_test_mode THEN
    SELECT ARRAY_AGG(id ORDER BY created_at)
    INTO v_available_ambassadors
    FROM public.ambassadors
    WHERE ville = p_ville
      AND status = 'approved'
      AND is_test = TRUE
      AND (status != 'suspended' OR status IS NULL);
  ELSE
    SELECT ARRAY_AGG(id ORDER BY created_at)
    INTO v_available_ambassadors
    FROM public.ambassadors
    WHERE ville = p_ville
      AND status = 'approved'
      AND (is_test = FALSE OR is_test IS NULL)
      AND (status != 'suspended' OR status IS NULL);
  END IF;

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

-- ============================================
-- 3. UPDATE auto_reassign_ignored_orders FUNCTION
-- ============================================
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
  -- Only reassign non-test orders (test orders should be handled by auto-simulation)
  FOR v_order IN
    SELECT o.id, o.ville, o.ambassador_id, o.is_test
    FROM public.orders o
    WHERE o.status = 'ASSIGNED'
      AND o.assigned_at IS NOT NULL
      AND o.assigned_at < NOW() - (p_ignore_minutes || ' minutes')::INTERVAL
      AND o.accepted_at IS NULL
      AND (o.is_test = FALSE OR o.is_test IS NULL)  -- Only reassign real orders
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


