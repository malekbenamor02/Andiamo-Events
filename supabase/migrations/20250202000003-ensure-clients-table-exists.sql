-- ============================================
-- Ensure clients table exists with correct structure
-- ============================================

-- Create clients table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ambassador_id UUID REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
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

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_clients_ambassador_id ON public.clients(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_clients_event_id ON public.clients(event_id);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can manage clients" ON public.clients;
DROP POLICY IF EXISTS "Public can view clients" ON public.clients;
DROP POLICY IF EXISTS "Public can insert clients" ON public.clients;
DROP POLICY IF EXISTS "clients_select" ON public.clients;
DROP POLICY IF EXISTS "clients_insert" ON public.clients;

-- Create RLS policies (allow public read for admin dashboard)
CREATE POLICY "Service role can manage clients" ON public.clients
  FOR ALL USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  );

CREATE POLICY "Public can view clients" ON public.clients
  FOR SELECT USING (true);

CREATE POLICY "Public can insert clients" ON public.clients
  FOR INSERT WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.clients IS 'Customer information linked to ambassadors and events. May be deprecated in favor of orders table.';

