-- Release stock only for limited passes (max_quantity IS NOT NULL)
-- Unlimited passes are never incremented on order create, so we must not decrement on release.
-- Fixes incorrect decrement for online, ambassador, and POS orders that contain only unlimited passes.
--
-- Date: 2025-03-02

CREATE OR REPLACE FUNCTION release_order_stock_internal(order_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  order_record RECORD;
  order_pass_record RECORD;
  pass_id_found UUID;
  pass_max_qty INTEGER;
  updated_count INTEGER;
  total_released INTEGER := 0;
BEGIN
  UPDATE public.orders
  SET stock_released = true
  WHERE id = order_id_param
    AND stock_released = false
  RETURNING id, status, event_id INTO order_record;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

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
    IF order_pass_record.pass_id IS NOT NULL THEN
      pass_id_found := order_pass_record.pass_id;
    ELSE
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

    -- Only decrement for limited passes (we never increment for unlimited on create)
    SELECT max_quantity INTO pass_max_qty
    FROM public.event_passes
    WHERE id = pass_id_found;

    IF pass_max_qty IS NULL THEN
      RAISE NOTICE 'Skipping stock release for unlimited pass_id %', pass_id_found;
      CONTINUE;
    END IF;

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
    RAISE NOTICE 'No limited-pass stock released for order % (may have only unlimited passes or no matching passes)', order_id_param;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION release_order_stock_internal(UUID) IS 'Releases order stock: sets stock_released=true, decrements event_passes.sold_quantity only for limited passes (max_quantity IS NOT NULL). Used for online, ambassador, and POS.';

-- Atomic decrement for rollback (avoids read-then-write race)
CREATE OR REPLACE FUNCTION decrement_event_pass_sold(pass_id_param UUID, amount_param INTEGER)
RETURNS void AS $$
BEGIN
  IF amount_param IS NULL OR amount_param <= 0 THEN
    RETURN;
  END IF;
  UPDATE public.event_passes
  SET sold_quantity = GREATEST(0, sold_quantity - amount_param),
      updated_at = NOW()
  WHERE id = pass_id_param;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION decrement_event_pass_sold(UUID, INTEGER) IS 'Atomically decrements event_passes.sold_quantity; used for rollback on failed order create.';

GRANT EXECUTE ON FUNCTION decrement_event_pass_sold(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_event_pass_sold(UUID, INTEGER) TO service_role;
