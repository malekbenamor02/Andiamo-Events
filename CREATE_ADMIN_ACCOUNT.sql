-- ============================================
-- CREATE ADMIN ACCOUNT WITH HASHED PASSWORD
-- ============================================
-- Run this in Supabase SQL Editor to create/update admin account
-- The password will be hashed using bcrypt

-- First, let's check if admin exists
SELECT * FROM admins WHERE email = 'admin@andiamo.com';

-- Delete existing admin if it has plain text password
DELETE FROM admins WHERE email = 'admin@andiamo.com';

-- Note: You need to hash the password using bcrypt
-- The bcrypt hash for 'admin123' (with salt rounds 10) is:
-- You can generate this using Node.js: bcrypt.hash('admin123', 10)
-- Or use an online bcrypt generator: https://bcrypt-generator.com/

-- Insert admin with hashed password
-- Replace the hash below with a properly hashed password
-- For 'admin123', the hash (salt rounds 10) is approximately: $2a$10$...
-- IMPORTANT: Generate your own hash for security!

INSERT INTO admins (name, email, password, role, is_active) 
VALUES (
  'Admin User', 
  'admin@andiamo.com', 
  '$2a$10$rOzJ8zYxKX5qX5qX5qX5quX5qX5qX5qX5qX5qX5qX5qX5qX5qX5q', -- REPLACE WITH REAL BCRYPT HASH
  'admin',
  true
)
ON CONFLICT (email) DO UPDATE 
SET 
  password = EXCLUDED.password,
  updated_at = NOW();

-- ============================================
-- ALTERNATIVE: Use this Node.js script to generate hash
-- ============================================
-- Run this in Node.js to get the hash:
-- const bcrypt = require('bcryptjs');
-- bcrypt.hash('your-password', 10).then(hash => console.log(hash));

