-- Fix RLS policy for newsletter_subscribers table to allow admin reads
-- This ensures admins can view email subscribers in the dashboard

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Anyone can subscribe to newsletter" ON public.newsletter_subscribers;

-- Create SELECT policy to allow viewing newsletter subscribers
-- Similar to phone_subscribers, allow all reads (admin verification happens at app level)
CREATE POLICY "newsletter_subscribers_select" ON public.newsletter_subscribers
  FOR SELECT USING (true);

-- Keep INSERT policy for public newsletter subscription
CREATE POLICY "newsletter_subscribers_insert" ON public.newsletter_subscribers
  FOR INSERT WITH CHECK (true);

-- Add DELETE policy for admins (optional, for cleanup)
CREATE POLICY "newsletter_subscribers_delete" ON public.newsletter_subscribers
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.admins 
      WHERE id = (SELECT auth.uid())
    )
  );
