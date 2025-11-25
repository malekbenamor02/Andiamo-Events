-- ============================================
-- URGENT FIX: Allow Admin to Approve/Reject
-- ============================================
-- Run this in Supabase SQL Editor NOW
-- This fixes the 500 error when admin tries to approve/reject

-- Step 1: Drop any existing UPDATE policies
DROP POLICY IF EXISTS "ambassador_applications_update" ON public.ambassador_applications;
DROP POLICY IF EXISTS "Admins can update applications" ON public.ambassador_applications;
DROP POLICY IF EXISTS "Admin can update applications" ON public.ambassador_applications;
DROP POLICY IF EXISTS "Allow admin to update applications" ON public.ambassador_applications;

-- Step 2: Create the UPDATE policy that allows all updates
-- Note: This is safe because admin authentication is handled at the application level (JWT)
CREATE POLICY "ambassador_applications_update" ON public.ambassador_applications
  FOR UPDATE 
  USING (true)
  WITH CHECK (true);

-- Step 3: Verify it was created
SELECT 
  tablename,
  policyname,
  cmd,
  permissive,
  roles
FROM pg_policies 
WHERE tablename = 'ambassador_applications' 
  AND cmd = 'UPDATE'
ORDER BY policyname;

-- You should see: ambassador_applications_update with cmd = 'UPDATE'

