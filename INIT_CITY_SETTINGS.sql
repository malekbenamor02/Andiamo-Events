-- ============================================
-- INITIALIZE CITY SETTINGS - Run this in Supabase SQL Editor
-- ============================================
-- This will initialize the available_cities setting with default cities
-- ============================================

-- Initialize city settings with default cities
INSERT INTO site_content (key, content) VALUES 
('available_cities', '{"cities": ["Sousse", "Tunis", "Monastir", "Hammamet", "Sfax"]}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  content = EXCLUDED.content,
  updated_at = now();

-- Verify it was created
SELECT key, content, updated_at 
FROM site_content 
WHERE key = 'available_cities';

-- ============================================
-- ✅ Done! City settings initialized
-- ============================================





