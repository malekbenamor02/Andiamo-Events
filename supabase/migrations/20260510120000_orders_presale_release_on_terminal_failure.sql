-- When an order with presale_code_id moves into a terminal failure / abandoned status,
-- decrement presale_codes.successful_order_count so the cap matches reusable slots.
-- Idempotent: no release if OLD.status was already terminal failure, or if OLD was a completed sale.

CREATE OR REPLACE FUNCTION public.orders_presale_release_on_terminal_failure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_terminal_failures text[] := ARRAY[
    'REJECTED',
    'EXPIRED',
    'FAILED',
    'REMOVED_BY_ADMIN',
    'CANCELLED',
    'CANCELLED_BY_ADMIN',
    'CANCELLED_BY_AMBASSADOR',
    'REFUNDED'
  ];
  v_completed_sale text[] := ARRAY[
    'PAID',
    'COMPLETED',
    'MANUAL_COMPLETED',
    'APPROVED'
  ];
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.presale_code_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Already in a terminal failure state: do not decrement again
  IF OLD.status = ANY (v_terminal_failures) THEN
    RETURN NEW;
  END IF;

  -- Completed sale: cap must keep counting this order
  IF OLD.status = ANY (v_completed_sale) THEN
    RETURN NEW;
  END IF;

  IF NEW.status = ANY (v_terminal_failures) THEN
    PERFORM public.presale_release_slot(OLD.presale_code_id);
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.orders_presale_release_on_terminal_failure() IS
  'After orders.status update: if order had presale_code_id and moves from a non-failure, non-completed state into a terminal failure, call presale_release_slot once.';

DROP TRIGGER IF EXISTS tr_orders_presale_release_on_terminal_failure ON public.orders;

CREATE TRIGGER tr_orders_presale_release_on_terminal_failure
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_presale_release_on_terminal_failure();

-- One-time: align counters with orders still holding a presale slot (not terminal failure)
UPDATE public.presale_codes pc
SET
  successful_order_count = (
    SELECT COUNT(*)::integer
    FROM public.orders o
    WHERE o.presale_code_id = pc.id
      AND o.status NOT IN (
        'REJECTED',
        'EXPIRED',
        'FAILED',
        'REMOVED_BY_ADMIN',
        'CANCELLED',
        'CANCELLED_BY_ADMIN',
        'CANCELLED_BY_AMBASSADOR',
        'REFUNDED'
      )
  ),
  updated_at = now();

COMMENT ON TRIGGER tr_orders_presale_release_on_terminal_failure ON public.orders IS
  'Decrements presale successful_order_count when an order enters a terminal failure status; see orders_presale_release_on_terminal_failure().';
