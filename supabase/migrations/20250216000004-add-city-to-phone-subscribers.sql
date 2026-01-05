-- Migration: Add city column to phone_subscribers table
-- This allows filtering SMS broadcasts by city

-- Add city column if it doesn't exist
ALTER TABLE public.phone_subscribers 
  ADD COLUMN IF NOT EXISTS city TEXT;

-- Add index for better performance when filtering by city
CREATE INDEX IF NOT EXISTS idx_phone_subscribers_city ON public.phone_subscribers(city);

-- Add comment explaining the column
COMMENT ON COLUMN public.phone_subscribers.city IS 
  'City of the subscriber (for filtering SMS broadcasts by location)';

