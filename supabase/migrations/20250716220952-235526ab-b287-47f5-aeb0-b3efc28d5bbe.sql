-- Create storage bucket for hero images
INSERT INTO storage.buckets (id, name, public) VALUES ('hero-images', 'hero-images', true);

-- Create storage policies for hero images
CREATE POLICY "Hero images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'hero-images');

CREATE POLICY "Anyone can upload hero images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'hero-images');

CREATE POLICY "Anyone can update hero images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'hero-images');

CREATE POLICY "Anyone can delete hero images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'hero-images');

-- Update hero_section content to include image URLs instead of local paths
UPDATE site_content 
SET content = jsonb_set(
  content,
  '{images}',
  '[
    {
      "type": "image",
      "src": "https://ykeryyraxmtjunnotoep.supabase.co/storage/v1/object/public/hero-images/beach-party-monastir.jpg",
      "alt": "Beach Party Monastir"
    },
    {
      "type": "image", 
      "src": "https://ykeryyraxmtjunnotoep.supabase.co/storage/v1/object/public/hero-images/sousse-night-event.jpg",
      "alt": "Sousse Night Event"
    },
    {
      "type": "image",
      "src": "https://ykeryyraxmtjunnotoep.supabase.co/storage/v1/object/public/hero-images/tunis-club-night.jpg", 
      "alt": "Tunis Club Night"
    }
  ]'::jsonb
)
WHERE key = 'hero_section';

-- If hero_section doesn't exist, create it with images
INSERT INTO site_content (key, content) 
SELECT 'hero_section', '{
  "en": {
    "title": "Live the Night with Andiamo",
    "subtitle": "Tunisia'\''s Premier Nightlife Experience",
    "description": "Join thousands of party-goers across Tunisia for unforgettable nights filled with energy, music, and memories that last forever.",
    "cta": "Join the Movement",
    "watchVideo": "Watch Highlights"
  },
  "fr": {
    "title": "Vivez la Nuit avec Andiamo",
    "subtitle": "L'\''Expérience Nocturne Premium de Tunisie",
    "description": "Rejoignez des milliers de fêtards à travers la Tunisie pour des nuits inoubliables remplies d'\''énergie, de musique et de souvenirs qui durent pour toujours.",
    "cta": "Rejoignez le Mouvement",
    "watchVideo": "Voir les Highlights"
  },
  "images": [
    {
      "type": "image",
      "src": "https://ykeryyraxmtjunnotoep.supabase.co/storage/v1/object/public/hero-images/beach-party-monastir.jpg",
      "alt": "Beach Party Monastir"
    },
    {
      "type": "image", 
      "src": "https://ykeryyraxmtjunnotoep.supabase.co/storage/v1/object/public/hero-images/sousse-night-event.jpg",
      "alt": "Sousse Night Event"
    },
    {
      "type": "image",
      "src": "https://ykeryyraxmtjunnotoep.supabase.co/storage/v1/object/public/hero-images/tunis-club-night.jpg", 
      "alt": "Tunis Club Night"
    }
  ]
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM site_content WHERE key = 'hero_section');