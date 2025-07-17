-- Add social media links to site_content
INSERT INTO public.site_content (key, content) VALUES 
('social_links', '{"tiktok": "", "whatsapp": "", "instagram": "", "facebook": ""}'),
('hero_section', '{"title": "Welcome to Andiamo", "subtitle": "The Ultimate Nightlife Experience", "description": "Join us for unforgettable nights filled with music, dancing, and amazing vibes in Tunisia''s hottest venues."}'),
('about_section', '{"title": "About Andiamo", "description": "Andiamo is Tunisia''s premier nightlife brand, bringing you the hottest parties and events across the country. From exclusive club nights to beach parties, we create unforgettable experiences that bring people together through music and celebration."}'),
('contact_info', '{"email": "contact@andiamo.tn", "phone": "+216 XX XXX XXX", "address": "Tunisia"}'),
('newsletter_content', '{"title": "Stay Updated", "description": "Subscribe to our newsletter for the latest events and exclusive offers"}'),
('gallery_content', '{"title": "Event Gallery", "description": "Relive the magic of our unforgettable nights"}'),
('events_content', '{"title": "Upcoming Events", "description": "Don''t miss out on the hottest parties in Tunisia"}'),
('partners_content', '{"title": "Our Partners", "description": "We work with the best venues and brands to bring you amazing experiences"}'),
('ambassador_content', '{"title": "Become an Ambassador", "description": "Join our team and help us spread the Andiamo experience", "benefits": ["Exclusive access to events", "Commission on ticket sales", "Andiamo merchandise", "Networking opportunities"]}}')
ON CONFLICT (key) DO NOTHING;