-- Require max_quantity on event_passes (remove unlimited passes feature)
-- Admin must enter stock quantity when creating/editing a pass.
--
-- Date: 2025-03-02

-- 1. Backfill: set NULL max_quantity to at least sold_quantity (or 1)
UPDATE public.event_passes
SET max_quantity = GREATEST(COALESCE(sold_quantity, 0), 1)
WHERE max_quantity IS NULL;

-- 2. Make column NOT NULL
ALTER TABLE public.event_passes
  ALTER COLUMN max_quantity SET NOT NULL;

-- 3. Simplify constraints (no more NULL = unlimited)
ALTER TABLE public.event_passes
  DROP CONSTRAINT IF EXISTS event_passes_stock_check;

ALTER TABLE public.event_passes
  ADD CONSTRAINT event_passes_stock_check
  CHECK (sold_quantity <= max_quantity);

ALTER TABLE public.event_passes
  DROP CONSTRAINT IF EXISTS event_passes_max_quantity_check;

ALTER TABLE public.event_passes
  ADD CONSTRAINT event_passes_max_quantity_check
  CHECK (max_quantity >= 0);

COMMENT ON COLUMN public.event_passes.max_quantity IS 'Total stock for this pass. Required; admin must enter when creating a pass.';
