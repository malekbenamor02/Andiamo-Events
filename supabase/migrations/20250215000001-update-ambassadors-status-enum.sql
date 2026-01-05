-- Update ambassadors table status enum to ACTIVE/PAUSED/DISABLED
-- Migration from old statuses: approved -> ACTIVE, suspended -> PAUSED
-- SAFE: Only updates ambassadors table, does NOT affect ambassador_applications table

-- Step 1: Check current status values (for reference - won't fail if table is empty)
DO $$
DECLARE
  approved_count INTEGER;
  suspended_count INTEGER;
  other_statuses TEXT[];
BEGIN
  -- Count how many records will be affected
  SELECT COUNT(*) INTO approved_count FROM public.ambassadors WHERE status = 'approved';
  SELECT COUNT(*) INTO suspended_count FROM public.ambassadors WHERE status = 'suspended';
  
  -- Log what will be changed (for debugging)
  RAISE NOTICE 'Will update % approved ambassadors to ACTIVE', approved_count;
  RAISE NOTICE 'Will update % suspended ambassadors to PAUSED', suspended_count;
END $$;

-- Step 2: Update existing status values (only where needed)
-- This is safe because:
-- 1. Only updates specific status values (approved, suspended, pending)
-- 2. Does NOT affect ambassador_applications table (separate table)
-- 3. Converts to uppercase to match new constraint
UPDATE public.ambassadors
SET status = CASE
  WHEN LOWER(status) = 'approved' THEN 'ACTIVE'
  WHEN LOWER(status) = 'suspended' THEN 'PAUSED'
  WHEN LOWER(status) = 'pending' THEN 'PENDING'  -- Convert lowercase to uppercase
  WHEN LOWER(status) = 'rejected' THEN 'REJECTED'  -- Convert lowercase to uppercase
  ELSE UPPER(status)  -- Convert any other values to uppercase (safety)
END
WHERE LOWER(status) IN ('approved', 'suspended', 'pending', 'rejected') OR status != UPPER(status);

-- Step 3: Drop existing status constraint (safe - constraint will be recreated)
ALTER TABLE public.ambassadors DROP CONSTRAINT IF EXISTS ambassadors_status_check;

-- Step 4: Add new status constraint
-- Allows: ACTIVE, PAUSED, DISABLED, PENDING, REJECTED
-- Note: This does NOT break ambassador_applications table (different table, different status field)
ALTER TABLE public.ambassadors ADD CONSTRAINT ambassadors_status_check 
  CHECK (status IN ('ACTIVE', 'PAUSED', 'DISABLED', 'PENDING', 'REJECTED'));

-- Step 5: Verify migration (optional check - won't fail if everything is fine)
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  -- Check if any records have invalid status (should be 0)
  SELECT COUNT(*) INTO invalid_count 
  FROM public.ambassadors 
  WHERE status NOT IN ('ACTIVE', 'PAUSED', 'DISABLED', 'PENDING', 'REJECTED');
  
  IF invalid_count > 0 THEN
    RAISE WARNING 'Found % ambassadors with invalid status values. Please review manually.', invalid_count;
  ELSE
    RAISE NOTICE 'Migration successful: All ambassador statuses are valid.';
  END IF;
END $$;

-- Add comment
COMMENT ON COLUMN public.ambassadors.status IS 'Ambassador status: ACTIVE (can receive orders), PAUSED (temporarily paused), DISABLED (permanently disabled), PENDING (application pending), REJECTED (application rejected). Note: This is separate from ambassador_applications.status.';

