-- Add price fields to events table
-- Run this in your Supabase SQL Editor

-- Add price columns to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS standard_price DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS vip_price DECIMAL(10,2) DEFAULT 0.00;

-- Add comments for documentation
COMMENT ON COLUMN events.standard_price IS 'Price for standard tickets in local currency';
COMMENT ON COLUMN events.vip_price IS 'Price for VIP tickets in local currency';

-- Update existing events with sample prices (optional)
UPDATE events 
SET 
  standard_price = CASE 
    WHEN name LIKE '%Beach Party%' THEN 25.00
    WHEN name LIKE '%Club Night%' THEN 35.00
    WHEN name LIKE '%Sousse%' THEN 20.00
    ELSE 30.00
  END,
  vip_price = CASE 
    WHEN name LIKE '%Beach Party%' THEN 45.00
    WHEN name LIKE '%Club Night%' THEN 60.00
    WHEN name LIKE '%Sousse%' THEN 35.00
    ELSE 50.00
  END
WHERE standard_price = 0.00 OR vip_price = 0.00; 