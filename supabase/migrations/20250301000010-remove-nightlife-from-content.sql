-- Remove "nightlife" wording from site_content and replace with "We create memories" / about description.
-- Run this on existing DBs so content matches the updated app copy.

-- 1. about_section: use about description + We create memories
UPDATE site_content
SET content = '{
  "title": "About Andiamo Events",
  "subtitle": "Creating innovative and inspiring event experiences in Tunisia. We create memories.",
  "description": "Born from a passion for bringing people together through music and events, Andiamo Events has become Tunisia''s premier event organization company. We started with a simple vision: to create extraordinary experiences that unite people across the country''s most vibrant cities."
}'::jsonb,
    updated_at = now()
WHERE key = 'about_section';

-- 2. hero_section: update en/fr subtitles (if row exists)
UPDATE site_content
SET content = jsonb_set(
  jsonb_set(
    COALESCE(content, '{}'::jsonb),
    '{en,subtitle}', '"We Create Memories"'
  ),
  '{fr,subtitle}', '"We Create Memories"'
),
updated_at = now()
WHERE key = 'hero_section';

-- 3. homepage_hero: update subtitle and description (if row exists)
UPDATE site_content
SET content = content || '{
  "subtitle_en": "We Create Memories",
  "subtitle_fr": "We Create Memories",
  "description_en": "Creating innovative and inspiring event experiences in Tunisia. We create memories.",
  "description_fr": "Creating innovative and inspiring event experiences in Tunisia. We create memories."
}'::jsonb,
updated_at = now()
WHERE key = 'homepage_hero';

-- 4. about_us: update descriptions (if row exists)
UPDATE site_content
SET content = content || '{
  "description_en": "Creating innovative and inspiring event experiences in Tunisia. We create memories.",
  "description_fr": "Creating innovative and inspiring event experiences in Tunisia. We create memories."
}'::jsonb,
updated_at = now()
WHERE key = 'about_us';

-- 5. events: replace nightlife in descriptions
UPDATE events
SET description = REPLACE(REPLACE(REPLACE(description, ' nightlife ', ' '), 'nightlife ', ''), ' nightlife', ' ')
WHERE description ILIKE '%nightlife%';

-- 6. sponsors: rename Nightlife Brands and description
UPDATE sponsors
SET name = 'Event Brands',
    description = 'Exclusive event brands and merchandise'
WHERE name = 'Nightlife Brands';
