-- Simple fix for ambassador applications
-- Run this in your Supabase SQL Editor

-- Step 1: Add email column if it doesn't exist
ALTER TABLE ambassador_applications ADD COLUMN IF NOT EXISTS email TEXT;

-- Step 2: Drop existing policies
DROP POLICY IF EXISTS "Anyone can submit ambassador applications" ON ambassador_applications;
DROP POLICY IF EXISTS "Public can view ambassador applications" ON ambassador_applications;
DROP POLICY IF EXISTS "Admin can update ambassador applications" ON ambassador_applications;
DROP POLICY IF EXISTS "Anyone can insert ambassador applications" ON ambassador_applications;
DROP POLICY IF EXISTS "Anyone can view ambassador applications" ON ambassador_applications;
DROP POLICY IF EXISTS "Anyone can update ambassador applications" ON ambassador_applications;
DROP POLICY IF EXISTS "Anyone can delete ambassador applications" ON ambassador_applications;

-- Step 3: Create new policies
CREATE POLICY "Allow all operations on ambassador_applications" ON ambassador_applications
FOR ALL USING (true) WITH CHECK (true);

-- Step 4: Test the fix
SELECT COUNT(*) as total_applications FROM ambassador_applications;

-- Step 5: Test insertion
INSERT INTO ambassador_applications (full_name, age, phone_number, email, city, social_link, motivation, status)
VALUES ('Test User', 25, '+21612345678', 'test@example.com', 'Tunis', 'https://instagram.com/test', 'Test motivation', 'pending')
RETURNING id, full_name, email;

-- Step 6: Show results
SELECT id, full_name, email, phone_number, city, status, created_at
FROM ambassador_applications 
ORDER BY created_at DESC;

-- Step 7: Clean up test data
DELETE FROM ambassador_applications WHERE email = 'test@example.com'; 