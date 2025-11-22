-- Create phone_subscribers table for collecting user phone numbers
CREATE TABLE IF NOT EXISTS public.phone_subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL UNIQUE,
  language TEXT CHECK (language IN ('en', 'fr')) DEFAULT 'en',
  subscribed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_phone_subscribers_phone_number ON public.phone_subscribers(phone_number);
CREATE INDEX IF NOT EXISTS idx_phone_subscribers_subscribed_at ON public.phone_subscribers(subscribed_at);

-- Enable Row Level Security
ALTER TABLE public.phone_subscribers ENABLE ROW LEVEL SECURITY;

-- Allow public to insert phone numbers (for the subscription popup)
CREATE POLICY "Public can insert phone subscribers" ON public.phone_subscribers
  FOR INSERT WITH CHECK (true);

-- Allow admins to view all phone subscribers
CREATE POLICY "Admins can view all phone subscribers" ON public.phone_subscribers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admins WHERE id = auth.uid()
    )
  );

-- Allow admins to delete phone subscribers
CREATE POLICY "Admins can delete phone subscribers" ON public.phone_subscribers
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.admins WHERE id = auth.uid()
    )
  );

