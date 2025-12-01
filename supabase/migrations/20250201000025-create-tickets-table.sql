-- Create tickets table for digital pass management
-- This table stores individual tickets generated for each pass in an order
-- Each ticket has a unique secure token and QR code for verification

-- Drop table if it exists (to handle incomplete previous migrations)
DROP TABLE IF EXISTS public.tickets CASCADE;

CREATE TABLE public.tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_pass_id UUID NOT NULL REFERENCES public.order_passes(id) ON DELETE CASCADE,
  secure_token TEXT NOT NULL UNIQUE, -- UUID or hashed value for QR code generation
  qr_code_url TEXT, -- URL to QR code image stored in Supabase Storage
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'GENERATED', 'DELIVERED', 'FAILED')),
  email_delivery_status TEXT CHECK (email_delivery_status IN ('pending', 'sent', 'failed', 'pending_retry')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  generated_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_tickets_order_id ON public.tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_order_pass_id ON public.tickets(order_pass_id);
CREATE INDEX IF NOT EXISTS idx_tickets_secure_token ON public.tickets(secure_token);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_email_delivery_status ON public.tickets(email_delivery_status);

-- Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public can view tickets (for verification purposes)
CREATE POLICY "Public can view tickets" ON public.tickets
  FOR SELECT USING (true);

-- RLS Policy: Admins can manage all tickets
CREATE POLICY "Admins can manage all tickets" ON public.tickets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.id::text = current_setting('request.jwt.claims', true)::json->>'sub'
      AND admins.is_active = true
    )
  );

-- RLS Policy: System can insert/update tickets (via service role or anon key for server operations)
CREATE POLICY "System can manage tickets" ON public.tickets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.id::text = current_setting('request.jwt.claims', true)::json->>'sub'
      AND admins.is_active = true
    )
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  );

-- Also allow inserts specifically (for server-side ticket generation)
CREATE POLICY "Allow server inserts for tickets" ON public.tickets
  FOR INSERT WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.tickets IS 'Stores individual digital tickets generated for each pass in an order. Each ticket has a unique secure token and QR code for verification at event entry.';
COMMENT ON COLUMN public.tickets.secure_token IS 'Unique secure token (UUID or hashed value) used to generate the QR code. This token is used for ticket verification.';
COMMENT ON COLUMN public.tickets.qr_code_url IS 'URL to the QR code image stored in Supabase Storage. The QR code contains the secure_token for verification.';
COMMENT ON COLUMN public.tickets.status IS 'Ticket status: PENDING (not yet generated), GENERATED (QR code created and stored), DELIVERED (email sent successfully), FAILED (generation or delivery failed)';
COMMENT ON COLUMN public.tickets.email_delivery_status IS 'Email delivery status for this specific ticket: pending, sent, failed, pending_retry. Tracks whether the ticket QR code was successfully included in the confirmation email.';

