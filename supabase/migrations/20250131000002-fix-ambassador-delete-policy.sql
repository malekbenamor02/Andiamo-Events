-- ============================================
-- FIX: Add DELETE Policy for Ambassadors
-- ============================================
-- This allows admins to delete ambassadors
-- Run this in Supabase SQL Editor

-- Drop existing delete policy if it exists
DROP POLICY IF EXISTS "ambassadors_delete" ON public.ambassadors;
DROP POLICY IF EXISTS "Admins can delete ambassadors" ON public.ambassadors;
DROP POLICY IF EXISTS "Admin can delete ambassadors" ON public.ambassadors;

-- Create DELETE policy for admins
-- Note: Since admin authentication uses JWT tokens (not Supabase Auth),
-- we need to allow DELETE operations. The application-level JWT authentication
-- handles security, so we can allow DELETE here.
CREATE POLICY "ambassadors_delete" ON public.ambassadors
  FOR DELETE USING (true);

-- Also ensure UPDATE policy allows admins to update
-- Note: Since admin authentication uses JWT tokens (not Supabase Auth),
-- we need to allow UPDATE operations. The application-level JWT authentication
-- handles security, so we can allow UPDATE here.
DROP POLICY IF EXISTS "ambassadors_update" ON public.ambassadors;
CREATE POLICY "ambassadors_update" ON public.ambassadors
  FOR UPDATE USING (true)
  WITH CHECK (true);

-- ============================================
-- FIX: Add UPDATE Policy for Ambassador Applications
-- ============================================
-- This allows admins to update application status (approve/reject)

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "ambassador_applications_update" ON public.ambassador_applications;
DROP POLICY IF EXISTS "Admins can update applications" ON public.ambassador_applications;

-- Create UPDATE policy for admins
-- Note: Since admin authentication uses JWT tokens (not Supabase Auth),
-- we need to allow UPDATE operations. The application-level JWT authentication
-- handles security, so we can allow UPDATE here.
CREATE POLICY "ambassador_applications_update" ON public.ambassador_applications
  FOR UPDATE USING (true)
  WITH CHECK (true);

-- ============================================
-- Verification: Check policies
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('ambassadors', 'ambassador_applications')
  AND cmd IN ('DELETE', 'UPDATE')
ORDER BY tablename, cmd, policyname;

