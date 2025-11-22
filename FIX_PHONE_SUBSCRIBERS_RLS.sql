-- Fix RLS policies for phone_subscribers table to allow backend inserts
-- Run this in Supabase SQL Editor

-- Drop existing insert policy if it exists
DROP POLICY IF EXISTS "Public can insert phone subscribers" ON public.phone_subscribers;
DROP POLICY IF EXISTS "Allow phone subscriber inserts" ON public.phone_subscribers;

-- Create a more permissive insert policy that allows inserts from backend
CREATE POLICY "Allow phone subscriber inserts" ON public.phone_subscribers
  FOR INSERT 
  WITH CHECK (true);

-- Also ensure the existing select policy works for backend reads
-- Drop and recreate to be safe
DROP POLICY IF EXISTS "Admins can view all phone subscribers" ON public.phone_subscribers;
DROP POLICY IF EXISTS "Allow viewing phone subscribers" ON public.phone_subscribers;

-- Allow anyone to view (needed for backend to read subscribers list)
CREATE POLICY "Allow viewing phone subscribers" ON public.phone_subscribers
  FOR SELECT 
  USING (true);

-- Verify the policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'phone_subscribers';

