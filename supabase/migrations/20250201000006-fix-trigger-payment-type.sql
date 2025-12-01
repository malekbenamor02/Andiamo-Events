-- Fix trigger function to use payment_method instead of payment_type
-- The log_order_creation function is trying to access NEW.payment_type which no longer exists

CREATE OR REPLACE FUNCTION public.log_order_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.order_logs (order_id, action, performed_by, performed_by_type, details)
  VALUES (
    NEW.id,
    CASE 
      WHEN NEW.source = 'ambassador_manual' THEN 'manual_order_created'
      ELSE 'created'
    END,
    NEW.ambassador_id,
    CASE 
      WHEN NEW.source = 'ambassador_manual' THEN 'ambassador'
      ELSE 'system'
    END,
    jsonb_build_object(
      'source', NEW.source,
      'payment_method', NEW.payment_method, -- Changed from payment_type to payment_method
      'total_price', NEW.total_price
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;




