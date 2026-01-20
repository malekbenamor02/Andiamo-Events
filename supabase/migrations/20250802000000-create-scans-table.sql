-- Create scans table for tracking QR code scans
-- ticket_id: plain UUID (optionally pass_purchases.id when that table exists). Scanner flow uses qr_ticket_id.
CREATE TABLE IF NOT EXISTS scans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  ambassador_id UUID REFERENCES ambassadors(id) ON DELETE SET NULL,
  scan_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scan_location TEXT,
  device_info TEXT,
  scan_result TEXT CHECK (scan_result IN ('valid', 'invalid', 'already_scanned', 'expired')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_scans_ticket_id ON scans(ticket_id);
CREATE INDEX IF NOT EXISTS idx_scans_event_id ON scans(event_id);
CREATE INDEX IF NOT EXISTS idx_scans_ambassador_id ON scans(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_scans_scan_time ON scans(scan_time);

-- Enable RLS
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Ambassadors can view their own scans
CREATE POLICY "Ambassadors can view their own scans" ON scans
  FOR SELECT USING (auth.uid()::text = ambassador_id::text);

-- Ambassadors can insert scans
CREATE POLICY "Ambassadors can insert scans" ON scans
  FOR INSERT WITH CHECK (auth.uid()::text = ambassador_id::text);

-- Admins can view all scans
CREATE POLICY "Admins can view all scans" ON scans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admins WHERE id = auth.uid()::uuid
    )
  );

-- Admins can insert/update/delete scans
CREATE POLICY "Admins can manage all scans" ON scans
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admins WHERE id = auth.uid()::uuid
    )
  );

-- Add QR code field and trigger to pass_purchases only if that table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pass_purchases') THEN
    ALTER TABLE pass_purchases ADD COLUMN IF NOT EXISTS qr_code TEXT UNIQUE;
    ALTER TABLE pass_purchases ADD COLUMN IF NOT EXISTS qr_code_generated_at TIMESTAMP WITH TIME ZONE;

    CREATE OR REPLACE FUNCTION generate_qr_code()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.qr_code := encode(gen_random_bytes(16), 'hex') || '-' || NEW.id::text;
      NEW.qr_code_generated_at := NOW();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS generate_qr_code_trigger ON pass_purchases;
    CREATE TRIGGER generate_qr_code_trigger
      BEFORE INSERT ON pass_purchases
      FOR EACH ROW
      WHEN (NEW.qr_code IS NULL)
      EXECUTE FUNCTION generate_qr_code();
  END IF;
END $$; 