-- Create ambassador_applications table
-- Run this in your Supabase SQL Editor

-- Drop table if it exists (for testing)
DROP TABLE IF EXISTS ambassador_applications;

-- Create ambassador_applications table
CREATE TABLE ambassador_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 16 AND age <= 99),
  phone_number TEXT NOT NULL,
  email TEXT NOT NULL,
  city TEXT NOT NULL,
  social_link TEXT,
  motivation TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ambassador_applications_status ON ambassador_applications(status);
CREATE INDEX IF NOT EXISTS idx_ambassador_applications_created_at ON ambassador_applications(created_at);
CREATE INDEX IF NOT EXISTS idx_ambassador_applications_phone ON ambassador_applications(phone_number);

-- Enable Row Level Security (RLS)
ALTER TABLE ambassador_applications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Anyone can insert new applications
CREATE POLICY "Anyone can insert ambassador applications" ON ambassador_applications
  FOR INSERT WITH CHECK (true);

-- Admin can view all applications
CREATE POLICY "Admin can view all applications" ON ambassador_applications
  FOR SELECT USING (true);

-- Admin can update application status
CREATE POLICY "Admin can update applications" ON ambassador_applications
  FOR UPDATE USING (true);

-- Insert some test data
INSERT INTO ambassador_applications (full_name, age, phone_number, email, city, social_link, motivation, status) VALUES
('John Doe', 25, '+21612345678', 'john.doe@example.com', 'Tunis', 'https://instagram.com/johndoe', 'I love nightlife and want to help promote amazing events!', 'pending'),
('Sarah Smith', 28, '+21687654321', 'sarah.smith@example.com', 'Sousse', 'https://facebook.com/sarahsmith', 'Passionate about connecting people through great events.', 'pending'),
('Ahmed Ben Ali', 23, '+21611223344', 'ahmed.benali@example.com', 'Monastir', NULL, 'Looking to earn extra income while being part of the nightlife scene.', 'pending');

-- Verify the table structure
SELECT 'Ambassador applications table structure:' as info;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'ambassador_applications'
ORDER BY ordinal_position;

-- Verify the test data
SELECT 'Test applications:' as info;
SELECT id, full_name, age, phone_number, email, city, status, created_at
FROM ambassador_applications 
ORDER BY created_at DESC; 