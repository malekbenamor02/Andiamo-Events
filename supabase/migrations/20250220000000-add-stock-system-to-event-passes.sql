-- ============================================
-- Stock System Migration
-- Adds secure, editable, per-pass-type stock management
-- Supports multiple releases/phases, soft-delete, and backward compatibility
-- ============================================
-- Date: 2025-02-20
-- Status: FINAL - Implementation Ready
-- ============================================

-- ============================================
-- STEP 1: Add stock columns to event_passes table
-- ============================================

-- Add max_quantity (NULL = unlimited, non-NULL = limited stock)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'event_passes' 
        AND column_name = 'max_quantity'
    ) THEN
        ALTER TABLE public.event_passes 
        ADD COLUMN max_quantity INTEGER NULL;
        
        COMMENT ON COLUMN public.event_passes.max_quantity IS 'Total stock available. NULL = unlimited stock (industry-standard). Non-NULL = limited stock.';
    END IF;
END $$;

-- Add sold_quantity (tracks current sold/reserved passes)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'event_passes' 
        AND column_name = 'sold_quantity'
    ) THEN
        ALTER TABLE public.event_passes 
        ADD COLUMN sold_quantity INTEGER NOT NULL DEFAULT 0;
        
        COMMENT ON COLUMN public.event_passes.sold_quantity IS 'Current number of passes sold/reserved. Always: sold_quantity <= max_quantity OR max_quantity IS NULL.';
    END IF;
END $$;

-- Add is_active (soft-delete flag)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'event_passes' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.event_passes 
        ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
        
        COMMENT ON COLUMN public.event_passes.is_active IS 'true = available for purchase, false = disabled (soft-delete). Inactive passes still valid for historical orders.';
    END IF;
END $$;

-- Add release_version (event-scoped versioning for multiple releases/phases)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'event_passes' 
        AND column_name = 'release_version'
    ) THEN
        ALTER TABLE public.event_passes 
        ADD COLUMN release_version INTEGER NOT NULL DEFAULT 1;
        
        COMMENT ON COLUMN public.event_passes.release_version IS 'Release/phase version per event (event-scoped, not global). Groups passes by release within same event.';
    END IF;
END $$;

-- ============================================
-- STEP 2: Add constraints to event_passes
-- ============================================

-- Constraint: sold_quantity never exceeds max_quantity (or max_quantity is NULL = unlimited)
ALTER TABLE public.event_passes
DROP CONSTRAINT IF EXISTS event_passes_stock_check;

ALTER TABLE public.event_passes
ADD CONSTRAINT event_passes_stock_check 
CHECK (
    max_quantity IS NULL OR sold_quantity <= max_quantity
);

-- Constraint: max_quantity is non-negative if not NULL
ALTER TABLE public.event_passes
DROP CONSTRAINT IF EXISTS event_passes_max_quantity_check;

ALTER TABLE public.event_passes
ADD CONSTRAINT event_passes_max_quantity_check 
CHECK (
    max_quantity IS NULL OR max_quantity >= 0
);

-- Constraint: sold_quantity is non-negative
ALTER TABLE public.event_passes
DROP CONSTRAINT IF EXISTS event_passes_sold_quantity_check;

ALTER TABLE public.event_passes
ADD CONSTRAINT event_passes_sold_quantity_check 
CHECK (
    sold_quantity >= 0
);

-- Constraint: Unique (event_id, name, release_version) - event-scoped uniqueness
-- Same pass name can exist in different events, but not same event+release
ALTER TABLE public.event_passes
DROP CONSTRAINT IF EXISTS event_passes_event_name_release_unique;

-- First, drop the old unique constraint if it exists (event_id, name only)
ALTER TABLE public.event_passes
DROP CONSTRAINT IF EXISTS event_passes_event_id_name_key;

-- Add new unique constraint with release_version
ALTER TABLE public.event_passes
ADD CONSTRAINT event_passes_event_name_release_unique 
UNIQUE(event_id, name, release_version);

-- ============================================
-- STEP 3: Add indexes to event_passes for performance
-- ============================================

-- Index for efficient queries: active passes by event and release
CREATE INDEX IF NOT EXISTS idx_event_passes_active_release 
ON public.event_passes(event_id, is_active, release_version);

-- Index for stock availability checks (critical for order creation)
CREATE INDEX IF NOT EXISTS idx_event_passes_stock 
ON public.event_passes(id, is_active, sold_quantity, max_quantity)
WHERE is_active = true;

-- Index for filtering by release version
CREATE INDEX IF NOT EXISTS idx_event_passes_release_version 
ON public.event_passes(event_id, release_version);

-- ============================================
-- STEP 4: Add pass_id to order_passes table (REQUIRED, not optional)
-- ============================================

-- Add pass_id column (foreign key to event_passes)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'order_passes' 
        AND column_name = 'pass_id'
    ) THEN
        ALTER TABLE public.order_passes 
        ADD COLUMN pass_id UUID NULL REFERENCES public.event_passes(id) ON DELETE SET NULL;
        
        COMMENT ON COLUMN public.order_passes.pass_id IS 'Foreign key to event_passes.id for stock management. REQUIRED for reliable stock release. NULL initially for existing orders (backfilled).';
    END IF;
END $$;

-- Add index on pass_id for faster stock release queries
CREATE INDEX IF NOT EXISTS idx_order_passes_pass_id 
ON public.order_passes(pass_id)
WHERE pass_id IS NOT NULL;

-- ============================================
-- STEP 5: Add stock_released flag to orders table
-- ============================================

-- Add stock_released flag (prevents double-release in async systems)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'stock_released'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN stock_released BOOLEAN NOT NULL DEFAULT false;
        
        COMMENT ON COLUMN public.orders.stock_released IS 'false = stock still reserved, true = stock has been released. Prevents double-release from webhook retries, admin double-clicks, or race conditions.';
    END IF;
END $$;

-- Add index on stock_released for faster queries during stock release
CREATE INDEX IF NOT EXISTS idx_orders_stock_released 
ON public.orders(stock_released, status)
WHERE stock_released = false;

-- ============================================
-- STEP 6: Backfill pass_id in order_passes from existing orders
-- ============================================

-- Backfill pass_id by matching pass_type (name) to event_passes.name within same event
-- This connects existing orders to passes for stock management
DO $$
DECLARE
    backfilled_count INTEGER;
BEGIN
    UPDATE public.order_passes
    SET pass_id = subquery.pass_id
    FROM (
        SELECT 
            op.id as order_pass_id,
            ep.id as pass_id
        FROM public.order_passes op
        JOIN public.orders o ON o.id = op.order_id
        JOIN public.event_passes ep ON ep.name = op.pass_type AND ep.event_id = o.event_id
        WHERE op.pass_id IS NULL
    ) AS subquery
    WHERE public.order_passes.id = subquery.order_pass_id;
    
    GET DIAGNOSTICS backfilled_count = ROW_COUNT;
    
    -- Log backfill result (if logging is available)
    RAISE NOTICE 'Backfilled pass_id for % existing order_passes records', backfilled_count;
END $$;

-- ============================================
-- STEP 7: Calculate initial sold_quantity from existing orders
-- ============================================

-- Calculate initial sold_quantity by counting order_passes per pass_id
-- Only count orders that are NOT cancelled/expired/refunded (stock is "sold")
-- Stock should be counted for: COMPLETED, PAID, MANUAL_COMPLETED orders
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Update sold_quantity for passes with pass_id matches
    WITH pass_sales AS (
        SELECT 
            op.pass_id,
            SUM(op.quantity) as total_sold
        FROM public.order_passes op
        JOIN public.orders o ON o.id = op.order_id
        WHERE op.pass_id IS NOT NULL
          AND (
            o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED')
            -- Also count PENDING orders as "reserved" stock
            OR (o.status IN ('PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED') AND o.stock_released = false)
          )
        GROUP BY op.pass_id
    )
    UPDATE public.event_passes
    SET sold_quantity = COALESCE(ps.total_sold, 0)
    FROM pass_sales ps
    WHERE public.event_passes.id = ps.pass_id;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RAISE NOTICE 'Updated sold_quantity for % passes based on existing orders', updated_count;
END $$;

-- ============================================
-- STEP 8: Ensure existing passes have safe defaults
-- ============================================

-- Ensure all existing passes have is_active = true and release_version = 1
-- (should already be set by DEFAULT, but ensure for safety)
UPDATE public.event_passes
SET 
    is_active = COALESCE(is_active, true),
    release_version = COALESCE(release_version, 1)
WHERE is_active IS NULL OR release_version IS NULL;

-- Ensure all existing passes default to unlimited stock (max_quantity = NULL)
-- This maintains backward compatibility (existing passes work as unlimited)
-- Admins can set max_quantity later via admin dashboard
UPDATE public.event_passes
SET max_quantity = NULL
WHERE max_quantity IS NULL;  -- No-op, but ensures NULL is the default

-- ============================================
-- STEP 9: Add helpful comments for documentation
-- ============================================

COMMENT ON TABLE public.event_passes IS 'Stores all pass types for each event with stock management. Each event can have multiple passes in different release versions. Stock is tracked per pass with unlimited (NULL) or limited (integer) max_quantity.';

COMMENT ON COLUMN public.event_passes.max_quantity IS 'Total stock available. NULL = unlimited stock (industry-standard, backward compatible). Non-NULL = limited stock (enforces constraint).';

COMMENT ON COLUMN public.event_passes.sold_quantity IS 'Current number of passes sold/reserved. Always: sold_quantity <= max_quantity OR max_quantity IS NULL. Increments atomically during order creation, decrements on cancellation/expiration.';

COMMENT ON COLUMN public.event_passes.is_active IS 'true = available for purchase, false = disabled (soft-delete). Inactive passes are still valid for historical orders. Frontend filters out inactive passes for purchase.';

COMMENT ON COLUMN public.event_passes.release_version IS 'Release/phase version per event (event-scoped, not global). Version 1 in Event A ≠ Version 1 in Event B. Groups passes by release within same event. Unique constraint: (event_id, name, release_version).';

COMMENT ON TABLE public.order_passes IS 'Stores multiple pass types per order. pass_id (NEW) links to event_passes for stock management. pass_type (existing) stores pass name for historical display. Both fields coexist.';

COMMENT ON COLUMN public.order_passes.pass_id IS 'Foreign key to event_passes.id for stock management (REQUIRED, not optional). Used for reliable stock release, audits, and refunds. NULL initially for existing orders (backfilled in this migration).';

COMMENT ON COLUMN public.orders.stock_released IS 'false = stock still reserved (order active/cancelled but stock not released yet), true = stock has been released. Prevents double-release from webhook retries, admin double-clicks, or async race conditions. Atomic flag ensures idempotent stock release.';

-- ============================================
-- STEP 10: Migration Summary
-- ============================================

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Stock System Migration Complete';
    RAISE NOTICE '============================================';
    RAISE NOTICE '✓ Added stock columns to event_passes';
    RAISE NOTICE '✓ Added pass_id to order_passes';
    RAISE NOTICE '✓ Added stock_released flag to orders';
    RAISE NOTICE '✓ Added constraints and indexes';
    RAISE NOTICE '✓ Backfilled pass_id from existing orders';
    RAISE NOTICE '✓ Calculated initial sold_quantity';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '1. Verify backfill results (check pass_id IS NULL in order_passes)';
    RAISE NOTICE '2. Set max_quantity for existing passes via admin dashboard';
    RAISE NOTICE '3. Implement server.cjs stock reservation logic';
    RAISE NOTICE '4. Test stock management thoroughly';
    RAISE NOTICE '============================================';
END $$;
