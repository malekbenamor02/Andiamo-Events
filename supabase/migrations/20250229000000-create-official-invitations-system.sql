-- Migration: Create Official Invitations System
-- This migration creates the official_invitations table and modifies qr_tickets to support invitations

-- ============================================
-- 1. CREATE official_invitations TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.official_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Recipient Information
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  recipient_email TEXT, -- Email for sending invitation
  
  -- Event Association
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  
  -- Pass Type Information
  pass_type TEXT NOT NULL, -- Pass type name (e.g., 'VIP', 'Standard')
  pass_type_id UUID REFERENCES public.event_passes(id) ON DELETE SET NULL, -- Link to event_passes
  
  -- Invitation Details
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0), -- Number of QR codes
  invitation_number TEXT UNIQUE NOT NULL, -- Sequential invitation number (e.g., INV-0001)
  
  -- Zone Information (from pass type)
  zone_name TEXT, -- Zone name from pass type
  zone_description TEXT, -- Zone description from pass type
  
  -- Status & Tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  email_delivery_status TEXT CHECK (email_delivery_status IN ('pending', 'sent', 'failed', 'pending_retry')),
  
  -- Metadata
  created_by UUID REFERENCES public.admins(id) ON DELETE SET NULL, -- Super admin who created
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Optional: Custom message from admin
  custom_message TEXT
);

-- Indexes for official_invitations
CREATE INDEX IF NOT EXISTS idx_official_invitations_event ON public.official_invitations(event_id);
CREATE INDEX IF NOT EXISTS idx_official_invitations_invitation_number ON public.official_invitations(invitation_number);
CREATE INDEX IF NOT EXISTS idx_official_invitations_status ON public.official_invitations(status);
CREATE INDEX IF NOT EXISTS idx_official_invitations_created_by ON public.official_invitations(created_by);
CREATE INDEX IF NOT EXISTS idx_official_invitations_created_at ON public.official_invitations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_official_invitations_recipient_phone ON public.official_invitations(recipient_phone);
CREATE INDEX IF NOT EXISTS idx_official_invitations_recipient_email ON public.official_invitations(recipient_email) WHERE recipient_email IS NOT NULL;

-- ============================================
-- 2. CREATE INVITATION NUMBER SEQUENCE
-- ============================================
CREATE SEQUENCE IF NOT EXISTS invitation_number_seq START 1;

-- Function to generate invitation number (sequential with INV- prefix)
CREATE OR REPLACE FUNCTION generate_invitation_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'INV-' || LPAD(nextval('invitation_number_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Set default value for invitation_number
ALTER TABLE public.official_invitations 
  ALTER COLUMN invitation_number 
  SET DEFAULT generate_invitation_number();

-- ============================================
-- 3. MODIFY qr_tickets TABLE
-- ============================================
-- Add invitation_id column to qr_tickets
ALTER TABLE public.qr_tickets 
  ADD COLUMN IF NOT EXISTS invitation_id UUID REFERENCES public.official_invitations(id) ON DELETE CASCADE;

-- Create index for invitation_id
CREATE INDEX IF NOT EXISTS idx_qr_tickets_invitation_id ON public.qr_tickets(invitation_id) WHERE invitation_id IS NOT NULL;

-- Make ticket_id nullable (official invitations don't have tickets)
ALTER TABLE public.qr_tickets 
  ALTER COLUMN ticket_id DROP NOT NULL;

-- Make order_id nullable (official invitations don't have orders)
ALTER TABLE public.qr_tickets 
  ALTER COLUMN order_id DROP NOT NULL;

-- Make order_pass_id nullable (official invitations don't have order_passes)
ALTER TABLE public.qr_tickets 
  ALTER COLUMN order_pass_id DROP NOT NULL;

-- Add constraint to ensure either (ticket_id, order_id, order_pass_id) OR invitation_id is set
ALTER TABLE public.qr_tickets 
  DROP CONSTRAINT IF EXISTS qr_tickets_source_data_check;

ALTER TABLE public.qr_tickets 
  ADD CONSTRAINT qr_tickets_source_data_check 
  CHECK (
    -- For official_invitation: invitation_id must be set, ticket_id/order_id/order_pass_id can be null
    (source = 'official_invitation' AND invitation_id IS NOT NULL AND ticket_id IS NULL AND order_id IS NULL AND order_pass_id IS NULL)
    OR
    -- For other sources: ticket_id, order_id, order_pass_id must be set, invitation_id is null
    (source != 'official_invitation' AND ticket_id IS NOT NULL AND order_id IS NOT NULL AND order_pass_id IS NOT NULL AND invitation_id IS NULL)
  );

-- Update qr_tickets source CHECK constraint to include 'official_invitation'
DO $$ 
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE public.qr_tickets DROP CONSTRAINT IF EXISTS qr_tickets_source_check;
  
  -- Add new constraint with official_invitation
  ALTER TABLE public.qr_tickets 
    ADD CONSTRAINT qr_tickets_source_check 
    CHECK (source IN ('platform_online', 'platform_cod', 'ambassador_manual', 'official_invitation'));
    
  RAISE NOTICE 'Updated qr_tickets source constraint to include official_invitation';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not update qr_tickets source constraint: %', SQLERRM;
END $$;

-- ============================================
-- 4. ENABLE RLS ON official_invitations
-- ============================================
ALTER TABLE public.official_invitations ENABLE ROW LEVEL SECURITY;

-- Only super admins can view all invitations
CREATE POLICY "Super admins can view all invitations"
  ON public.official_invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.id = auth.uid()
      AND admins.role = 'super_admin'
    )
  );

-- Only super admins can create invitations
CREATE POLICY "Super admins can create invitations"
  ON public.official_invitations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.id = auth.uid()
      AND admins.role = 'super_admin'
    )
  );

-- Only super admins can update invitations
CREATE POLICY "Super admins can update invitations"
  ON public.official_invitations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.id = auth.uid()
      AND admins.role = 'super_admin'
    )
  );

-- Only super admins can delete invitations
CREATE POLICY "Super admins can delete invitations"
  ON public.official_invitations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.id = auth.uid()
      AND admins.role = 'super_admin'
    )
  );

-- ============================================
-- 5. CREATE TRIGGER FOR updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_official_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_official_invitations_updated_at
  BEFORE UPDATE ON public.official_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_official_invitations_updated_at();

-- ============================================
-- 6. ADD COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE public.official_invitations IS 'Stores official invitation orders created by super admins. Each invitation can have multiple QR codes (based on quantity).';
COMMENT ON COLUMN public.official_invitations.invitation_number IS 'Unique invitation number in format INV-0001, INV-0002, etc.';
COMMENT ON COLUMN public.official_invitations.quantity IS 'Number of QR codes to generate for this invitation. Each QR code is stored in qr_tickets table.';

-- Add comment for qr_tickets.invitation_id column
COMMENT ON COLUMN public.qr_tickets.invitation_id IS 'Links QR codes in qr_tickets table back to the official_invitations table.';
