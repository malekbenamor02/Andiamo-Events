-- ============================================
-- INITIALIZE AMBASSADOR APPLICATION SETTINGS - Run this in Supabase SQL Editor
-- ============================================
-- This will:
-- 1. Ensure policies allow admins to update site_content (should already exist)
-- 2. Initialize ambassador_application_settings if it doesn't exist
-- ============================================

-- Step 1: Ensure policies allow admins to update site_content (should already exist from other settings)
-- But we'll make sure they're in place
DROP POLICY IF EXISTS "Admins can insert site content" ON public.site_content;
DROP POLICY IF EXISTS "Admins can update site content" ON public.site_content;

CREATE POLICY "Admins can insert site content" 
ON public.site_content 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can update site content" 
ON public.site_content 
FOR UPDATE 
USING (true);

-- Step 2: Initialize ambassador application settings (if not exists)
INSERT INTO site_content (key, content) VALUES 
('ambassador_application_settings', '{"enabled": true, "message": ""}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Step 3: Verify it was created
SELECT key, content, updated_at 
FROM site_content 
WHERE key = 'ambassador_application_settings';

-- ============================================
-- ✅ Done! You can now toggle ambassador applications in admin dashboard
-- ============================================

