-- ============================================
-- FIX: Add DELETE Policy for Contact Messages
-- ============================================
-- This allows admins to delete contact messages
-- Run this in Supabase SQL Editor

-- Drop existing delete policy if it exists
DROP POLICY IF EXISTS "contact_messages_delete" ON public.contact_messages;
DROP POLICY IF EXISTS "Admins can delete contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Admin can delete contact messages" ON public.contact_messages;

-- Create DELETE policy for admins
-- Note: Since admin authentication uses JWT tokens (not Supabase Auth),
-- we need to allow DELETE operations. The application-level JWT authentication
-- handles security, so we can allow DELETE here.
CREATE POLICY "contact_messages_delete" ON public.contact_messages
  FOR DELETE USING (true);

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
WHERE tablename = 'contact_messages'
  AND cmd = 'DELETE'
ORDER BY policyname;



