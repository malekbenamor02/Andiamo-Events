-- Create tables for Andiamo Nightlife Vibes
-- Run these commands in your Supabase SQL Editor

-- 1. Create admins table
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

-- 2. Create ambassadors table
CREATE TABLE IF NOT EXISTS ambassadors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  city TEXT NOT NULL,
  password TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  commission_rate DECIMAL(5,2) DEFAULT 10.00,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ambassador_id UUID REFERENCES ambassadors(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  age INTEGER,
  standard_tickets INTEGER DEFAULT 0,
  vip_tickets INTEGER DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create ambassador_events table
CREATE TABLE IF NOT EXISTS ambassador_events (
  ambassador_id UUID REFERENCES ambassadors(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (ambassador_id, event_id)
);

-- 5. Create ambassador_performance table
CREATE TABLE IF NOT EXISTS ambassador_performance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ambassador_id UUID REFERENCES ambassadors(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  sales_count INTEGER DEFAULT 0,
  revenue_generated DECIMAL(10,2) DEFAULT 0.00,
  commission_earned DECIMAL(10,2) DEFAULT 0.00,
  rank INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_ambassadors_phone ON ambassadors(phone);
CREATE INDEX IF NOT EXISTS idx_ambassadors_status ON ambassadors(status);
CREATE INDEX IF NOT EXISTS idx_clients_ambassador_id ON clients(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_clients_event_id ON clients(event_id);
CREATE INDEX IF NOT EXISTS idx_ambassador_events_ambassador_id ON ambassador_events(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_ambassador_events_event_id ON ambassador_events(event_id);
CREATE INDEX IF NOT EXISTS idx_ambassador_performance_ambassador_id ON ambassador_performance(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_ambassador_performance_event_id ON ambassador_performance(event_id);

-- 7. Enable Row Level Security (RLS)
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE ambassadors ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE ambassador_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ambassador_performance ENABLE ROW LEVEL SECURITY;

-- 8. Create RLS policies
-- Admins can view admin data
DROP POLICY IF EXISTS "Admins can view admin data" ON admins;
CREATE POLICY "Admins can view admin data" ON admins
  FOR ALL USING (true);

-- Ambassadors can only see their own data
DROP POLICY IF EXISTS "Ambassadors can view own data" ON ambassadors;
CREATE POLICY "Ambassadors can view own data" ON ambassadors
  FOR SELECT USING (auth.uid()::text = id::text);

-- Anyone can insert new ambassador applications
DROP POLICY IF EXISTS "Anyone can insert ambassador applications" ON ambassadors;
CREATE POLICY "Anyone can insert ambassador applications" ON ambassadors
  FOR INSERT WITH CHECK (true);

-- Ambassadors can update their own data
DROP POLICY IF EXISTS "Ambassadors can update own data" ON ambassadors;
CREATE POLICY "Ambassadors can update own data" ON ambassadors
  FOR UPDATE USING (auth.uid()::text = id::text);

-- Clients policies
DROP POLICY IF EXISTS "Ambassadors can view own clients" ON clients;
CREATE POLICY "Ambassadors can view own clients" ON clients
  FOR SELECT USING (
    ambassador_id IN (
      SELECT id FROM ambassadors WHERE auth.uid()::text = id::text
    )
  );

DROP POLICY IF EXISTS "Ambassadors can insert own clients" ON clients;
CREATE POLICY "Ambassadors can insert own clients" ON clients
  FOR INSERT WITH CHECK (
    ambassador_id IN (
      SELECT id FROM ambassadors WHERE auth.uid()::text = id::text
    )
  );

-- Admin can view all data
DROP POLICY IF EXISTS "Admin can view all ambassadors" ON ambassadors;
CREATE POLICY "Admin can view all ambassadors" ON ambassadors
  FOR ALL USING (true);

DROP POLICY IF EXISTS "Admin can view all clients" ON clients;
CREATE POLICY "Admin can view all clients" ON clients
  FOR ALL USING (true);

DROP POLICY IF EXISTS "Admin can view all ambassador events" ON ambassador_events;
CREATE POLICY "Admin can view all ambassador events" ON ambassador_events
  FOR ALL USING (true);

DROP POLICY IF EXISTS "Admin can view all ambassador performance" ON ambassador_performance;
CREATE POLICY "Admin can view all ambassador performance" ON ambassador_performance
  FOR ALL USING (true);

-- 9. Insert default admin user
INSERT INTO admins (name, email, password, role, is_active) 
VALUES ('Admin', 'admin@andiamo.com', 'admin123', 'admin', true)
ON CONFLICT (email) DO NOTHING;

-- 10. Insert sample events
INSERT INTO events (name, date, city, venue, description, featured, ticket_link, whatsapp_link) 
VALUES 
  ('Beach Party Monastir', '2024-08-15', 'Monastir', 'Beach Club', 'Amazing beach party with international DJs', true, 'https://tickets.andiamo.com/beach-party', 'https://wa.me/21612345678'),
  ('Club Night Tunis', '2024-08-20', 'Tunis', 'Club Andiamo', 'Exclusive club night with premium experience', true, 'https://tickets.andiamo.com/club-night', 'https://wa.me/21612345678'),
  ('Sousse Night Event', '2024-08-25', 'Sousse', 'Night Club Sousse', 'Unforgettable night in Sousse', false, 'https://tickets.andiamo.com/sousse-night', 'https://wa.me/21612345678')
ON CONFLICT (name) DO NOTHING; 