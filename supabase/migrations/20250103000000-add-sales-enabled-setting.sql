-- Add sales_enabled setting to site_content
-- This allows admin to enable/disable sales for ambassadors

INSERT INTO site_content (key, content) VALUES 
('sales_settings', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  content = EXCLUDED.content,
  updated_at = now();


