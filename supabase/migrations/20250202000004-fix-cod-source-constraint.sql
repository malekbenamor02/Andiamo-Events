-- Fix COD order source constraint
-- COD orders created by customers through platform should use 'platform_cod' source
-- Ambassadors do NOT create orders - they only receive orders from customers

-- Drop the incorrect constraint that forces ambassador_manual
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_cod_source_check;

-- Update constraint to allow 'platform_cod' for COD orders (customer-created)
ALTER TABLE public.orders ADD CONSTRAINT orders_cod_source_check
  CHECK (
    (payment_method = 'cod' AND source IN ('platform_cod', 'ambassador_manual')) OR
    (payment_method != 'cod')
  );

-- Also update the trigger function to allow platform_cod
CREATE OR REPLACE FUNCTION public.validate_cod_order_rules()
RETURNS TRIGGER AS $$
BEGIN
  -- Rule 1: COD orders must have ambassador_id NOT NULL and source = 'platform_cod' or 'ambassador_manual'
  IF NEW.payment_method = 'cod' THEN
    IF NEW.ambassador_id IS NULL THEN
      RAISE EXCEPTION 'COD orders (payment_method = cod) must have ambassador_id. ambassador_id cannot be NULL.';
    END IF;
    IF NEW.source NOT IN ('platform_cod', 'ambassador_manual') THEN
      RAISE EXCEPTION 'COD orders (payment_method = cod) must have source = ''platform_cod'' or ''ambassador_manual''. Current source: %', NEW.source;
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

-- Update validate_order_status to handle platform_cod
CREATE OR REPLACE FUNCTION public.validate_order_status()
RETURNS TRIGGER AS $$
BEGIN
  -- COD orders (platform_cod or ambassador_manual source): PENDING_ADMIN_APPROVAL, APPROVED, REJECTED, COMPLETED
  IF (NEW.source IN ('platform_cod', 'ambassador_manual') AND NEW.payment_method = 'cod') THEN
    IF NEW.status NOT IN ('PENDING_ADMIN_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED_BY_ADMIN', 'PENDING_CASH') THEN
      RAISE EXCEPTION 'Invalid status % for COD order. Allowed: PENDING_ADMIN_APPROVAL, APPROVED, REJECTED, COMPLETED, CANCELLED_BY_ADMIN, PENDING_CASH', NEW.status;
    END IF;
    -- COD orders must start as PENDING_CASH or PENDING_ADMIN_APPROVAL (enforced on INSERT only for COD orders)
    IF TG_OP = 'INSERT' AND NEW.payment_method = 'cod' AND NEW.status NOT IN ('PENDING_CASH', 'PENDING_ADMIN_APPROVAL') THEN
      RAISE EXCEPTION 'COD orders must start with PENDING_CASH or PENDING_ADMIN_APPROVAL status. Attempted: %', NEW.status;
    END IF;
  END IF;
  
  -- Online orders: PAID, FAILED, REFUNDED, PENDING_PAYMENT
  IF NEW.source = 'platform_online' AND NEW.payment_method = 'online' THEN
    IF NEW.status NOT IN ('PENDING_PAYMENT', 'PAID', 'FAILED', 'REFUNDED', 'PENDING') THEN
      RAISE EXCEPTION 'Invalid status % for online order. Allowed: PENDING_PAYMENT, PAID, FAILED, REFUNDED, PENDING', NEW.status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
