-- Add secure URL access tracking to orders table (single URL for all QR codes)
-- This enables one-time access URLs that expire on first access or event date

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS qr_access_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS qr_url_accessed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS qr_url_accessed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS qr_url_expires_at TIMESTAMP WITH TIME ZONE;

-- Create index for order access token lookups
CREATE INDEX IF NOT EXISTS idx_orders_qr_access_token ON public.orders(qr_access_token);

-- Create index for expiration checks
CREATE INDEX IF NOT EXISTS idx_orders_qr_url_expires_at ON public.orders(qr_url_expires_at) WHERE qr_url_expires_at IS NOT NULL;

-- Add secure URL access tracking to tickets table (for individual ticket access if needed)
ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS secure_access_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS url_accessed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS url_accessed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS url_expires_at TIMESTAMP WITH TIME ZONE;

-- Create index for secure access token lookups
CREATE INDEX IF NOT EXISTS idx_tickets_secure_access_token ON public.tickets(secure_access_token);

-- Create index for expiration checks
CREATE INDEX IF NOT EXISTS idx_tickets_url_expires_at ON public.tickets(url_expires_at) WHERE url_expires_at IS NOT NULL;

-- Create table for access logging
CREATE TABLE IF NOT EXISTS public.qr_code_access_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  access_result TEXT NOT NULL CHECK (access_result IN ('success', 'expired', 'already_accessed', 'invalid_token', 'event_expired')),
  error_message TEXT
);

-- Create indexes for access logs
CREATE INDEX IF NOT EXISTS idx_qr_access_logs_ticket_id ON public.qr_code_access_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_qr_access_logs_order_id ON public.qr_code_access_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_qr_access_logs_accessed_at ON public.qr_code_access_logs(accessed_at);
CREATE INDEX IF NOT EXISTS idx_qr_access_logs_access_token ON public.qr_code_access_logs(access_token);

-- Enable RLS on access logs
ALTER TABLE public.qr_code_access_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can view all access logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'qr_code_access_logs' 
    AND policyname = 'Admins can view access logs'
  ) THEN
    CREATE POLICY "Admins can view access logs" ON public.qr_code_access_logs
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.admins
          WHERE admins.id::text = current_setting('request.jwt.claims', true)::json->>'sub'
          AND admins.is_active = true
        )
      );
  END IF;
END $$;

-- RLS Policy: System can insert access logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'qr_code_access_logs' 
    AND policyname = 'System can insert access logs'
  ) THEN
    CREATE POLICY "System can insert access logs" ON public.qr_code_access_logs
      FOR INSERT WITH CHECK (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
        OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
      );
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN public.orders.qr_access_token IS 'Unique token for secure QR code URL access. Single URL shows all QR codes for the order.';
COMMENT ON COLUMN public.orders.qr_url_accessed IS 'Whether the secure URL has been accessed. Once true, URL expires.';
COMMENT ON COLUMN public.orders.qr_url_accessed_at IS 'Timestamp when the secure URL was first accessed.';
COMMENT ON COLUMN public.orders.qr_url_expires_at IS 'Event-based expiration date. URL expires on event date + 1 day.';
COMMENT ON COLUMN public.tickets.secure_access_token IS 'Unique token for individual ticket QR code URL access (optional, for future use).';
COMMENT ON COLUMN public.tickets.url_accessed IS 'Whether the individual ticket URL has been accessed.';
COMMENT ON COLUMN public.tickets.url_accessed_at IS 'Timestamp when the individual ticket URL was first accessed.';
COMMENT ON COLUMN public.tickets.url_expires_at IS 'Event-based expiration date for individual ticket URL.';
COMMENT ON TABLE public.qr_code_access_logs IS 'Logs all attempts to access QR code URLs via secure links. Tracks access attempts, successes, and failures.';

