-- Create pass_purchases table
CREATE TABLE IF NOT EXISTS pass_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  pass_type VARCHAR(50) NOT NULL CHECK (pass_type IN ('standard', 'vip')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  total_price DECIMAL(10,2) NOT NULL CHECK (total_price >= 0),
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50) NOT NULL,
  customer_city VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'refunded')),
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pass_purchases_event_id ON pass_purchases(event_id);
CREATE INDEX IF NOT EXISTS idx_pass_purchases_customer_email ON pass_purchases(customer_email);
CREATE INDEX IF NOT EXISTS idx_pass_purchases_status ON pass_purchases(status);
CREATE INDEX IF NOT EXISTS idx_pass_purchases_created_at ON pass_purchases(created_at);

-- Add RLS policies
ALTER TABLE pass_purchases ENABLE ROW LEVEL SECURITY;

-- Allow admins to view all purchases
CREATE POLICY "Admins can view all pass purchases" ON pass_purchases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admins WHERE id = auth.uid()
    )
  );

-- Allow admins to insert/update/delete purchases
CREATE POLICY "Admins can manage pass purchases" ON pass_purchases
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admins WHERE id = auth.uid()
    )
  );

-- Allow public to insert purchases (for the purchase form)
CREATE POLICY "Public can insert pass purchases" ON pass_purchases
  FOR INSERT WITH CHECK (true);

-- Allow customers to view their own purchases (by email)
CREATE POLICY "Customers can view their own purchases" ON pass_purchases
  FOR SELECT USING (
    customer_email = auth.jwt() ->> 'email'
  );

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pass_purchases_updated_at 
  BEFORE UPDATE ON pass_purchases 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 