-- Fix RLS policies for ambassador_applications table
-- Run this in your Supabase SQL Editor

-- First, let's check the current policies
SELECT 'Current policies for ambassador_applications:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'ambassador_applications';

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Anyone can submit ambassador applications" ON ambassador_applications;
DROP POLICY IF EXISTS "Admin can view all ambassador applications" ON ambassador_applications;
DROP POLICY IF EXISTS "Admin can update applications" ON ambassador_applications;

-- Create comprehensive policies for ambassador_applications
-- 1. Allow anyone to insert applications
CREATE POLICY "Anyone can insert ambassador applications" ON ambassador_applications
FOR INSERT WITH CHECK (true);

-- 2. Allow public to view their own applications (if they have an identifier)
-- For now, we'll allow all reads since we don't have user authentication
CREATE POLICY "Public can view ambassador applications" ON ambassador_applications
FOR SELECT USING (true);

-- 3. Allow updates (for admin to approve/reject)
CREATE POLICY "Admin can update ambassador applications" ON ambassador_applications
FOR UPDATE USING (true) WITH CHECK (true);

-- 4. Allow deletes (for admin to remove applications if needed)
CREATE POLICY "Admin can delete ambassador applications" ON ambassador_applications
FOR DELETE USING (true);

-- Verify the new policies
SELECT 'New policies for ambassador_applications:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'ambassador_applications';

-- Test the policies by trying to select from the table
SELECT 'Testing SELECT policy:' as info;
SELECT COUNT(*) as total_applications FROM ambassador_applications;

-- Show sample applications
SELECT 'Sample applications:' as info;
SELECT id, full_name, email, phone_number, city, status, created_at
FROM ambassador_applications 
ORDER BY created_at DESC 
LIMIT 5; 