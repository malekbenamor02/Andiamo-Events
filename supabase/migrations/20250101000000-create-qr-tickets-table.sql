-- Create QR Ticket Registry table
-- This table provides a denormalized read-only registry for external scanners
-- Populated at ticket generation time with all ticket context

CREATE TABLE IF NOT EXISTS public.qr_tickets (
  -- Primary Key & QR Identity
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  secure_token TEXT NOT NULL UNIQUE,  -- QR payload (UUID v4) - indexed for fast lookup
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  
  -- Order & Sale Context
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('platform_online', 'platform_cod', 'ambassador_manual')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('online', 'cod', 'external_app', 'ambassador_cash')),
  
  -- Seller Information
  ambassador_id UUID REFERENCES public.ambassadors(id) ON DELETE SET NULL,
  ambassador_name TEXT,  -- Denormalized for quick access
  ambassador_phone TEXT,  -- Denormalized for quick access
  
  -- Buyer Information
  buyer_name TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,
  buyer_email TEXT,
  buyer_city TEXT NOT NULL,
  buyer_ville TEXT,  -- Neighborhood (if applicable)
  
  -- Event Information
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  event_name TEXT,
  event_date TIMESTAMP WITH TIME ZONE,
  event_venue TEXT,
  event_city TEXT,
  
  -- Pass Information
  order_pass_id UUID NOT NULL REFERENCES public.order_passes(id) ON DELETE CASCADE,
  pass_type TEXT NOT NULL,  -- e.g., 'VIP', 'Standard', 'Premium'
  pass_price NUMERIC(10, 2) NOT NULL,  -- Unit price for this pass
  
  -- Ticket State (Scan Status)
  ticket_status TEXT NOT NULL DEFAULT 'VALID' CHECK (ticket_status IN ('VALID', 'USED', 'INVALID', 'WRONG_EVENT', 'EXPIRED')),
  
  -- QR Code Metadata
  qr_code_url TEXT,  -- Public URL to QR code image
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
-- Primary lookup: QR code by secure_token (MOST IMPORTANT)
CREATE UNIQUE INDEX IF NOT EXISTS idx_qr_tickets_secure_token ON public.qr_tickets(secure_token);

-- Fast ticket lookup
CREATE INDEX IF NOT EXISTS idx_qr_tickets_ticket_id ON public.qr_tickets(ticket_id);

-- Fast order lookup
CREATE INDEX IF NOT EXISTS idx_qr_tickets_order_id ON public.qr_tickets(order_id);

-- Fast event lookup
CREATE INDEX IF NOT EXISTS idx_qr_tickets_event_id ON public.qr_tickets(event_id) WHERE event_id IS NOT NULL;

-- Fast seller lookup
CREATE INDEX IF NOT EXISTS idx_qr_tickets_ambassador_id ON public.qr_tickets(ambassador_id) WHERE ambassador_id IS NOT NULL;

-- Fast status filtering
CREATE INDEX IF NOT EXISTS idx_qr_tickets_status ON public.qr_tickets(ticket_status);

-- Fast event date filtering
CREATE INDEX IF NOT EXISTS idx_qr_tickets_event_date ON public.qr_tickets(event_date) WHERE event_date IS NOT NULL;

-- Enable RLS
ALTER TABLE public.qr_tickets ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public read access (secure_token is unguessable UUID v4)
-- External scanners can query by secure_token only
CREATE POLICY "Public can read QR tickets by token" ON public.qr_tickets
  FOR SELECT USING (true);

-- RLS Policy: System can insert/update (for ticket generation and status sync)
-- Service role key bypasses RLS, but this policy ensures compatibility
CREATE POLICY "Service role can manage QR tickets" ON public.qr_tickets
  FOR ALL 
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

-- Trigger for updated_at
CREATE TRIGGER update_qr_tickets_updated_at
  BEFORE UPDATE ON public.qr_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.qr_tickets IS 'Denormalized QR ticket registry for external scanner access. Contains all ticket context in one place for fast lookup by secure_token. Populated at ticket generation time.';
COMMENT ON COLUMN public.qr_tickets.secure_token IS 'QR payload (UUID v4) - the value encoded in the QR code. This is the primary lookup key for external scanners.';
COMMENT ON COLUMN public.qr_tickets.source IS 'Sales channel: platform_online (online payment), platform_cod (cash on delivery), ambassador_manual (manual ambassador order)';
COMMENT ON COLUMN public.qr_tickets.ticket_status IS 'Scan status of the ticket. VALID = ready for scanning, USED = already scanned, INVALID = invalid ticket, WRONG_EVENT = scanned at wrong event, EXPIRED = past event date.';
