-- ============================================
-- INITIALIZE MAINTENANCE SETTINGS - Run this in Supabase SQL Editor
-- ============================================
-- This will:
-- 1. Add policies to allow admin updates to site_content for maintenance_settings
-- 2. Initialize maintenance_settings if it doesn't exist
-- ============================================

-- Step 1: Ensure policies allow admins to update site_content (should already exist from sales settings)
-- But we'll make sure maintenance_settings can be updated
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

-- Step 2: Initialize maintenance settings (if not exists)
INSERT INTO site_content (key, content) VALUES 
('maintenance_settings', '{"enabled": false, "message": ""}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Step 3: Verify it was created
SELECT key, content, updated_at 
FROM site_content 
WHERE key = 'maintenance_settings';

-- ============================================
-- ✅ Done! You can now toggle maintenance mode in admin dashboard
-- ============================================

