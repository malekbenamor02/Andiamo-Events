-- ============================================
-- FIX SUPER ADMIN ROLE
-- ============================================
-- Run this in Supabase SQL Editor to update your role to super_admin
-- After running this, you MUST log out and log back in for the changes to take effect

-- Update role to super_admin for your email
UPDATE admins 
SET 
  role = 'super_admin',
  updated_at = NOW()
WHERE email = 'malekbenamor02@icloud.com' OR email = 'malekbenamor02@icloud';

-- Verify the update
SELECT 
  id,
  name,
  email,
  role,
  is_active,
  updated_at
FROM admins 
WHERE email = 'malekbenamor02@icloud.com' OR email = 'malekbenamor02@icloud';

-- Expected result: role should be 'super_admin'
-- ============================================
-- IMPORTANT: After running this SQL:
-- 1. Log out from the admin dashboard
-- 2. Log back in with your credentials
-- 3. The "Admins" tab should now appear
-- ============================================

