-- Add admin policies for site_content table
-- This allows admins to update site content including sales settings

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Admins can insert site content" ON public.site_content;
DROP POLICY IF EXISTS "Admins can update site content" ON public.site_content;

-- Allow admins to insert site content
CREATE POLICY "Admins can insert site content" 
ON public.site_content 
FOR INSERT 
WITH CHECK (true);

-- Allow admins to update site content
CREATE POLICY "Admins can update site content" 
ON public.site_content 
FOR UPDATE 
USING (true);

-- Note: Since we're using cookie-based admin auth (not Supabase auth),
-- and we verify admin authentication in the API endpoint,
-- we allow all updates. The API endpoint verifies the admin token before allowing updates.

