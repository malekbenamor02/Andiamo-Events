-- Fix RLS policies for events table
-- Run this in your Supabase SQL Editor

-- First, let's check the current RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'events';

-- Disable RLS temporarily to allow all operations
ALTER TABLE events DISABLE ROW LEVEL SECURITY;

-- Or if you want to keep RLS enabled, create proper policies:
-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Enable all operations for events" ON events;
DROP POLICY IF EXISTS "Allow all operations on events" ON events;
DROP POLICY IF EXISTS "Public read access to events" ON events;

-- Create a policy that allows all operations (for admin access)
CREATE POLICY "Enable all operations for events" ON events
  FOR ALL USING (true) WITH CHECK (true);

-- Alternative: Create specific policies for different operations
-- CREATE POLICY "Public read access to events" ON events
--   FOR SELECT USING (true);

-- CREATE POLICY "Admin full access to events" ON events
--   FOR ALL USING (true) WITH CHECK (true);

-- Test the deletion
-- DELETE FROM events WHERE id = 'your-event-id';

-- Check if events table has any constraints that might prevent deletion
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'events'; 