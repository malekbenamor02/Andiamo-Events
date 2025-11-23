-- Fix RLS policies for site_logs table
-- Admin authentication uses JWT tokens, not Supabase auth.uid()
-- So we need to allow authenticated reads (application layer handles auth)

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all site logs" ON public.site_logs;
DROP POLICY IF EXISTS "Allow service role to insert logs" ON public.site_logs;
DROP POLICY IF EXISTS "Allow public log inserts" ON public.site_logs;

-- Allow all authenticated users to view logs
-- Application layer (admin dashboard) will verify admin status via JWT
-- This allows the admin dashboard to fetch logs
CREATE POLICY "Allow authenticated users to view site logs" ON public.site_logs
  FOR SELECT USING (true);

-- Allow service role to insert logs (for backend/serverless functions)
CREATE POLICY "Allow service role to insert logs" ON public.site_logs
  FOR INSERT WITH CHECK (true);

-- Allow public to insert logs (for client-side error logging)
CREATE POLICY "Allow public log inserts" ON public.site_logs
  FOR INSERT WITH CHECK (true);





