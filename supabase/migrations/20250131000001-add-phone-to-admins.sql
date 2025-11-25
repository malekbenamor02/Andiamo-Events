-- Add phone field to admins table
-- This allows super admins to store phone numbers when creating new admins

ALTER TABLE public.admins 
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Create index on phone for faster lookups
CREATE INDEX IF NOT EXISTS idx_admins_phone ON public.admins(phone);

-- Add comment to document the phone field
COMMENT ON COLUMN public.admins.phone IS 'Phone number for admin contact information';

