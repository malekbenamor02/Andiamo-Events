-- Create SMS logs table to track sent messages
CREATE TABLE IF NOT EXISTS public.sms_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
  api_response TEXT,
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_sms_logs_phone_number ON public.sms_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON public.sms_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON public.sms_logs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- Allow admins to view all SMS logs
CREATE POLICY "Admins can view SMS logs" ON public.sms_logs
  FOR SELECT USING (true);

-- Allow admins to insert SMS logs
CREATE POLICY "Admins can insert SMS logs" ON public.sms_logs
  FOR INSERT WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.sms_logs IS 'Stores SMS broadcast logs and API responses';

