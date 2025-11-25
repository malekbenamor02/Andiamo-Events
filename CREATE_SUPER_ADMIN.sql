-- ============================================
-- CREATE SUPER ADMIN ACCOUNT
-- ============================================
-- Run this in Supabase SQL Editor
-- This creates a super admin account with the ability to add new admins

-- Insert super admin with hashed password
-- Email: malekbenamor02@icloud.com (or malekbenamor02@icloud - check which one you use)
-- Password: 022006
-- NOTE: Update the email below to match the exact email you use to login

INSERT INTO admins (name, email, password, role, is_active) 
VALUES (
  'Super Admin', 
  'malekbenamor02@icloud.com', 
  '$2b$10$hlJ786UOHTIgrT5ooIHmdOKpufV/4xQ5QHUvtx7IPbfs75MXfjCD6',
  'super_admin',
  true
)
ON CONFLICT (email) DO UPDATE 
SET 
  password = EXCLUDED.password,
  role = 'super_admin',
  updated_at = NOW();

-- Also create/update for the version without .com (if needed)
INSERT INTO admins (name, email, password, role, is_active) 
VALUES (
  'Super Admin', 
  'malekbenamor02@icloud', 
  '$2b$10$hlJ786UOHTIgrT5ooIHmdOKpufV/4xQ5QHUvtx7IPbfs75MXfjCD6',
  'super_admin',
  true
)
ON CONFLICT (email) DO UPDATE 
SET 
  password = EXCLUDED.password,
  role = 'super_admin',
  updated_at = NOW();

-- Verify super admin was created
SELECT id, name, email, role, is_active, created_at FROM admins 
WHERE email = 'malekbenamor02@icloud.com' OR email = 'malekbenamor02@icloud';

-- ============================================
-- Login Credentials:
-- Email: malekbenamor02@icloud.com (or malekbenamor02@icloud)
-- Password: 022006
-- 
-- IMPORTANT: Make sure the email you use to login matches 
-- exactly the email in the database (with or without .com)
-- ============================================

