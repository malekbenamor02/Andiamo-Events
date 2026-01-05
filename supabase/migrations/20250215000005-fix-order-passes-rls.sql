-- Fix Row-Level Security (RLS) policies for order_passes table
-- Allow public inserts for order creation flow

-- Enable RLS if not already enabled
ALTER TABLE public.order_passes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
-- Note: Using exact policy names from the existing migration
DROP POLICY IF EXISTS "Public can insert order passes" ON public.order_passes;
DROP POLICY IF EXISTS "Public can view order passes" ON public.order_passes;
DROP POLICY IF EXISTS "Admins can manage all order passes" ON public.order_passes;

-- Allow public to insert order_passes (needed for order creation)
-- This is the missing policy that causes the RLS error
CREATE POLICY "Public can insert order passes" ON public.order_passes
  FOR INSERT
  WITH CHECK (true);

-- Recreate: Allow public to view order_passes (for order details)
CREATE POLICY "Public can view order passes" ON public.order_passes
  FOR SELECT
  USING (true);

-- Recreate: Allow admins to manage all order_passes
CREATE POLICY "Admins can manage all order passes" ON public.order_passes
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid()));

-- Add comments
COMMENT ON POLICY "Public can insert order passes" ON public.order_passes IS 'Allows public (unauthenticated) users to create order_passes records when creating orders';
COMMENT ON POLICY "Public can view order passes" ON public.order_passes IS 'Allows public to view order_passes for order details';
COMMENT ON POLICY "Admins can manage all order passes" ON public.order_passes IS 'Allows admins full access to order_passes table';

