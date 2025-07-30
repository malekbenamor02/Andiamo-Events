-- Setup Supabase Storage for image uploads
-- Run this in your Supabase SQL Editor

-- Create storage bucket for images
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for the images bucket
-- Allow public read access
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'images');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload images" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'images' AND auth.role() = 'authenticated');

-- Allow authenticated users to update their uploads
CREATE POLICY "Users can update own images" ON storage.objects 
FOR UPDATE USING (bucket_id = 'images' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Users can delete own images" ON storage.objects 
FOR DELETE USING (bucket_id = 'images' AND auth.role() = 'authenticated');

-- For admin access (since we're using anon key), allow all operations
CREATE POLICY "Allow all operations for images" ON storage.objects 
FOR ALL USING (bucket_id = 'images') WITH CHECK (bucket_id = 'images');

-- Check if bucket was created
SELECT * FROM storage.buckets WHERE id = 'images'; 