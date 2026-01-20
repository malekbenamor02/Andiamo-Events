-- Add 'point_de_vente' to qr_tickets source CHECK so POS approved orders can have tickets.

DO $$
BEGIN
  ALTER TABLE public.qr_tickets DROP CONSTRAINT IF EXISTS qr_tickets_source_check;
  ALTER TABLE public.qr_tickets
    ADD CONSTRAINT qr_tickets_source_check
    CHECK (source IN ('platform_online', 'platform_cod', 'ambassador_manual', 'official_invitation', 'point_de_vente'));
  RAISE NOTICE 'Updated qr_tickets source constraint to include point_de_vente';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not update qr_tickets source constraint: %', SQLERRM;
END $$;

-- point_de_vente uses ticket_id, order_id, order_pass_id (like platform/ambassador); qr_tickets_source_data_check
-- already allows (source != 'official_invitation' AND ticket_id/order_id/order_pass_id NOT NULL).
