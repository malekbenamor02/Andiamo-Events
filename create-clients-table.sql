-- Create the clients table to store sales data made by ambassadors
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ambassador_id UUID REFERENCES ambassadors(id) ON DELETE SET NULL,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(255) NOT NULL,
    standard_tickets INT DEFAULT 0,
    vip_tickets INT DEFAULT 0,
    total_amount NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_clients_ambassador_id ON clients(ambassador_id);
CREATE INDEX idx_clients_event_id ON clients(event_id);

-- Enable Row Level Security (RLS) for the clients table
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Allow ambassadors to insert their own sales
CREATE POLICY "Ambassadors can insert their own sales"
ON clients
FOR INSERT
WITH CHECK (auth.uid() = ambassador_id);

-- Allow ambassadors to view their own sales
CREATE POLICY "Ambassadors can view their own sales"
ON clients
FOR SELECT
USING (auth.uid() = ambassador_id);

-- Allow ambassadors to update their own sales
CREATE POLICY "Ambassadors can update their own sales"
ON clients
FOR UPDATE
USING (auth.uid() = ambassador_id);

-- Allow admins to have full access
CREATE POLICY "Admins have full access to clients"
ON clients
FOR ALL
USING (is_admin(auth.uid())); -- Assumes you have an is_admin function

-- Note: You might need to create the is_admin function if it doesn't exist.
-- Here is an example of how you could create it:
/*
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM admins -- Assuming you have an 'admins' table with a 'user_id' column
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/ 