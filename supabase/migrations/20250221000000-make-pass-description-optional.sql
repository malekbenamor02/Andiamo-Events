-- ============================================
-- Make pass description optional
-- Allows NULL values in event_passes.description
-- ============================================
-- Date: 2025-02-21
-- ============================================

-- Alter description column to allow NULL
DO $$
BEGIN
    -- Check if column exists and is currently NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'event_passes' 
        AND column_name = 'description'
        AND is_nullable = 'NO'
    ) THEN
        -- Alter column to allow NULL
        ALTER TABLE public.event_passes 
        ALTER COLUMN description DROP NOT NULL;
        
        COMMENT ON COLUMN public.event_passes.description IS 'Short explanation of what the pass includes. Optional - can be NULL.';
    END IF;
END $$;
