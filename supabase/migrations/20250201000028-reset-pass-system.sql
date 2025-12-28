-- FULL RESET: Pass System Refactor
-- This migration completely resets the pass system architecture
-- NO backward compatibility - clean slate approach

-- ============================================
-- STEP 1: Update event_passes table structure
-- ============================================

-- Rename is_default to is_primary (more accurate naming)
-- Check if column exists before renaming
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'event_passes' 
        AND column_name = 'is_default'
    ) THEN
        ALTER TABLE public.event_passes 
        RENAME COLUMN is_default TO is_primary;
    ELSIF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'event_passes' 
        AND column_name = 'is_primary'
    ) THEN
        -- If neither column exists, add is_primary
        ALTER TABLE public.event_passes 
        ADD COLUMN is_primary BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Update price constraint: MUST be > 0 (not >= 0)
ALTER TABLE public.event_passes
DROP CONSTRAINT IF EXISTS event_passes_price_check;

ALTER TABLE public.event_passes
ADD CONSTRAINT event_passes_price_check 
CHECK (price > 0);

-- Update the unique index for primary passes
DROP INDEX IF EXISTS idx_event_passes_one_default_per_event;

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_passes_one_primary_per_event 
ON public.event_passes(event_id) 
WHERE is_primary = true;

-- Update comments to reflect new architecture
COMMENT ON TABLE public.event_passes IS 'Stores all pass types for each event. Each event must have exactly one primary pass.';
COMMENT ON COLUMN public.event_passes.name IS 'Pass name (e.g., "Standard", "VIP", "Early Bird"). Must be unique within the same event.';
COMMENT ON COLUMN public.event_passes.price IS 'Pass price in TND. MUST be > 0.';
COMMENT ON COLUMN public.event_passes.description IS 'Short explanation of what the pass includes.';
COMMENT ON COLUMN public.event_passes.is_primary IS 'True for exactly one pass per event. The primary pass is selected by default.';

-- ============================================
-- STEP 2: Remove legacy price columns from events
-- ============================================

-- Remove standard_price and vip_price columns from events table
ALTER TABLE public.events 
DROP COLUMN IF EXISTS standard_price;

ALTER TABLE public.events 
DROP COLUMN IF EXISTS vip_price;

-- ============================================
-- STEP 3: Data integrity cleanup
-- ============================================

-- Delete any passes with price <= 0 (invalid data)
DELETE FROM public.event_passes WHERE price <= 0;

-- Ensure each event has exactly one primary pass
-- If an event has no primary pass, mark the first pass as primary
DO $$
DECLARE
    event_record RECORD;
    first_pass_id UUID;
BEGIN
    FOR event_record IN 
        SELECT DISTINCT event_id 
        FROM public.event_passes
        WHERE event_id NOT IN (
            SELECT DISTINCT event_id 
            FROM public.event_passes 
            WHERE is_primary = true
        )
    LOOP
        -- Get the first pass for this event
        SELECT id INTO first_pass_id
        FROM public.event_passes
        WHERE event_id = event_record.event_id
        ORDER BY created_at ASC
        LIMIT 1;
        
        -- Mark it as primary
        IF first_pass_id IS NOT NULL THEN
            UPDATE public.event_passes
            SET is_primary = true
            WHERE id = first_pass_id;
        END IF;
    END LOOP;
    
    -- Fix events with multiple primary passes - keep the oldest, unmark others
    FOR event_record IN
        SELECT event_id, COUNT(*) as primary_count
        FROM public.event_passes
        WHERE is_primary = true
        GROUP BY event_id
        HAVING COUNT(*) > 1
    LOOP
        -- Keep the oldest primary pass, unmark others
        UPDATE public.event_passes
        SET is_primary = false
        WHERE event_id = event_record.event_id
        AND is_primary = true
        AND id NOT IN (
            SELECT id
            FROM public.event_passes
            WHERE event_id = event_record.event_id
            AND is_primary = true
            ORDER BY created_at ASC
            LIMIT 1
        );
    END LOOP;
END $$;

-- ============================================
-- STEP 4: Add function to enforce primary pass constraint
-- ============================================

-- Function to check that exactly one primary pass exists per event
CREATE OR REPLACE FUNCTION public.check_one_primary_pass_per_event()
RETURNS TRIGGER AS $$
DECLARE
    primary_count INTEGER;
BEGIN
    -- Count primary passes for this event
    SELECT COUNT(*) INTO primary_count
    FROM public.event_passes
    WHERE event_id = NEW.event_id
    AND is_primary = true;
    
    -- If this is a new primary pass and another primary already exists, prevent it
    IF NEW.is_primary = true AND primary_count > 0 THEN
        -- If updating an existing pass that's already primary, allow it
        IF TG_OP = 'UPDATE' AND OLD.is_primary = true THEN
            RETURN NEW;
        END IF;
        
        RAISE EXCEPTION 'Event can only have one primary pass. Another primary pass already exists for this event.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce constraint
DROP TRIGGER IF EXISTS enforce_one_primary_pass_per_event ON public.event_passes;

CREATE TRIGGER enforce_one_primary_pass_per_event
BEFORE INSERT OR UPDATE ON public.event_passes
FOR EACH ROW
WHEN (NEW.is_primary = true)
EXECUTE FUNCTION public.check_one_primary_pass_per_event();

