-- Create storage bucket for ticket QR codes
-- This bucket stores the QR code images for each ticket
-- 
-- NOTE: Storage policies need to be created manually through Supabase Dashboard
-- or using the Supabase CLI with service role key due to permission restrictions.
-- 
-- Required policies:
-- 1. Public SELECT policy: Allow public read access to ticket QR codes
-- 2. Service role ALL policy: Allow system to upload/manage QR codes
--
-- To create policies manually:
-- Go to Supabase Dashboard > Storage > tickets bucket > Policies
-- Or use Supabase CLI with service role key

-- Insert bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('tickets', 'tickets', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Note: Storage policies are in a separate migration file (20250201000027-create-tickets-storage-policies.sql)
-- Run that file manually via Supabase SQL Editor with service role permissions
-- Or copy the SQL from that file and run it in the Supabase Dashboard SQL Editor

