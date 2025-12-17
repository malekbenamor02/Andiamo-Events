-- Create phone_subscriptions table for improved phone subscription system
CREATE TABLE IF NOT EXISTS public.phone_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  source TEXT DEFAULT 'homepage_popup',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  verified BOOLEAN DEFAULT false
);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_phone_subscriptions_phone ON public.phone_subscriptions(phone);
CREATE INDEX IF NOT EXISTS idx_phone_subscriptions_source ON public.phone_subscriptions(source);
CREATE INDEX IF NOT EXISTS idx_phone_subscriptions_created_at ON public.phone_subscriptions(created_at);

-- Enable Row Level Security
ALTER TABLE public.phone_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow public to insert phone subscriptions
CREATE POLICY "phone_subscriptions_insert" ON public.phone_subscriptions
  FOR INSERT WITH CHECK (true);

-- Allow admins to view all phone subscriptions
CREATE POLICY "phone_subscriptions_select" ON public.phone_subscriptions
  FOR SELECT USING (true);

-- Allow admins to delete phone subscriptions
CREATE POLICY "phone_subscriptions_delete" ON public.phone_subscriptions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.admins WHERE id = auth.uid()
    )
  );

