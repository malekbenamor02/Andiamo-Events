-- ============================================
-- FIX: Add INSERT Policy for Admins Table
-- ============================================
-- Run this in Supabase SQL Editor
-- This allows super admins to create new admin accounts

-- Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "admins_insert" ON public.admins;
DROP POLICY IF EXISTS "Admins can insert admin data" ON public.admins;
DROP POLICY IF EXISTS "Allow admin insert" ON public.admins;

-- Create INSERT policy for admins
-- Note: Since admin authentication uses JWT tokens (not Supabase Auth),
-- we need to allow INSERT operations. The application-level JWT authentication
-- handles security, so we can allow INSERT here.
CREATE POLICY "admins_insert" ON public.admins
  FOR INSERT 
  WITH CHECK (true);

-- Also ensure UPDATE policy exists (for updating admin accounts)
DROP POLICY IF EXISTS "admins_update" ON public.admins;
CREATE POLICY "admins_update" ON public.admins
  FOR UPDATE 
  USING (true)
  WITH CHECK (true);

-- Verify policies were created
SELECT 
  tablename,
  policyname,
  cmd,
  permissive,
  roles
FROM pg_policies 
WHERE tablename = 'admins'
  AND cmd IN ('INSERT', 'UPDATE')
ORDER BY cmd, policyname;

-- You should see:
-- admins_insert (INSERT)
-- admins_update (UPDATE)

