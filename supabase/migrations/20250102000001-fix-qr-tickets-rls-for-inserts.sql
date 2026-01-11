-- Fix RLS policy to ensure service role inserts work
-- Service role key should bypass RLS, but this ensures compatibility

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can manage QR tickets" ON public.qr_tickets;
DROP POLICY IF EXISTS "System can manage QR tickets" ON public.qr_tickets;

-- Keep the read policy (don't drop it if it works)
-- CREATE POLICY "Public can read QR tickets by token" ON public.qr_tickets
--   FOR SELECT USING (true);

-- Create a permissive insert policy for service role
-- Service role key bypasses RLS, but this policy ensures inserts work when using anon key with service role context
CREATE POLICY "Allow service role inserts" ON public.qr_tickets
  FOR INSERT 
  WITH CHECK (
    auth.role() = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  );

-- Create update policy for service role
CREATE POLICY "Allow service role updates" ON public.qr_tickets
  FOR UPDATE 
  USING (
    auth.role() = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  );

-- Note: Service role key (SUPABASE_SERVICE_ROLE_KEY) bypasses RLS entirely
-- These policies are for compatibility and explicit permission
