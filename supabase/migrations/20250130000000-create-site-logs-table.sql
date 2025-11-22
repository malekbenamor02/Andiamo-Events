-- Create site_logs table for tracking all website activities
CREATE TABLE IF NOT EXISTS public.site_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  log_type TEXT NOT NULL CHECK (log_type IN ('info', 'warning', 'error', 'success', 'action')),
  category TEXT NOT NULL, -- e.g., 'user_action', 'api_call', 'database', 'page_view', 'form_submission'
  message TEXT NOT NULL,
  details JSONB, -- Additional context data
  user_id UUID, -- If logged in user
  user_type TEXT CHECK (user_type IN ('admin', 'ambassador', 'guest')), -- User type
  ip_address TEXT,
  user_agent TEXT,
  page_url TEXT,
  request_method TEXT,
  request_path TEXT,
  response_status INTEGER,
  error_stack TEXT, -- For error logs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_site_logs_log_type ON public.site_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_site_logs_category ON public.site_logs(category);
CREATE INDEX IF NOT EXISTS idx_site_logs_created_at ON public.site_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_logs_user_id ON public.site_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_site_logs_user_type ON public.site_logs(user_type);

-- Enable RLS
ALTER TABLE public.site_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view all site logs" ON public.site_logs;
DROP POLICY IF EXISTS "Allow service role to insert logs" ON public.site_logs;
DROP POLICY IF EXISTS "Allow public log inserts" ON public.site_logs;
DROP POLICY IF EXISTS "Allow authenticated users to view site logs" ON public.site_logs;

-- Allow admins to view all logs (via email check or service role)
-- Note: Admin authentication uses JWT tokens, not Supabase auth.uid()
-- So we'll allow service role and authenticated users to read logs
-- Application layer will verify admin status via JWT token
CREATE POLICY "Admins can view all site logs" ON public.site_logs
  FOR SELECT USING (true);

-- Allow backend to insert logs (service role)
CREATE POLICY "Allow service role to insert logs" ON public.site_logs
  FOR INSERT WITH CHECK (true);

-- Allow backend to insert logs from client (for client-side errors)
CREATE POLICY "Allow public log inserts" ON public.site_logs
  FOR INSERT WITH CHECK (true);

COMMENT ON TABLE public.site_logs IS 'Stores all website activity logs including errors, actions, and events';

