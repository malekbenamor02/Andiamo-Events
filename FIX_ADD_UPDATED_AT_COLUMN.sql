-- ============================================
-- FIX: Add updated_at column to ambassador_applications
-- ============================================
-- Run this in Supabase SQL Editor
-- This fixes the error: "Could not find the 'updated_at' column"

-- Add updated_at column if it doesn't exist
ALTER TABLE public.ambassador_applications 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create a trigger to automatically update updated_at on row update
CREATE OR REPLACE FUNCTION update_ambassador_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS ambassador_applications_updated_at_trigger ON public.ambassador_applications;

-- Create trigger
CREATE TRIGGER ambassador_applications_updated_at_trigger
  BEFORE UPDATE ON public.ambassador_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_ambassador_applications_updated_at();

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'ambassador_applications' 
  AND column_name = 'updated_at';

-- You should see: updated_at | timestamp with time zone | now()

