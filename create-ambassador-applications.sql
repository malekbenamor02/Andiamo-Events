-- Create ambassador_applications table
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS ambassador_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  phone_number TEXT NOT NULL,
  city TEXT NOT NULL,
  social_link TEXT,
  motivation TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_ambassador_applications_status ON ambassador_applications(status);
CREATE INDEX IF NOT EXISTS idx_ambassador_applications_created_at ON ambassador_applications(created_at);

-- Enable Row Level Security
ALTER TABLE ambassador_applications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Anyone can insert applications
DROP POLICY IF EXISTS "Anyone can insert ambassador applications" ON ambassador_applications;
CREATE POLICY "Anyone can insert ambassador applications" ON ambassador_applications
  FOR INSERT WITH CHECK (true);

-- Admin can view all applications
DROP POLICY IF EXISTS "Admin can view all ambassador applications" ON ambassador_applications;
CREATE POLICY "Admin can view all ambassador applications" ON ambassador_applications
  FOR ALL USING (true);

-- Insert a sample application for testing
INSERT INTO ambassador_applications (full_name, age, phone_number, city, social_link, motivation, status) 
VALUES 
  ('John Doe', 25, '+21612345678', 'Tunis', 'https://instagram.com/johndoe', 'I love nightlife and want to promote events!', 'pending'),
  ('Sarah Smith', 23, '+21698765432', 'Monastir', 'https://facebook.com/sarahsmith', 'Passionate about events and networking', 'pending')
ON CONFLICT (phone_number) DO NOTHING; 