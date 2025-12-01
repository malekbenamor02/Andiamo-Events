-- Update email address to support@andiamoevents.com across all site content
-- This migration updates the contact_info email in site_content table

-- Update contact_info email
UPDATE site_content 
SET content = jsonb_set(
  content, 
  '{email}', 
  '"support@andiamoevents.com"'
)
WHERE key = 'contact_info' 
  AND content ? 'email';

-- If contact_info doesn't exist, create it with the new email
INSERT INTO site_content (key, content) 
VALUES (
  'contact_info', 
  '{"email": "support@andiamoevents.com", "phone": "+216XXXXXXXX", "address": "Tunisia"}'::jsonb
)
ON CONFLICT (key) DO UPDATE SET 
  content = jsonb_set(
    COALESCE(site_content.content, '{}'::jsonb),
    '{email}',
    '"support@andiamoevents.com"'
  ),
  updated_at = now();

