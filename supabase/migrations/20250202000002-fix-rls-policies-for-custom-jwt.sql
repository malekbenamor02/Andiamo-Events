-- ============================================
-- Fix Issue #4: Update RLS policies to work with custom JWT authentication
-- ============================================

-- The app uses custom JWT authentication (not Supabase Auth)
-- RLS policies need to allow service role or use JWT claims instead of auth.uid()

-- ============================================
-- SCANS TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Ambassadors can view their own scans" ON public.scans;
DROP POLICY IF EXISTS "Ambassadors can insert scans" ON public.scans;
DROP POLICY IF EXISTS "Admins can view all scans" ON public.scans;
DROP POLICY IF EXISTS "Admins can manage all scans" ON public.scans;

-- New policies that work with service role and custom JWT
-- Allow service role (backend operations)
CREATE POLICY "Service role can manage scans" ON public.scans
  FOR ALL USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  );

-- Allow public read (for admin dashboard)
CREATE POLICY "Public can view scans" ON public.scans
  FOR SELECT USING (true);

-- Allow public insert (backend will validate via JWT middleware)
CREATE POLICY "Public can insert scans" ON public.scans
  FOR INSERT WITH CHECK (true);

-- ============================================
-- AMBASSADORS TABLE POLICIES
-- ============================================

-- Drop existing policies that use auth.uid()
DROP POLICY IF EXISTS "Ambassadors can view own data" ON public.ambassadors;
DROP POLICY IF EXISTS "Anyone can insert ambassador applications" ON public.ambassadors;
DROP POLICY IF EXISTS "Ambassadors can update own data" ON public.ambassadors;
DROP POLICY IF EXISTS "Admin can view all ambassadors" ON public.ambassadors;

-- New policies
-- Allow service role full access
CREATE POLICY "Service role can manage ambassadors" ON public.ambassadors
  FOR ALL USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  );

-- Allow public read (for admin dashboard)
CREATE POLICY "Public can view ambassadors" ON public.ambassadors
  FOR SELECT USING (true);

-- Allow public insert (for applications)
CREATE POLICY "Public can insert ambassadors" ON public.ambassadors
  FOR INSERT WITH CHECK (true);

-- Allow public update (backend will validate via JWT middleware)
CREATE POLICY "Public can update ambassadors" ON public.ambassadors
  FOR UPDATE USING (true);

-- ============================================
-- CLIENTS TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Ambassadors can view own clients" ON public.clients;
DROP POLICY IF EXISTS "Ambassadors can insert own clients" ON public.clients;
DROP POLICY IF EXISTS "Admin can view all clients" ON public.clients;

-- New policies
CREATE POLICY "Service role can manage clients" ON public.clients
  FOR ALL USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  );

CREATE POLICY "Public can view clients" ON public.clients
  FOR SELECT USING (true);

CREATE POLICY "Public can insert clients" ON public.clients
  FOR INSERT WITH CHECK (true);

-- ============================================
-- AMBASSADOR_EVENTS TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admin can view all ambassador events" ON public.ambassador_events;

-- New policies
CREATE POLICY "Service role can manage ambassador_events" ON public.ambassador_events
  FOR ALL USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  );

CREATE POLICY "Public can view ambassador_events" ON public.ambassador_events
  FOR SELECT USING (true);

-- ============================================
-- AMBASSADOR_PERFORMANCE TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admin can view all ambassador performance" ON public.ambassador_performance;

-- New policies
CREATE POLICY "Service role can manage ambassador_performance" ON public.ambassador_performance
  FOR ALL USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  );

CREATE POLICY "Public can view ambassador_performance" ON public.ambassador_performance
  FOR SELECT USING (true);

-- ============================================
-- EMAIL_TRACKING TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all email tracking" ON public.email_tracking;
DROP POLICY IF EXISTS "Ambassadors can view their own email tracking" ON public.email_tracking;

-- New policies
CREATE POLICY "Service role can manage email_tracking" ON public.email_tracking
  FOR ALL USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  );

CREATE POLICY "Public can view email_tracking" ON public.email_tracking
  FOR SELECT USING (true);

-- ============================================
-- NOTES
-- ============================================
-- These policies allow:
-- 1. Service role (backend) - full access
-- 2. Public (anon key) - read access for admin dashboard
-- 3. Public insert/update - backend validates via JWT middleware before allowing
--
-- Backend must use service role key for all database operations
-- Frontend uses anon key, but backend validates authentication via JWT middleware

