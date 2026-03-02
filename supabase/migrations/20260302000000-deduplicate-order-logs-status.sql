-- Prevent duplicate status_changed logs for the same status transition
CREATE UNIQUE INDEX IF NOT EXISTS order_logs_status_change_uniq
ON public.order_logs (
  order_id,
  action,
  (details->>'old_status'),
  (details->>'new_status')
)
WHERE action = 'status_changed';

-- Ensure log_order_action uses the unique index and does not create duplicates
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
    )
    ON CONFLICT (order_id, action, (details->>'old_status'), (details->>'new_status'))
    DO NOTHING;
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

