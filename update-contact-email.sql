-- Quick SQL script to update contact email to contact@andiamoevents.com
-- Run this in your Supabase SQL Editor or database console

-- Update contact_info email in site_content table
UPDATE site_content 
SET content = jsonb_set(
  content, 
  '{email}', 
  '"contact@andiamoevents.com"'
)
WHERE key = 'contact_info' 
  AND content ? 'email';

-- If contact_info doesn't exist, create it with the new email
INSERT INTO site_content (key, content) 
VALUES (
  'contact_info', 
  '{"email": "contact@andiamoevents.com", "phone": "+216XXXXXXXX", "address": "Tunisia"}'::jsonb
)
ON CONFLICT (key) DO UPDATE SET 
  content = jsonb_set(
    COALESCE(site_content.content, '{}'::jsonb),
    '{email}',
    '"contact@andiamoevents.com"'
  ),
  updated_at = now();

-- Verify the update
SELECT key, content->>'email' as email 
FROM site_content 
WHERE key = 'contact_info';

