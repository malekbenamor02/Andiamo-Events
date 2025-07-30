-- Improve Events Table Structure
-- Run this in your Supabase SQL Editor

-- Add new columns to events table for better event management
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS event_status TEXT DEFAULT 'active' CHECK (event_status IN ('active', 'cancelled', 'completed')),
ADD COLUMN IF NOT EXISTS capacity INTEGER,
ADD COLUMN IF NOT EXISTS age_restriction INTEGER DEFAULT 18,
ADD COLUMN IF NOT EXISTS dress_code TEXT,
ADD COLUMN IF NOT EXISTS special_notes TEXT,
ADD COLUMN IF NOT EXISTS organizer_contact TEXT,
ADD COLUMN IF NOT EXISTS event_category TEXT DEFAULT 'party' CHECK (event_category IN ('party', 'concert', 'festival', 'exhibition', 'other'));

-- Add comments for documentation
COMMENT ON COLUMN events.event_status IS 'Current status of the event';
COMMENT ON COLUMN events.capacity IS 'Maximum number of attendees';
COMMENT ON COLUMN events.age_restriction IS 'Minimum age requirement';
COMMENT ON COLUMN events.dress_code IS 'Dress code requirements';
COMMENT ON COLUMN events.special_notes IS 'Additional important information';
COMMENT ON COLUMN events.organizer_contact IS 'Contact information for event organizer';
COMMENT ON COLUMN events.event_category IS 'Type/category of the event';

-- Update existing events to have proper status
UPDATE events SET event_status = 'active' WHERE event_status IS NULL;

-- Verify the changes
SELECT 'Events table structure:' as info;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'events' 
ORDER BY ordinal_position;

-- Show sample events with new structure
SELECT 'Sample events with new fields:' as info;
SELECT id, name, event_type, event_status, event_category, 
       standard_price, vip_price, capacity, age_restriction
FROM events 
LIMIT 5; 