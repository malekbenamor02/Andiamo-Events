-- ============================================
-- Ensure manually_added column exists in ambassador_applications
-- ============================================

-- Add manually_added column if it doesn't exist
ALTER TABLE public.ambassador_applications 
ADD COLUMN IF NOT EXISTS manually_added BOOLEAN DEFAULT false;

-- Update any existing NULL values to false
UPDATE public.ambassador_applications 
SET manually_added = false 
WHERE manually_added IS NULL;

-- Set NOT NULL constraint (after updating NULLs)
ALTER TABLE public.ambassador_applications 
ALTER COLUMN manually_added SET NOT NULL;

-- Set default value
ALTER TABLE public.ambassador_applications 
ALTER COLUMN manually_added SET DEFAULT false;

-- ============================================
-- Verification
-- ============================================
-- Check if column exists
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ambassador_applications'
  AND column_name = 'manually_added';

