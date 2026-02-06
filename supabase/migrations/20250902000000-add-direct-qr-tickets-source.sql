-- Add 'Invitation' source to qr_tickets for QR tickets added directly in DB.
-- These rows have no order, no ticket, no invitation; they are scannable but
-- never shown or counted in Orders, Invitations, or any app tabs.

DO $$
BEGIN
  ALTER TABLE public.qr_tickets DROP CONSTRAINT IF EXISTS qr_tickets_source_check;
  ALTER TABLE public.qr_tickets
    ADD CONSTRAINT qr_tickets_source_check
    CHECK (source IN ('platform_online', 'platform_cod', 'ambassador_manual', 'official_invitation', 'point_de_vente', 'Invitation'));
  RAISE NOTICE 'Updated qr_tickets source constraint to include Invitation';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not update qr_tickets source constraint: %', SQLERRM;
END $$;

-- Allow Invitation rows: ticket_id, order_id, order_pass_id, invitation_id all NULL.
ALTER TABLE public.qr_tickets
  DROP CONSTRAINT IF EXISTS qr_tickets_source_data_check;

ALTER TABLE public.qr_tickets
  ADD CONSTRAINT qr_tickets_source_data_check
  CHECK (
    (source = 'official_invitation' AND invitation_id IS NOT NULL AND ticket_id IS NULL AND order_id IS NULL AND order_pass_id IS NULL)
    OR
    (source = 'Invitation' AND ticket_id IS NULL AND order_id IS NULL AND order_pass_id IS NULL AND invitation_id IS NULL)
    OR
    (source NOT IN ('official_invitation', 'Invitation') AND ticket_id IS NOT NULL AND order_id IS NOT NULL AND order_pass_id IS NOT NULL AND (invitation_id IS NULL))
  );

COMMENT ON CONSTRAINT qr_tickets_source_data_check ON public.qr_tickets IS
  'official_invitation: invitation_id set, ticket/order null; Invitation: all link cols null; others: ticket/order set, invitation_id null';
