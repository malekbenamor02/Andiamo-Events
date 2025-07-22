-- Add Gallery Fields to Events Table
-- Run this in your Supabase SQL Editor to add gallery functionality to events

-- Add new columns to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'upcoming' CHECK (event_type IN ('upcoming', 'gallery')),
ADD COLUMN IF NOT EXISTS gallery_images TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS gallery_videos TEXT[] DEFAULT '{}';

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_gallery_images ON events USING GIN(gallery_images);
CREATE INDEX IF NOT EXISTS idx_events_gallery_videos ON events USING GIN(gallery_videos);

-- Update existing events to have the default event_type
UPDATE events SET event_type = 'upcoming' WHERE event_type IS NULL;

-- Verify the changes
SELECT 'Events table structure:' as info;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'events' 
AND column_name IN ('event_type', 'gallery_images', 'gallery_videos');

SELECT 'Sample events with new fields:' as info;
SELECT id, name, event_type, 
       array_length(gallery_images, 1) as image_count,
       array_length(gallery_videos, 1) as video_count
FROM events 
LIMIT 5; 