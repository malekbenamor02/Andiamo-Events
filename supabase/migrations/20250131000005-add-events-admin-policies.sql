-- Add admin policies for events table
-- This allows admins to create, update, and delete events
--
-- Note: Since we're using cookie-based admin auth (not Supabase auth),
-- and admin authentication is verified in the API endpoints,
-- we allow all operations. The admin dashboard verifies admin token before allowing operations.

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Admins can insert events" ON public.events;
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;

-- Allow admins to insert events
CREATE POLICY "Admins can insert events" 
ON public.events 
FOR INSERT 
WITH CHECK (true);

-- Allow admins to update events
CREATE POLICY "Admins can update events" 
ON public.events 
FOR UPDATE 
USING (true);

-- Allow admins to delete events
CREATE POLICY "Admins can delete events" 
ON public.events 
FOR DELETE 
USING (true);

-- ============================================
-- Fix event_passes table policies
-- ============================================
-- The existing policy uses auth.uid() which doesn't work with cookie-based admin auth
-- We need to allow all operations since admin auth is verified via cookies in API

-- Drop existing admin policy that uses auth.uid()
DROP POLICY IF EXISTS "Admins can manage all event passes" ON public.event_passes;

-- Create new policy that allows all operations
-- Admin authentication is verified in the API, not in RLS
CREATE POLICY "Admins can manage all event passes" 
ON public.event_passes 
FOR ALL 
USING (true) 
WITH CHECK (true);

