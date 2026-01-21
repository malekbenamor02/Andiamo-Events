-- Admin activity logs: who did what and when
-- For Admins tab "Activity Logs" (super_admin only)

CREATE TABLE IF NOT EXISTS public.admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  admin_name TEXT NOT NULL,
  admin_email TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON public.admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON public.admin_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON public.admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target ON public.admin_logs(target_type, target_id);

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Allow reads for admins (app restricts Admins tab to super_admin)
CREATE POLICY "Allow read admin_logs" ON public.admin_logs FOR SELECT USING (true);

-- Allow inserts from app (sends admin_id, admin_name, etc.)
CREATE POLICY "Allow insert admin_logs" ON public.admin_logs FOR INSERT WITH CHECK (true);

COMMENT ON TABLE public.admin_logs IS 'Admin dashboard actions: who, what, when. Shown in Admins > Activity Logs.';
