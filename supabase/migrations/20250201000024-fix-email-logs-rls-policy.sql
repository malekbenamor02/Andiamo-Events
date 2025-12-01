-- Fix RLS policies for email_delivery_logs to allow server-side inserts
-- This migration ensures the server can insert email logs using the anon key

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "System can manage email delivery logs" ON public.email_delivery_logs;
DROP POLICY IF EXISTS "Allow server inserts for email logs" ON public.email_delivery_logs;

-- Recreate the policy for managing logs (admins and service role)
CREATE POLICY "System can manage email delivery logs" ON public.email_delivery_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.id::text = current_setting('request.jwt.claims', true)::json->>'sub'
      AND admins.is_active = true
    )
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- Allow server-side inserts for email logging (using anon key)
-- This policy allows inserts from the server without requiring admin authentication
CREATE POLICY "Allow server inserts for email logs" ON public.email_delivery_logs
  FOR INSERT WITH CHECK (true);

-- Also allow updates from server (for status updates)
CREATE POLICY "Allow server updates for email logs" ON public.email_delivery_logs
  FOR UPDATE USING (true)
  WITH CHECK (true);

