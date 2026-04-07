-- Find rows that still point at Supabase Storage public URLs (run in SQL editor).

SELECT id, name, poster_url
FROM events
WHERE poster_url IS NOT NULL
  AND poster_url ILIKE '%supabase.co/storage/v1/object/public/%';

SELECT id, name, logo_url
FROM sponsors
WHERE logo_url IS NOT NULL
  AND logo_url ILIKE '%supabase.co/storage/v1/object/public/%';

SELECT key
FROM site_content
WHERE content::text ILIKE '%supabase.co/storage/v1/object/public/%';
