-- ============================================
-- FIX: Ambassador Application Duplicate Check
-- ============================================
-- Run this SQL in your Supabase Dashboard -> SQL Editor
-- This fixes the "Already Applied" error that shows for everyone

-- 1. Add email column to ambassador_applications table
ALTER TABLE public.ambassador_applications 
ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_ambassador_applications_email ON public.ambassador_applications(email);

-- 3. Create index on phone_number if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_ambassador_applications_phone ON public.ambassador_applications(phone_number);

-- 4. Add SELECT policy to allow checking for existing applications by phone number
-- This is needed for the duplicate check in the application form
DROP POLICY IF EXISTS "Public can check existing applications by phone" ON public.ambassador_applications;
CREATE POLICY "Public can check existing applications by phone" ON public.ambassador_applications
  FOR SELECT 
  USING (true);

-- 5. Add SELECT policy to allow checking for existing ambassadors by phone number
-- This is needed for the duplicate check in the application form
DROP POLICY IF EXISTS "Public can check existing ambassadors by phone" ON ambassadors;
CREATE POLICY "Public can check existing ambassadors by phone" ON ambassadors
  FOR SELECT 
  USING (true);

-- ============================================
-- Verification: Check if policies were created
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
WHERE tablename IN ('ambassador_applications', 'ambassadors')
  AND policyname LIKE '%check%'
ORDER BY tablename, policyname;

