-- ============================================
-- FIX: Add Unique Constraints for Applications
-- ============================================
-- This prevents duplicate emails and phone numbers at the database level
-- Run this in Supabase SQL Editor

-- First, clean up any existing duplicates (keep the most recent one)
-- Only clean up duplicates for pending/approved statuses (rejected can have duplicates)
-- For phone numbers
WITH ranked_apps AS (
  SELECT 
    id,
    phone_number,
    email,
    created_at,
    status,
    ROW_NUMBER() OVER (
      PARTITION BY phone_number 
      ORDER BY 
        CASE WHEN status = 'approved' THEN 1 
             WHEN status = 'pending' THEN 2 
             ELSE 3 END,
        created_at DESC
    ) as rn
  FROM public.ambassador_applications
  WHERE phone_number IS NOT NULL
    AND status IN ('pending', 'approved')
)
DELETE FROM public.ambassador_applications
WHERE id IN (
  SELECT id FROM ranked_apps WHERE rn > 1
);

-- For emails (if email is provided)
WITH ranked_apps AS (
  SELECT 
    id,
    email,
    created_at,
    status,
    ROW_NUMBER() OVER (
      PARTITION BY email 
      ORDER BY 
        CASE WHEN status = 'approved' THEN 1 
             WHEN status = 'pending' THEN 2 
             ELSE 3 END,
        created_at DESC
    ) as rn
  FROM public.ambassador_applications
  WHERE email IS NOT NULL 
    AND email != ''
    AND status IN ('pending', 'approved')
)
DELETE FROM public.ambassador_applications
WHERE id IN (
  SELECT id FROM ranked_apps WHERE rn > 1
);

-- Add unique constraint on phone_number (only for pending and approved statuses)
-- Note: We can't use a simple UNIQUE constraint because we allow multiple rejected applications
-- Instead, we'll use a partial unique index

-- Drop existing indexes if they exist
DROP INDEX IF EXISTS idx_ambassador_applications_phone_unique;
DROP INDEX IF EXISTS idx_ambassador_applications_email_unique;

-- Create partial unique index for phone_number (only for pending/approved)
CREATE UNIQUE INDEX idx_ambassador_applications_phone_unique 
ON public.ambassador_applications(phone_number) 
WHERE status IN ('pending', 'approved') AND phone_number IS NOT NULL;

-- Create partial unique index for email (only for pending/approved, and only if email is provided)
CREATE UNIQUE INDEX idx_ambassador_applications_email_unique 
ON public.ambassador_applications(email) 
WHERE status IN ('pending', 'approved') AND email IS NOT NULL AND email != '';

-- ============================================
-- FIX: Ensure UPDATE Policy for Applications
-- ============================================
-- This allows admins to approve/reject applications
-- (Re-running to ensure it exists)

DROP POLICY IF EXISTS "ambassador_applications_update" ON public.ambassador_applications;
DROP POLICY IF EXISTS "Admins can update applications" ON public.ambassador_applications;
DROP POLICY IF EXISTS "Admin can update applications" ON public.ambassador_applications;

-- Create UPDATE policy for admins
-- Note: Since admin authentication uses JWT tokens (not Supabase Auth),
-- we need to allow UPDATE operations. The application-level JWT authentication
-- handles security, so we can allow UPDATE here.
CREATE POLICY "ambassador_applications_update" ON public.ambassador_applications
  FOR UPDATE USING (true)
  WITH CHECK (true);

-- ============================================
-- Verification: Check constraints and policies
-- ============================================
-- Check unique indexes
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'ambassador_applications'
  AND indexname LIKE '%unique%'
ORDER BY indexname;

-- Check UPDATE policy
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'ambassador_applications'
  AND cmd = 'UPDATE'
ORDER BY policyname;

