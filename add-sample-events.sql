-- Add Sample Events for Testing
-- Run this in your Supabase SQL Editor

-- Add upcoming events
INSERT INTO events (
  name, 
  description, 
  date, 
  venue, 
  city, 
  poster_url, 
  ticket_link, 
  whatsapp_link, 
  featured, 
  standard_price, 
  vip_price, 
  event_type,
  event_status,
  capacity,
  age_restriction,
  dress_code,
  special_notes,
  organizer_contact,
  event_category
) VALUES 
(
  'Beach Party Monastir',
  'Experience the ultimate beach party with international DJs, amazing vibes, and unforgettable moments. Join us for a night of music, dance, and pure entertainment under the stars.',
  '2024-12-28 22:00:00+01',
  'Monastir Beach Club',
  'Monastir',
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=600&fit=crop',
  'https://tickets.andiamo.com/beach-party-monastir',
  'https://wa.me/21612345678?text=Hi! I want to book tickets for Beach Party Monastir',
  true,
  25.00,
  45.00,
  'upcoming',
  'active',
  500,
  18,
  'Beach Casual',
  'Bring your beach vibes and dancing shoes!',
  'contact@andiamo-events.tn',
  'party'
),
(
  'Club Night Tunis',
  'Exclusive club night with premium experience, top-tier DJs, and the best atmosphere in Tunis. VIP tables available with bottle service.',
  '2024-12-30 23:00:00+01',
  'Club Andiamo',
  'Tunis',
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&h=600&fit=crop',
  'https://tickets.andiamo.com/club-night-tunis',
  'https://wa.me/21612345678?text=Hi! I want to book tickets for Club Night Tunis',
  true,
  35.00,
  60.00,
  'upcoming',
  'active',
  300,
  21,
  'Club Attire',
  'VIP tables include bottle service and reserved seating',
  'vip@andiamo-events.tn',
  'party'
),
(
  'Sousse Night Event',
  'Unforgettable night in Sousse with live performances, great music, and amazing atmosphere. Perfect for celebrating with friends.',
  '2025-01-03 21:00:00+01',
  'Night Club Sousse',
  'Sousse',
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&h=600&fit=crop',
  'https://tickets.andiamo.com/sousse-night',
  'https://wa.me/21612345678?text=Hi! I want to book tickets for Sousse Night Event',
  false,
  20.00,
  35.00,
  'upcoming',
  'active',
  400,
  18,
  'Smart Casual',
  'Early bird discounts available until December 25th',
  'sousse@andiamo-events.tn',
  'party'
);

-- Add gallery events (past events with media)
INSERT INTO events (
  name, 
  description, 
  date, 
  venue, 
  city, 
  poster_url, 
  ticket_link, 
  whatsapp_link, 
  featured, 
  standard_price, 
  vip_price, 
  event_type,
  event_status,
  capacity,
  age_restriction,
  dress_code,
  special_notes,
  organizer_contact,
  event_category,
  gallery_images,
  gallery_videos
) VALUES 
(
  'Summer Festival 2024',
  'Amazing summer festival that brought together thousands of people for an unforgettable experience. Live performances, food, and incredible atmosphere.',
  '2024-08-15 20:00:00+01',
  'Central Park',
  'Tunis',
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=600&fit=crop',
  NULL,
  NULL,
  true,
  30.00,
  50.00,
  'gallery',
  'completed',
  2000,
  18,
  'Festival Wear',
  'One of our biggest events of the year!',
  'festival@andiamo-events.tn',
  'festival',
  ARRAY[
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=600&fit=crop'
  ],
  ARRAY[
    'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4'
  ]
),
(
  'Beach Party Sousse 2024',
  'Incredible beach party that rocked Sousse with international DJs and amazing vibes. The perfect summer night.',
  '2024-07-20 22:00:00+01',
  'Sousse Beach',
  'Sousse',
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&h=600&fit=crop',
  NULL,
  NULL,
  true,
  25.00,
  40.00,
  'gallery',
  'completed',
  800,
  18,
  'Beach Casual',
  'The best beach party of the summer!',
  'beach@andiamo-events.tn',
  'party',
  ARRAY[
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&h=600&fit=crop'
  ],
  ARRAY[]
);

-- Verify the events were added
SELECT 'Upcoming Events:' as info;
SELECT name, date, city, event_type, event_status 
FROM events 
WHERE event_type = 'upcoming' OR event_type IS NULL
ORDER BY date;

SELECT 'Gallery Events:' as info;
SELECT name, date, city, event_type, 
       array_length(gallery_images, 1) as image_count,
       array_length(gallery_videos, 1) as video_count
FROM events 
WHERE event_type = 'gallery'
ORDER BY date DESC; 