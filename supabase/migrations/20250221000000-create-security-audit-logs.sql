-- Create security audit logs table for tracking security events
-- This table logs all security-related events for audit and monitoring

CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  user_id UUID, -- Optional: for authenticated requests
  request_method TEXT,
  request_path TEXT,
  request_body JSONB, -- Store request body (sanitized if needed)
  response_status INTEGER,
  details JSONB, -- Additional event details
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_event_type ON public.security_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_endpoint ON public.security_audit_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_ip_address ON public.security_audit_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_severity ON public.security_audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created_at ON public.security_audit_logs(created_at DESC);

-- Create index for user_id if provided
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user_id ON public.security_audit_logs(user_id) WHERE user_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can view security audit logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'security_audit_logs' 
    AND policyname = 'Admins can view security audit logs'
  ) THEN
    CREATE POLICY "Admins can view security audit logs" ON public.security_audit_logs
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.admins
          WHERE admins.id::text = current_setting('request.jwt.claims', true)::json->>'sub'
          AND admins.is_active = true
        )
      );
  END IF;
END $$;

-- RLS Policy: System can insert security audit logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'security_audit_logs' 
    AND policyname = 'System can insert security audit logs'
  ) THEN
    CREATE POLICY "System can insert security audit logs" ON public.security_audit_logs
      FOR INSERT WITH CHECK (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
        OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
      );
  END IF;
END $$;

-- Add comments
COMMENT ON TABLE public.security_audit_logs IS 'Logs all security-related events for audit and monitoring purposes';
COMMENT ON COLUMN public.security_audit_logs.event_type IS 'Type of security event (e.g., webhook_signature_failed, rate_limit_exceeded, invalid_auth)';
COMMENT ON COLUMN public.security_audit_logs.severity IS 'Severity level: low, medium, high, or critical';
COMMENT ON COLUMN public.security_audit_logs.details IS 'Additional event details stored as JSON';

