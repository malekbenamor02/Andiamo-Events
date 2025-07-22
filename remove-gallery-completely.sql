-- Complete Gallery Removal Script
-- Copy and paste this in your Supabase SQL Editor to remove ALL gallery content

-- 1. Drop the gallery table completely
DROP TABLE IF EXISTS gallery CASCADE;

-- 2. Remove gallery content from site_content table
DELETE FROM site_content WHERE key = 'gallery_content';

-- 3. Update navigation content to remove gallery references
UPDATE site_content 
SET content = jsonb_set(
  content, 
  '{en}', 
  '[
    {"name": "Home", "href": "/"},
    {"name": "Events", "href": "/events"},
    {"name": "About", "href": "/about"},
    {"name": "Ambassador", "href": "/ambassador"},
    {"name": "Contact", "href": "/contact"}
  ]'::jsonb
)
WHERE key = 'navigation' AND content->'en' IS NOT NULL;

UPDATE site_content 
SET content = jsonb_set(
  content, 
  '{fr}', 
  '[
    {"name": "Accueil", "href": "/"},
    {"name": "Événements", "href": "/events"},
    {"name": "À Propos", "href": "/about"},
    {"name": "Ambassadeur", "href": "/ambassador"},
    {"name": "Contact", "href": "/contact"}
  ]'::jsonb
)
WHERE key = 'navigation' AND content->'fr' IS NOT NULL;

-- 4. Update footer quick links to remove gallery references
-- This will update any existing footer content that might reference gallery

-- 5. Remove any gallery-related storage files (if they exist)
-- Note: This would need to be done manually in the Supabase dashboard
-- Go to Storage > hero-images > gallery folder and delete all files

-- 6. Verify the cleanup
SELECT 'Navigation content:' as info;
SELECT * FROM site_content WHERE key = 'navigation';

SELECT 'Gallery table exists:' as info;
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'gallery'
);

SELECT 'Gallery content exists:' as info;
SELECT * FROM site_content WHERE key LIKE '%gallery%';

-- 7. Check for any remaining gallery references in site_content
SELECT 'All site_content entries:' as info;
SELECT key, content FROM site_content ORDER BY key; 