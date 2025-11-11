-- ============================================
-- VERIFY: Check if migration was applied
-- ============================================
-- Run this in Supabase SQL Editor to check if the migration was applied

-- 1. Check if email column exists
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'ambassador_applications' 
  AND column_name = 'email';

-- 2. Check if SELECT policies exist
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

-- 3. Check all policies on ambassador_applications
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'ambassador_applications';

-- 4. Check all policies on ambassadors
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'ambassadors';

