-- Check and fix ambassador_applications table structure
-- Run this in your Supabase SQL Editor

-- 1. Check current table structure
SELECT 'Current table structure:' as info;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'ambassador_applications' 
ORDER BY ordinal_position;

-- 2. Check if email column exists
SELECT 'Checking for email column:' as info;
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'ambassador_applications' 
AND column_name = 'email';

-- 3. Add email column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ambassador_applications' 
        AND column_name = 'email'
    ) THEN
        ALTER TABLE ambassador_applications ADD COLUMN email TEXT;
        RAISE NOTICE 'Email column added to ambassador_applications table';
    ELSE
        RAISE NOTICE 'Email column already exists';
    END IF;
END $$;

-- 4. Check current RLS policies
SELECT 'Current RLS policies:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'ambassador_applications';

-- 5. Drop existing restrictive policies
DROP POLICY IF EXISTS "Anyone can submit ambassador applications" ON ambassador_applications;
DROP POLICY IF EXISTS "Public can view ambassador applications" ON ambassador_applications;
DROP POLICY IF EXISTS "Admin can update ambassador applications" ON ambassador_applications;

-- 6. Create new comprehensive policies
-- Allow anyone to insert applications
CREATE POLICY "Anyone can insert ambassador applications" ON ambassador_applications
FOR INSERT WITH CHECK (true);

-- Allow anyone to view applications (for admin dashboard)
CREATE POLICY "Anyone can view ambassador applications" ON ambassador_applications
FOR SELECT USING (true);

-- Allow updates (for admin to approve/reject)
CREATE POLICY "Anyone can update ambassador applications" ON ambassador_applications
FOR UPDATE USING (true) WITH CHECK (true);

-- Allow deletes (for admin to remove applications if needed)
CREATE POLICY "Anyone can delete ambassador applications" ON ambassador_applications
FOR DELETE USING (true);

-- 7. Verify new policies
SELECT 'New RLS policies:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'ambassador_applications';

-- 8. Test the policies
SELECT 'Testing policies - counting applications:' as info;
SELECT COUNT(*) as total_applications FROM ambassador_applications;

-- 9. Test insertion
SELECT 'Testing insertion policy:' as info;
INSERT INTO ambassador_applications (full_name, age, phone_number, email, city, social_link, motivation, status)
VALUES ('Test User', 25, '+21612345678', 'test@example.com', 'Tunis', 'https://instagram.com/test', 'Test motivation', 'pending')
RETURNING id, full_name, email;

-- 10. Show all applications
SELECT 'All applications after test:' as info;
SELECT id, full_name, email, phone_number, city, status, created_at
FROM ambassador_applications 
ORDER BY created_at DESC;

-- 11. Clean up test data
DELETE FROM ambassador_applications WHERE email = 'test@example.com';
SELECT 'Test data cleaned up' as info; 