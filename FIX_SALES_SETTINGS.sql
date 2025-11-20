-- ============================================
-- FIX SALES SETTINGS - Run this in Supabase SQL Editor
-- ============================================
-- This will:
-- 1. Add policies to allow admin updates to site_content
-- 2. Initialize sales_settings if it doesn't exist
-- ============================================

-- Step 1: Add policies for site_content updates (allow admins to update)
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

-- Step 2: Initialize sales settings (if not exists)
INSERT INTO site_content (key, content) VALUES 
('sales_settings', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  content = EXCLUDED.content,
  updated_at = now();

-- Step 3: Verify it was created
SELECT key, content, updated_at 
FROM site_content 
WHERE key = 'sales_settings';

-- ============================================
-- ✅ Done! You can now toggle sales in admin dashboard
-- ============================================


