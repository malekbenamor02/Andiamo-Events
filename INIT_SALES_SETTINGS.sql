-- Initialize sales settings
-- Run this in Supabase SQL Editor

INSERT INTO site_content (key, content) VALUES 
('sales_settings', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  content = EXCLUDED.content,
  updated_at = now();

-- Verify it was created
SELECT key, content, updated_at FROM site_content WHERE key = 'sales_settings';





