-- Fix RLS policies for ambassadors who use custom authentication (not Supabase Auth)
-- Ambassadors authenticate via localStorage, so we can't use auth.uid() in policies

-- Drop existing ambassador policies
DROP POLICY IF EXISTS "Ambassadors can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Ambassadors can update own orders" ON public.orders;
DROP POLICY IF EXISTS "Ambassadors can create manual orders" ON public.orders;
DROP POLICY IF EXISTS "Ambassadors can view own order logs" ON public.order_logs;

-- Create new policies that work with custom authentication
-- Note: These policies are more permissive but validate that ambassador_id exists
-- The application layer should validate that the logged-in ambassador matches the ambassador_id

-- Orders: Ambassadors can view orders assigned to them (by ambassador_id)
CREATE POLICY "Ambassadors can view own orders" ON public.orders
  FOR SELECT USING (
    ambassador_id IS NOT NULL AND
    ambassador_id IN (SELECT id FROM public.ambassadors WHERE status = 'approved')
  );

-- Orders: Ambassadors can update orders assigned to them
CREATE POLICY "Ambassadors can update own orders" ON public.orders
  FOR UPDATE USING (
    ambassador_id IS NOT NULL AND
    ambassador_id IN (SELECT id FROM public.ambassadors WHERE status = 'approved')
  );

-- Orders: Ambassadors can insert manual orders
-- This policy allows any ambassador_manual order with a valid ambassador_id
-- The application should validate the logged-in ambassador matches
CREATE POLICY "Ambassadors can create manual orders" ON public.orders
  FOR INSERT WITH CHECK (
    source = 'ambassador_manual' AND
    ambassador_id IS NOT NULL AND
    ambassador_id IN (SELECT id FROM public.ambassadors WHERE status = 'approved')
  );

-- Order Logs: Ambassadors can view logs for orders assigned to them
CREATE POLICY "Ambassadors can view own order logs" ON public.order_logs
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM public.orders 
      WHERE ambassador_id IS NOT NULL AND
            ambassador_id IN (SELECT id FROM public.ambassadors WHERE status = 'approved')
    )
  );






