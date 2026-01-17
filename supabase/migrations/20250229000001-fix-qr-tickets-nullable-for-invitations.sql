-- Migration: Fix qr_tickets columns to allow NULL for official invitations
-- This migration makes ticket_id, order_id, and order_pass_id nullable
-- and adds constraints to ensure data integrity

-- ============================================
-- 1. MAKE COLUMNS NULLABLE
-- ============================================

-- Make ticket_id nullable (official invitations don't have tickets)
ALTER TABLE public.qr_tickets 
  ALTER COLUMN ticket_id DROP NOT NULL;

-- Make order_id nullable (official invitations don't have orders)
ALTER TABLE public.qr_tickets 
  ALTER COLUMN order_id DROP NOT NULL;

-- Make order_pass_id nullable (official invitations don't have order_passes)
ALTER TABLE public.qr_tickets 
  ALTER COLUMN order_pass_id DROP NOT NULL;

-- ============================================
-- 2. ADD CONSTRAINT FOR DATA INTEGRITY
-- ============================================

-- Drop existing constraint if it exists
ALTER TABLE public.qr_tickets 
  DROP CONSTRAINT IF EXISTS qr_tickets_source_data_check;

-- Add constraint to ensure either (ticket_id, order_id, order_pass_id) OR invitation_id is set
ALTER TABLE public.qr_tickets 
  ADD CONSTRAINT qr_tickets_source_data_check 
  CHECK (
    -- For official_invitation: invitation_id must be set, ticket_id/order_id/order_pass_id must be null
    (source = 'official_invitation' AND invitation_id IS NOT NULL AND ticket_id IS NULL AND order_id IS NULL AND order_pass_id IS NULL)
    OR
    -- For other sources: ticket_id, order_id, order_pass_id must be set, invitation_id must be null
    (source != 'official_invitation' AND ticket_id IS NOT NULL AND order_id IS NOT NULL AND order_pass_id IS NOT NULL AND (invitation_id IS NULL))
  );

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT qr_tickets_source_data_check ON public.qr_tickets IS 
  'Ensures data integrity: official_invitation entries must have invitation_id and null ticket/order fields; other sources must have ticket/order fields and null invitation_id';
