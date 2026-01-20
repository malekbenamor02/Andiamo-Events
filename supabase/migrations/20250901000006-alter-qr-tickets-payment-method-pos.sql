-- Add 'pos' to qr_tickets payment_method CHECK for POS approved orders.

DO $$
BEGIN
  ALTER TABLE public.qr_tickets DROP CONSTRAINT IF EXISTS qr_tickets_payment_method_check;
  ALTER TABLE public.qr_tickets
    ADD CONSTRAINT qr_tickets_payment_method_check
    CHECK (payment_method IN ('online', 'cod', 'external_app', 'ambassador_cash', 'pos'));
  RAISE NOTICE 'Updated qr_tickets payment_method constraint to include pos';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not update qr_tickets payment_method constraint: %', SQLERRM;
END $$;
