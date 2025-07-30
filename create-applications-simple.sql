-- Create ambassador_applications table (simple version for testing)
-- Run this in your Supabase SQL Editor

-- Drop table if exists
DROP TABLE IF EXISTS ambassador_applications;

-- Create ambassador_applications table
CREATE TABLE ambassador_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  phone_number TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  social_link TEXT,
  motivation TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX idx_ambassador_applications_status ON ambassador_applications(status);
CREATE INDEX idx_ambassador_applications_created_at ON ambassador_applications(created_at);

-- Insert test applications
INSERT INTO ambassador_applications (full_name, age, phone_number, city, social_link, motivation, status) 
VALUES 
  ('John Doe', 25, '+21612345678', 'Tunis', 'https://instagram.com/johndoe', 'I love nightlife and want to promote events! I have experience in event marketing and social media.', 'pending'),
  ('Sarah Smith', 23, '+21698765432', 'Monastir', 'https://facebook.com/sarahsmith', 'Passionate about events and networking. I can help bring more people to your events.', 'pending'),
  ('Ahmed Ben Ali', 27, '+21655512345', 'Sousse', 'https://tiktok.com/@ahmedbenali', 'I am very active on social media and have a large following. I can help promote your events effectively.', 'pending'),
  ('Fatima Zahra', 24, '+21677788899', 'Hammamet', 'https://instagram.com/fatimazahra', 'I love the nightlife scene and want to be part of your team. I have great communication skills.', 'pending'),
  ('Mohammed Karray', 26, '+21611122233', 'Nabeul', 'https://facebook.com/mohammedkarray', 'I am enthusiastic about events and have experience in customer service. I can help increase ticket sales.', 'pending');

-- Check the applications
SELECT * FROM ambassador_applications ORDER BY created_at DESC; 