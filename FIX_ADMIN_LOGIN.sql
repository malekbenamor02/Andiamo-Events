-- ============================================
-- FIX ADMIN LOGIN - Create Admin with Hashed Password
-- ============================================
-- Run this in Supabase SQL Editor

-- Delete existing admin if it has plain text password
DELETE FROM admins WHERE email = 'admin@andiamo.com';

-- Insert admin with properly hashed password (bcrypt)
-- Password: admin123
INSERT INTO admins (name, email, password, role, is_active) 
VALUES (
  'Admin User', 
  'admin@andiamo.com', 
  '$2b$10$UtsIp/UOpTYpXbYuOCbUnusNMdrfyvQeyVgdYEu5GSnuF7U4SkkwW',
  'admin',
  true
)
ON CONFLICT (email) DO UPDATE 
SET 
  password = EXCLUDED.password,
  updated_at = NOW();

-- Verify admin was created
SELECT id, name, email, role, is_active, created_at FROM admins WHERE email = 'admin@andiamo.com';

-- ============================================
-- Login Credentials:
-- Email: admin@andiamo.com
-- Password: admin123
-- ============================================

