-- Add ville column to ambassador_applications table
ALTER TABLE public.ambassador_applications 
ADD COLUMN IF NOT EXISTS ville TEXT;

-- Create index for ville column
CREATE INDEX IF NOT EXISTS idx_ambassador_applications_ville ON public.ambassador_applications(ville);

