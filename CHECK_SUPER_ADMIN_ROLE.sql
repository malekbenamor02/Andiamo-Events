-- ============================================
-- CHECK SUPER ADMIN ROLE
-- ============================================
-- Run this in Supabase SQL Editor to verify your admin account has the correct role

-- Check all admins and their roles
SELECT 
  id,
  name,
  email,
  role,
  is_active,
  created_at,
  updated_at
FROM admins
ORDER BY created_at DESC;

-- Check specific admin by email
SELECT 
  id,
  name,
  email,
  role,
  is_active
FROM admins
WHERE email = 'malekbenamor02@icloud' OR email = 'malekbenamor02@icloud.com';

-- If the role is not 'super_admin', update it:
-- UPDATE admins 
-- SET role = 'super_admin', updated_at = NOW()
-- WHERE email = 'malekbenamor02@icloud' OR email = 'malekbenamor02@icloud.com';

