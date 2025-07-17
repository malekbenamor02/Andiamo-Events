-- Add developer credit content to site_content table
INSERT INTO site_content (key, content, created_at, updated_at)
VALUES (
  'developer_credit', '{"name": "Malek Ben Amor", "instagram": "https://www.instagram.com/malek.bamor/"}', NOW(), NOW()
) ON CONFLICT (key) DO UPDATE SET
  content = EXCLUDED.content,
  updated_at = NOW(); 