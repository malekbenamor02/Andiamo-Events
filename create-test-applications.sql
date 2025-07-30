-- Create test applications for admin testing
-- Run this in your Supabase SQL Editor

-- Insert test applications
INSERT INTO ambassador_applications (full_name, age, phone_number, city, social_link, motivation, status) 
VALUES 
  ('John Doe', 25, '+21612345678', 'Tunis', 'https://instagram.com/johndoe', 'I love nightlife and want to promote events! I have experience in event marketing and social media.', 'pending'),
  ('Sarah Smith', 23, '+21698765432', 'Monastir', 'https://facebook.com/sarahsmith', 'Passionate about events and networking. I can help bring more people to your events.', 'pending'),
  ('Ahmed Ben Ali', 27, '+21655512345', 'Sousse', 'https://tiktok.com/@ahmedbenali', 'I am very active on social media and have a large following. I can help promote your events effectively.', 'pending'),
  ('Fatima Zahra', 24, '+21677788899', 'Hammamet', 'https://instagram.com/fatimazahra', 'I love the nightlife scene and want to be part of your team. I have great communication skills.', 'pending'),
  ('Mohammed Karray', 26, '+21611122233', 'Nabeul', 'https://facebook.com/mohammedkarray', 'I am enthusiastic about events and have experience in customer service. I can help increase ticket sales.', 'pending')
ON CONFLICT (phone_number) DO NOTHING;

-- Check the applications
SELECT * FROM ambassador_applications ORDER BY created_at DESC; 