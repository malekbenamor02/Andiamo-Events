-- Add Test Mode Support
-- This migration adds is_test columns to ambassadors and orders tables,
-- and adds test_mode_enabled setting

-- ============================================
-- 1. ADD is_test COLUMN TO AMBASSADORS TABLE
-- ============================================
ALTER TABLE public.ambassadors 
ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE NOT NULL;

-- Create index for test ambassadors
CREATE INDEX IF NOT EXISTS idx_ambassadors_is_test ON public.ambassadors(is_test);

-- ============================================
-- 2. ADD is_test COLUMN TO ORDERS TABLE
-- ============================================
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE NOT NULL;

-- Create index for test orders
CREATE INDEX IF NOT EXISTS idx_orders_is_test ON public.orders(is_test);

-- ============================================
-- 3. ADD TEST MODE SETTING
-- ============================================
-- Add test_mode_enabled setting to site_content
INSERT INTO site_content (key, content) VALUES 
('test_mode_settings', '{"enabled": false, "auto_simulation": false}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  content = EXCLUDED.content,
  updated_at = now();

-- ============================================
-- 4. CREATE SEPARATE ROUND ROBIN TRACKER FOR TEST MODE
-- ============================================
CREATE TABLE IF NOT EXISTS public.round_robin_tracker_test (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ville TEXT NOT NULL,
  last_assigned_ambassador_id UUID REFERENCES public.ambassadors(id) ON DELETE SET NULL,
  last_assigned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ville)
);

-- Create indexes for test round robin tracker
CREATE INDEX IF NOT EXISTS idx_round_robin_test_ville ON public.round_robin_tracker_test(ville);
CREATE INDEX IF NOT EXISTS idx_round_robin_test_ambassador ON public.round_robin_tracker_test(last_assigned_ambassador_id);

-- Enable RLS for test round robin tracker
ALTER TABLE public.round_robin_tracker_test ENABLE ROW LEVEL SECURITY;

-- RLS Policies for test round robin tracker (admins only)
DROP POLICY IF EXISTS "Admins can manage test round robin tracker" ON public.round_robin_tracker_test;
CREATE POLICY "Admins can manage test round robin tracker" ON public.round_robin_tracker_test
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.id::text = current_setting('request.jwt.claims', true)::json->>'sub'
      AND admins.is_active = true
    )
  );

-- Trigger to update updated_at for test round robin tracker
DROP TRIGGER IF EXISTS update_round_robin_tracker_test_updated_at ON public.round_robin_tracker_test;
CREATE TRIGGER update_round_robin_tracker_test_updated_at
  BEFORE UPDATE ON public.round_robin_tracker_test
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

