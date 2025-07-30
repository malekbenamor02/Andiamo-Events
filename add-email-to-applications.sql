-- Add email field to ambassador_applications table
-- Run this in your Supabase SQL Editor

-- Add email column to ambassador_applications table
ALTER TABLE ambassador_applications 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Update existing applications to have a default email if needed
UPDATE ambassador_applications 
SET email = 'noreply@andiamo.com' 
WHERE email IS NULL;

-- Make email required for new applications
ALTER TABLE ambassador_applications 
ALTER COLUMN email SET NOT NULL;

-- Verify the changes
SELECT 'Ambassador applications table structure:' as info;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'ambassador_applications' 
AND column_name IN ('email');

SELECT 'Sample applications with email:' as info;
SELECT id, full_name, email, phone_number, city, status, created_at
FROM ambassador_applications 
LIMIT 5; 