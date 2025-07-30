-- Create ambassadors table
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

-- Create clients table
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

-- Create ambassador_events table for event assignments
CREATE TABLE IF NOT EXISTS ambassador_events (
  ambassador_id UUID REFERENCES ambassadors(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (ambassador_id, event_id)
);

-- Create ambassador_performance table
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ambassadors_phone ON ambassadors(phone);
CREATE INDEX IF NOT EXISTS idx_ambassadors_status ON ambassadors(status);
CREATE INDEX IF NOT EXISTS idx_clients_ambassador_id ON clients(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_clients_event_id ON clients(event_id);
CREATE INDEX IF NOT EXISTS idx_ambassador_events_ambassador_id ON ambassador_events(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_ambassador_events_event_id ON ambassador_events(event_id);
CREATE INDEX IF NOT EXISTS idx_ambassador_performance_ambassador_id ON ambassador_performance(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_ambassador_performance_event_id ON ambassador_performance(event_id);

-- Enable Row Level Security (RLS)
ALTER TABLE ambassadors ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE ambassador_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ambassador_performance ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Ambassadors can only see their own data
CREATE POLICY "Ambassadors can view own data" ON ambassadors
  FOR SELECT USING (auth.uid()::text = id::text);

-- Anyone can insert new ambassador applications
CREATE POLICY "Anyone can insert ambassador applications" ON ambassadors
  FOR INSERT WITH CHECK (true);

-- Ambassadors can update their own data
CREATE POLICY "Ambassadors can update own data" ON ambassadors
  FOR UPDATE USING (auth.uid()::text = id::text);

-- Clients policies
CREATE POLICY "Ambassadors can view own clients" ON clients
  FOR SELECT USING (
    ambassador_id IN (
      SELECT id FROM ambassadors WHERE auth.uid()::text = id::text
    )
  );

CREATE POLICY "Ambassadors can insert own clients" ON clients
  FOR INSERT WITH CHECK (
    ambassador_id IN (
      SELECT id FROM ambassadors WHERE auth.uid()::text = id::text
    )
  );

-- Admin can view all data (you'll need to set up admin authentication)
CREATE POLICY "Admin can view all ambassadors" ON ambassadors
  FOR ALL USING (true);

CREATE POLICY "Admin can view all clients" ON clients
  FOR ALL USING (true);

CREATE POLICY "Admin can view all ambassador events" ON ambassador_events
  FOR ALL USING (true);

CREATE POLICY "Admin can view all ambassador performance" ON ambassador_performance
  FOR ALL USING (true); 