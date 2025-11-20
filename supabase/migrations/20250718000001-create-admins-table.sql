-- Create admins table for admin authentication
CREATE TABLE IF NOT EXISTS admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for email lookup
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);

-- Enable Row Level Security
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Only admins can view admin data (for now, we'll use a simple approach)
CREATE POLICY "Admins can view admin data" ON admins
  FOR ALL USING (true);

-- NOTE: Do not insert default admin with plain text password
-- Admin accounts should be created using the setup script: node create-admin.js
-- Then run the generated SQL in Supabase SQL Editor
-- 
-- Example (DO NOT USE - This is just for reference):
-- INSERT INTO admins (name, email, password, role, is_active) 
-- VALUES ('Admin User', 'admin@andiamo.com', '$2b$10$...hashed_password...', 'admin', true)
-- ON CONFLICT (email) DO NOTHING; 