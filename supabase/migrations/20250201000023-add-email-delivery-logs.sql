-- Add email delivery logs table to track order completion emails
-- This table stores the status of emails sent to customers when orders are completed

CREATE TABLE IF NOT EXISTS public.email_delivery_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL DEFAULT 'order_completion',
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'pending_retry')),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_order_id ON public.email_delivery_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_status ON public.email_delivery_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_email_type ON public.email_delivery_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_created_at ON public.email_delivery_logs(created_at);

-- Enable RLS
ALTER TABLE public.email_delivery_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can view all email delivery logs
CREATE POLICY "Admins can view email delivery logs" ON public.email_delivery_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.id::text = current_setting('request.jwt.claims', true)::json->>'sub'
      AND admins.is_active = true
    )
  );

-- RLS Policy: System can insert/update email delivery logs (via service role or anon key for server operations)
-- Allow inserts from service role or when using anon key (server-side operations)
CREATE POLICY "System can manage email delivery logs" ON public.email_delivery_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.id::text = current_setting('request.jwt.claims', true)::json->>'sub'
      AND admins.is_active = true
    )
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL  -- Allow anon key for server operations
  );

-- Also allow inserts specifically (for server-side email logging)
CREATE POLICY "Allow server inserts for email logs" ON public.email_delivery_logs
  FOR INSERT WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_email_delivery_logs_updated_at
  BEFORE UPDATE ON public.email_delivery_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE public.email_delivery_logs IS 'Tracks email delivery status for order completion confirmations and other transactional emails';
COMMENT ON COLUMN public.email_delivery_logs.status IS 'Email delivery status: pending (queued), sent (successfully delivered), failed (permanent failure), pending_retry (temporary failure, will retry)';
COMMENT ON COLUMN public.email_delivery_logs.retry_count IS 'Number of retry attempts made for failed emails';

