-- Add social media links and other missing content
-- This migration adds the social_links and other content that the frontend expects

-- Insert social media links
INSERT INTO site_content (key, content) VALUES 
('social_links', '{
  "whatsapp": "https://wa.me/216XXXXXXXX",
  "instagram": "https://instagram.com/andiamo_events",
  "tiktok": "https://tiktok.com/@andiamo_events",
  "facebook": "https://facebook.com/andiamo.events"
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  content = EXCLUDED.content,
  updated_at = now();

-- Insert contact info
INSERT INTO site_content (key, content) VALUES 
('contact_info', '{
  "phone": "+216XXXXXXXX",
  "email": "contact@andiamo-events.tn",
  "address": "Tunisia"
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  content = EXCLUDED.content,
  updated_at = now();

-- Insert navigation content
INSERT INTO site_content (key, content) VALUES 
('navigation', '{
  "en": [
    {"name": "Home", "href": "/"},
    {"name": "Events", "href": "/events"},
    {"name": "Gallery", "href": "/gallery"},
    {"name": "About", "href": "/about"},
    {"name": "Ambassador", "href": "/ambassador"},
    {"name": "Partners", "href": "/partners"},
    {"name": "Contact", "href": "/contact"}
  ],
  "fr": [
    {"name": "Accueil", "href": "/"},
    {"name": "Événements", "href": "/events"},
    {"name": "Galerie", "href": "/gallery"},
    {"name": "À Propos", "href": "/about"},
    {"name": "Ambassadeur", "href": "/ambassador"},
    {"name": "Partenaires", "href": "/partners"},
    {"name": "Contact", "href": "/contact"}
  ]
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  content = EXCLUDED.content,
  updated_at = now();

-- Insert newsletter content
INSERT INTO site_content (key, content) VALUES 
('newsletter_content', '{
  "title": "Stay updated with our latest events",
  "description": "Get exclusive access to our upcoming events and special offers"
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  content = EXCLUDED.content,
  updated_at = now();

-- Insert about section content
INSERT INTO site_content (key, content) VALUES 
('about_section', '{
  "title": "About Andiamo Events",
  "subtitle": "Creating Unforgettable Nightlife Experiences Across Tunisia",
  "description": "Born from a passion for bringing people together through music and nightlife, Andiamo Events has become Tunisia'\''s premier event organization company. We started with a simple vision: to create extraordinary experiences that unite party-goers across the country'\''s most vibrant cities."
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  content = EXCLUDED.content,
  updated_at = now();

-- Insert ambassador content
INSERT INTO site_content (key, content) VALUES 
('ambassador_content', '{
  "title": "Become an Ambassador",
  "description": "Join our team and help us spread the Andiamo experience",
  "benefits": [
    "Exclusive access to events",
    "Commission on ticket sales", 
    "Andiamo merchandise",
    "Networking opportunities"
  ]
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  content = EXCLUDED.content,
  updated_at = now();

-- Insert contact content
INSERT INTO site_content (key, content) VALUES 
('contact_content', '{
  "title": "Get in Touch",
  "description": "Have questions about our events? Want to collaborate? We'\''d love to hear from you!"
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  content = EXCLUDED.content,
  updated_at = now();

-- Insert events content
INSERT INTO site_content (key, content) VALUES 
('events_content', '{
  "title": "Upcoming Events",
  "description": "Join us for unforgettable nights across Tunisia"
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  content = EXCLUDED.content,
  updated_at = now();

-- Insert gallery content
INSERT INTO site_content (key, content) VALUES 
('gallery_content', '{
  "title": "Event Gallery",
  "description": "Relive the best moments from our incredible events"
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  content = EXCLUDED.content,
  updated_at = now();

-- Insert partners content
INSERT INTO site_content (key, content) VALUES 
('partners_content', '{
  "title": "Our Partners",
  "description": "We work with the best venues and brands to bring you amazing experiences"
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  content = EXCLUDED.content,
  updated_at = now();

-- Insert 404 content
INSERT INTO site_content (key, content) VALUES 
('not_found', '{
  "title": "404",
  "subtitle": "Oops! Page not found",
  "linkText": "Return to Home"
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  content = EXCLUDED.content,
  updated_at = now();

-- Insert some sample events
INSERT INTO events (name, description, date, venue, city, poster_url, ticket_link, whatsapp_link, featured) VALUES 
('Summer Beach Party Monastir', 'Join us for an unforgettable beach party in Monastir with the best DJs and live performances.', '2024-08-15 22:00:00+01', 'Beach Club Monastir', 'Monastir', 'https://ykeryyraxmtjunnotoep.supabase.co/storage/v1/object/public/hero-images/beach-party-monastir.jpg', 'https://tickets.andiamo-events.tn/beach-party', 'https://wa.me/216XXXXXXXX?text=Interested%20in%20Beach%20Party', true),
('Tunis Club Night', 'Experience the best of Tunis nightlife with international DJs and premium cocktails.', '2024-08-20 23:00:00+01', 'Club Premium Tunis', 'Tunis', 'https://ykeryyraxmtjunnotoep.supabase.co/storage/v1/object/public/hero-images/tunis-club-night.jpg', 'https://tickets.andiamo-events.tn/club-night', 'https://wa.me/216XXXXXXXX?text=Interested%20in%20Club%20Night', true),
('Sousse Night Festival', 'A three-day festival celebrating music, culture, and nightlife in Sousse.', '2024-09-01 20:00:00+01', 'Sousse Festival Grounds', 'Sousse', 'https://ykeryyraxmtjunnotoep.supabase.co/storage/v1/object/public/hero-images/sousse-night-event.jpg', 'https://tickets.andiamo-events.tn/sousse-festival', 'https://wa.me/216XXXXXXXX?text=Interested%20in%20Sousse%20Festival', true);

-- Insert some sample gallery items
INSERT INTO gallery (title, image_url, city, type) VALUES 
('Beach Party Monastir', 'https://ykeryyraxmtjunnotoep.supabase.co/storage/v1/object/public/hero-images/beach-party-monastir.jpg', 'Monastir', 'photo'),
('Club Night Tunis', 'https://ykeryyraxmtjunnotoep.supabase.co/storage/v1/object/public/hero-images/tunis-club-night.jpg', 'Tunis', 'photo'),
('Sousse Festival', 'https://ykeryyraxmtjunnotoep.supabase.co/storage/v1/object/public/hero-images/sousse-night-event.jpg', 'Sousse', 'photo');

-- Insert some sample sponsors
INSERT INTO sponsors (name, logo_url, description, category, website_url) VALUES 
('Premium Venues', 'https://via.placeholder.com/150x80/6366f1/ffffff?text=Premium+Venues', 'Premium venue partners across Tunisia', 'venue', 'https://premium-venues.tn'),
('Sound Systems Pro', 'https://via.placeholder.com/150x80/10b981/ffffff?text=Sound+Systems', 'Professional sound and lighting equipment', 'tech', 'https://soundsystems.tn'),
('Nightlife Brands', 'https://via.placeholder.com/150x80/f59e0b/ffffff?text=Nightlife+Brands', 'Exclusive nightlife brands and merchandise', 'brand', 'https://nightlife-brands.tn'); 