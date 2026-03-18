-- Allow EXPIRED status/payment_status for online orders (used by auto-fail cron).

-- Update orders.status constraint
DO $$ 
BEGIN
  ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'orders_status_check drop failed (may not exist): %', SQLERRM;
END $$;

ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
  CHECK (
    status IN (
      -- COD / general statuses
      'PENDING_ONLINE',
      'REDIRECTED',
      'PENDING_CASH',
      'PENDING_ADMIN_APPROVAL',
      'PAID',
      'FAILED',
      'EXPIRED',
      'REJECTED',
      'CANCELLED',
      'REMOVED_BY_ADMIN'
    )
  );

-- Update orders.payment_status constraint
DO $$ 
BEGIN
  ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'orders_payment_status_check drop failed (may not exist): %', SQLERRM;
END $$;

ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check 
  CHECK (
    payment_status IS NULL OR payment_status IN ('PENDING_PAYMENT', 'PAID', 'FAILED', 'REFUNDED', 'EXPIRED')
  );

-- Allow EXPIRED as an online order status in validate_order_status trigger.
CREATE OR REPLACE FUNCTION public.validate_order_status()
RETURNS TRIGGER AS $$
BEGIN
  -- COD orders (ambassador_manual source): PENDING_ADMIN_APPROVAL, APPROVED, REJECTED, COMPLETED
  IF NEW.source = 'ambassador_manual' AND NEW.payment_method = 'cod' THEN
    IF NEW.status NOT IN ('PENDING_ADMIN_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED_BY_ADMIN') THEN
      RAISE EXCEPTION 'Invalid status % for COD ambassador order. Allowed: PENDING_ADMIN_APPROVAL, APPROVED, REJECTED, COMPLETED, CANCELLED_BY_ADMIN', NEW.status;
    END IF;
    -- COD orders must start as PENDING_ADMIN_APPROVAL (enforced on INSERT only for COD orders)
    IF TG_OP = 'INSERT' AND NEW.payment_method = 'cod' AND NEW.status != 'PENDING_ADMIN_APPROVAL' THEN
      RAISE EXCEPTION 'COD orders must start with PENDING_ADMIN_APPROVAL status. Attempted: %', NEW.status;
    END IF;
  END IF;
  
  -- Online orders: PAID, FAILED, EXPIRED, REFUNDED, PENDING_PAYMENT
  IF NEW.source = 'platform_online' AND NEW.payment_method = 'online' THEN
    IF NEW.status NOT IN ('PENDING_PAYMENT', 'PAID', 'FAILED', 'REFUNDED', 'PENDING', 'EXPIRED') THEN
      RAISE EXCEPTION 'Invalid status % for online order. Allowed: PENDING_PAYMENT, PAID, FAILED, REFUNDED, PENDING, EXPIRED', NEW.status;
    END IF;
  END IF;
  
  -- Legacy platform_cod source (for backward compatibility during migration)
  IF NEW.source = 'platform_cod' THEN
    IF NEW.status NOT IN ('PENDING_ADMIN_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED_BY_ADMIN') THEN
      RAISE EXCEPTION 'Invalid status % for COD order. Allowed: PENDING_ADMIN_APPROVAL, APPROVED, REJECTED, COMPLETED, CANCELLED_BY_ADMIN', NEW.status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

