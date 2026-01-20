-- Add is_active to pos_pass_stock so admin can enable/disable each pass type per outlet+event.
-- Inactive pass types are hidden from the POS dashboard and cannot be sold.

ALTER TABLE public.pos_pass_stock
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.pos_pass_stock.is_active IS 'When false, this pass type is hidden from POS and cannot be sold for this outlet+event.';
