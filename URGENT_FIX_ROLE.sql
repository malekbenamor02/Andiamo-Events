-- ============================================
-- URGENT: Fix Your Role to Super Admin
-- ============================================
-- Copy and paste this ENTIRE block into Supabase SQL Editor and run it

-- Step 1: Check your current role
SELECT 
  email,
  role,
  is_active,
  updated_at
FROM admins 
WHERE email LIKE '%malekbenamor02%';

-- Step 2: Update your role to super_admin
UPDATE admins 
SET 
  role = 'super_admin',
  updated_at = NOW()
WHERE email = 'malekbenamor02@icloud.com' 
   OR email = 'malekbenamor02@icloud'
   OR email LIKE '%malekbenamor02%';

-- Step 3: Verify the update worked
SELECT 
  email,
  role,
  is_active
FROM admins 
WHERE email LIKE '%malekbenamor02%';

-- Expected result: role should now be 'super_admin'
-- ============================================
-- AFTER RUNNING THIS SQL:
-- 1. Go back to your admin dashboard
-- 2. Click LOGOUT (important!)
-- 3. Log back in with:
--    Email: malekbenamor02@icloud.com (or malekbenamor02@icloud)
--    Password: 022006
-- 4. The "Admins" tab should now appear!
-- ============================================

