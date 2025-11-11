-- Create email_tracking table
CREATE TABLE IF NOT EXISTS email_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ambassador_id UUID REFERENCES ambassadors(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL CHECK (email_type IN ('approval', 'rejection', 'reset')),
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_email_tracking_ambassador_id ON email_tracking(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_email_type ON email_tracking(email_type);
CREATE INDEX IF NOT EXISTS idx_email_tracking_opened_at ON email_tracking(opened_at);

-- Enable RLS
ALTER TABLE email_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view all email tracking" ON email_tracking
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid()
    )
  );

CREATE POLICY "Ambassadors can view their own email tracking" ON email_tracking
  FOR SELECT USING (
    ambassador_id IN (
      SELECT id FROM ambassadors 
      WHERE ambassadors.id = ambassador_id
    )
  ); 