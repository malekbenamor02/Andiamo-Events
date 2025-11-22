-- Add favicon settings to site_content table
-- Ensure site_content has proper SELECT policy
DROP POLICY IF EXISTS "Public can view site content" ON public.site_content;
CREATE POLICY IF NOT EXISTS "Public can view site content" 
ON public.site_content 
FOR SELECT 
USING (true);

-- Insert or update favicon_settings
INSERT INTO public.site_content (key, content) VALUES 
('favicon_settings', '{
  "favicon_ico": null,
  "favicon_32x32": null,
  "favicon_16x16": null,
  "apple_touch_icon": null
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  updated_at = now();

