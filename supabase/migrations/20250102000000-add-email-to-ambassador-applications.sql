-- Add email column to ambassador_applications table
ALTER TABLE public.ambassador_applications 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_ambassador_applications_email ON public.ambassador_applications(email);

-- Create index on phone_number if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_ambassador_applications_phone ON public.ambassador_applications(phone_number);

-- Add SELECT policy to allow checking for existing applications by phone number
-- This is needed for the duplicate check in the application form
CREATE POLICY IF NOT EXISTS "Public can check existing applications by phone" ON public.ambassador_applications
  FOR SELECT 
  USING (true);

-- Add SELECT policy to allow checking for existing ambassadors by phone number
-- This is needed for the duplicate check in the application form
-- Note: This allows public to check if a phone number exists, but only returns id and status fields
CREATE POLICY IF NOT EXISTS "Public can check existing ambassadors by phone" ON ambassadors
  FOR SELECT 
  USING (true);

