-- Create aio_events_submissions table
-- This table stores user data when they click "Online Payment By AIO Events"
-- Data is collected for analytics/lead generation purposes
-- No orders are created, no emails/SMS sent

CREATE TABLE IF NOT EXISTS public.aio_events_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Customer Information
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  ville TEXT,
  
  -- Event Information
  event_id UUID,
  event_name TEXT,
  event_date TIMESTAMP WITH TIME ZONE,
  event_venue TEXT,
  event_city TEXT,
  
  -- Selected Passes (stored as JSONB for flexibility)
  selected_passes JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Format: [{"pass_id": "uuid", "pass_name": "string", "quantity": number, "price": number}]
  
  -- Totals
  total_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  language TEXT DEFAULT 'en',
  user_agent TEXT,
  ip_address TEXT,
  status TEXT DEFAULT 'submitted',
  
  -- Timestamps
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_aio_events_submissions_event_id ON public.aio_events_submissions(event_id);
CREATE INDEX IF NOT EXISTS idx_aio_events_submissions_email ON public.aio_events_submissions(email);
CREATE INDEX IF NOT EXISTS idx_aio_events_submissions_phone ON public.aio_events_submissions(phone);
CREATE INDEX IF NOT EXISTS idx_aio_events_submissions_submitted_at ON public.aio_events_submissions(submitted_at);
CREATE INDEX IF NOT EXISTS idx_aio_events_submissions_status ON public.aio_events_submissions(status);

-- Enable RLS
ALTER TABLE public.aio_events_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public can insert (for form submissions)
CREATE POLICY "Public can insert aio events submissions" ON public.aio_events_submissions
  FOR INSERT WITH CHECK (true);

-- RLS Policy: Admins can view all submissions
CREATE POLICY "Admins can view aio events submissions" ON public.aio_events_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admins WHERE id = auth.uid()
    )
  );

-- Add comments for documentation
COMMENT ON TABLE public.aio_events_submissions IS 'Stores user data when they click "Online Payment By AIO Events". Used for lead generation and analytics. No orders are created.';
COMMENT ON COLUMN public.aio_events_submissions.selected_passes IS 'JSON array of selected passes with pass_id, pass_name, quantity, and price';
COMMENT ON COLUMN public.aio_events_submissions.status IS 'Status of the submission (e.g., submitted, processed)';
