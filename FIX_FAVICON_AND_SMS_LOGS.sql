-- ============================================
-- FIX FAVICON SETTINGS AND SMS LOGS
-- Run this in Supabase SQL Editor
-- ============================================
-- This will:
-- 1. Create/ensure favicon_settings exists in site_content
-- 2. Create sms_logs table if it doesn't exist
-- 3. Ensure proper RLS policies are in place
-- ============================================

-- Step 1: Ensure site_content has proper RLS policies for SELECT
DROP POLICY IF EXISTS "Public can view site content" ON public.site_content;
CREATE POLICY "Public can view site content" 
ON public.site_content 
FOR SELECT 
USING (true);

-- Step 2: Create/Initialize favicon_settings in site_content
INSERT INTO public.site_content (key, content) VALUES 
('favicon_settings', '{
  "favicon_ico": null,
  "favicon_32x32": null,
  "favicon_16x16": null,
  "apple_touch_icon": null
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  updated_at = now();

-- Step 3: Create sms_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.sms_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
  api_response TEXT,
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Step 4: Add indexes for sms_logs (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_sms_logs_phone_number ON public.sms_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON public.sms_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON public.sms_logs(created_at DESC);

-- Step 5: Enable RLS on sms_logs
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- Step 6: Create/Update RLS policies for sms_logs
DROP POLICY IF EXISTS "Admins can view SMS logs" ON public.sms_logs;
DROP POLICY IF EXISTS "Admins can insert SMS logs" ON public.sms_logs;
DROP POLICY IF EXISTS "Public can view SMS logs" ON public.sms_logs;
DROP POLICY IF EXISTS "Public can insert SMS logs" ON public.sms_logs;

-- Allow public to view SMS logs (for admin dashboard)
CREATE POLICY "Public can view SMS logs" 
ON public.sms_logs
FOR SELECT 
USING (true);

-- Allow public to insert SMS logs (for API)
CREATE POLICY "Public can insert SMS logs" 
ON public.sms_logs
FOR INSERT 
WITH CHECK (true);

-- Step 7: Add comment
COMMENT ON TABLE public.sms_logs IS 'Stores SMS broadcast logs and API responses';

-- Step 8: Verify favicon_settings was created
SELECT key, content, updated_at 
FROM public.site_content 
WHERE key = 'favicon_settings';

-- Step 9: Verify sms_logs table exists
SELECT COUNT(*) as sms_logs_count 
FROM public.sms_logs;

-- ============================================
-- ✅ Done! 
-- Favicon settings and SMS logs should now work
-- ============================================

