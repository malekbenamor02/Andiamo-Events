-- Fix Navigation Database Content
-- Run this in your Supabase SQL Editor to ensure navigation is completely clean

-- 1. First, let's see what's currently in the navigation content
SELECT 'Current navigation content:' as info;
SELECT * FROM site_content WHERE key = 'navigation';

-- 2. Delete any existing navigation content that might have gallery
DELETE FROM site_content WHERE key = 'navigation';

-- 3. Insert clean navigation content without gallery
INSERT INTO site_content (key, content) VALUES (
  'navigation',
  '{
    "en": [
      {"name": "Home", "href": "/"},
      {"name": "Events", "href": "/events"},
      {"name": "About", "href": "/about"},
      {"name": "Ambassador", "href": "/ambassador"},
      {"name": "Contact", "href": "/contact"}
    ],
    "fr": [
      {"name": "Accueil", "href": "/"},
      {"name": "Événements", "href": "/events"},
      {"name": "À Propos", "href": "/about"},
      {"name": "Ambassadeur", "href": "/ambassador"},
      {"name": "Contact", "href": "/contact"}
    ]
  }'::jsonb
);

-- 4. Verify the new navigation content
SELECT 'New navigation content:' as info;
SELECT * FROM site_content WHERE key = 'navigation';

-- 5. Check for any remaining gallery references in site_content
SELECT 'Checking for any remaining gallery references:' as info;
SELECT key, content FROM site_content WHERE key LIKE '%gallery%' OR content::text LIKE '%gallery%';

-- 6. Show all site_content entries for verification
SELECT 'All site_content entries:' as info;
SELECT key, content FROM site_content ORDER BY key; 