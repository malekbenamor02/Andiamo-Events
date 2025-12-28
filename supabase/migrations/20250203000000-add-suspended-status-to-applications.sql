-- ============================================
-- Add 'suspended' status to ambassador_applications
-- ============================================

-- Update the status check constraint to include 'suspended'
ALTER TABLE public.ambassador_applications 
DROP CONSTRAINT IF EXISTS ambassador_applications_status_check;

ALTER TABLE public.ambassador_applications 
ADD CONSTRAINT ambassador_applications_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'removed', 'suspended'));

-- Update the unique indexes to also exclude 'suspended' status
-- This allows suspended applicants to be reactivated without violating unique constraints
DROP INDEX IF EXISTS idx_ambassador_applications_phone_unique;
DROP INDEX IF EXISTS idx_ambassador_applications_email_unique;

-- Create partial unique index for phone_number (only for pending/approved, exclude removed and suspended)
CREATE UNIQUE INDEX idx_ambassador_applications_phone_unique 
ON public.ambassador_applications(phone_number) 
WHERE status IN ('pending', 'approved') AND phone_number IS NOT NULL;

-- Create partial unique index for email (only for pending/approved, exclude removed and suspended)
CREATE UNIQUE INDEX idx_ambassador_applications_email_unique 
ON public.ambassador_applications(email) 
WHERE status IN ('pending', 'approved') AND email IS NOT NULL AND email != '';

-- ============================================
-- Verification
-- ============================================
-- Check constraint
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.ambassador_applications'::regclass
  AND conname = 'ambassador_applications_status_check';

-- Check indexes
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'ambassador_applications'
  AND indexname LIKE '%unique%'
ORDER BY indexname;

