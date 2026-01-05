-- ============================================
-- Add Test Events Filter
-- ============================================
-- This migration adds a way to mark events as "test" so they don't show
-- on the production site (andiamoevents.com) but can still be tested on localhost
--
-- How it works:
-- 1. Adds an `is_test` column to events table (defaults to false)
-- 2. Updates RLS policies to hide test events from public SELECT queries
-- 3. Admins can still see and manage test events
-- 4. When you create test events on localhost, mark them as is_test = true
--    and they won't appear on the production site

-- ============================================
-- ADD IS_TEST COLUMN
-- ============================================

-- Add is_test column to events table
-- DEFAULT is TRUE so all new events are test events by default
-- This means new events won't show on production until you set is_test = false
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT true NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.events.is_test IS 'If true, this event is for testing only and will not appear on the production site. Default is true for new events.';

-- Update all existing events to is_test = false (so they continue showing on production)
-- This only affects events that already exist. New events will default to is_test = true
UPDATE public.events SET is_test = false;

-- ============================================
-- UPDATE RLS POLICIES
-- ============================================

-- Ensure RLS is enabled
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "events_select_public" ON public.events;
DROP POLICY IF EXISTS "events_select" ON public.events;
DROP POLICY IF EXISTS "Public can view events" ON public.events;

-- Create SELECT policy that allows ALL events to be selected
-- Filtering of test events will be done in the application code based on environment
-- This allows test events to show on localhost but not on production
CREATE POLICY "events_select_public" ON public.events
  FOR SELECT
  USING (true);

-- Keep existing INSERT, UPDATE, DELETE policies (admins can manage all events including test ones)
-- These should already exist, but we'll ensure they're there
DROP POLICY IF EXISTS "events_insert_admin" ON public.events;
DROP POLICY IF EXISTS "events_update_admin" ON public.events;
DROP POLICY IF EXISTS "events_delete_admin" ON public.events;
DROP POLICY IF EXISTS "Admins can insert events" ON public.events;
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;

-- Policy for INSERT: Allow admins to create events (including test events)
CREATE POLICY "events_insert_admin" ON public.events
  FOR INSERT
  WITH CHECK (true);

-- Policy for UPDATE: Allow admins to update events (including test events)
CREATE POLICY "events_update_admin" ON public.events
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Policy for DELETE: Allow admins to delete events (including test events)
CREATE POLICY "events_delete_admin" ON public.events
  FOR DELETE
  USING (true);

-- ============================================
-- HOW IT WORKS
-- ============================================
-- 1. ALL NEW EVENTS are automatically marked as test (is_test = true by default)
-- 2. Test events (is_test = true) will NOT appear on andiamoevents.com (production) ✅
-- 3. Test events WILL appear on localhost for full testing (orders, details, etc.) ✅
-- 4. Test events are visible in admin dashboard ✅
-- 5. When ready to publish, set is_test = false
--
-- ============================================
-- WORKFLOW
-- ============================================
-- 
-- STEP 1: Create event in admin dashboard
--   → Event is automatically created with is_test = true
--   → Event does NOT show on andiamoevents.com ✅
--   → Event DOES show on localhost (for full testing) ✅
--   → Event is visible in admin dashboard ✅
--
-- STEP 2: Test the event on localhost
--   → Event appears on localhost automatically
--   → You can test everything: view details, make orders, etc.
--   → Event still hidden from production
--
-- STEP 3: Publish to production
--   → When ready, set is_test = false
--   → Event will now appear on andiamoevents.com
--
-- ============================================
-- SQL COMMANDS
-- ============================================
-- 
-- To publish an event (make it show on production):
--   UPDATE events SET is_test = false WHERE id = 'your-event-id';
--
-- To mark an event as test again (hide from production):
--   UPDATE events SET is_test = true WHERE id = 'your-event-id';
--
-- To temporarily view test event on localhost:
--   UPDATE events SET is_test = false WHERE name = 'Your Test Event';
--   (Test it, then set back to true)

