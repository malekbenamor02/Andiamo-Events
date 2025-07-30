-- Migration: Add event_sponsors join table and is_global field to sponsors

-- 1. Add is_global field to sponsors table
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false;

-- 2. Create event_sponsors join table
CREATE TABLE IF NOT EXISTS event_sponsors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  sponsor_id UUID REFERENCES sponsors(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. (Optional) Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_sponsors_event_id ON event_sponsors(event_id);
CREATE INDEX IF NOT EXISTS idx_event_sponsors_sponsor_id ON event_sponsors(sponsor_id); 