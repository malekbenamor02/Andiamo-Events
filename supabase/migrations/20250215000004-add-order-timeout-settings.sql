-- Add order timeout settings to site_content table
-- Allows configuration of timeout duration for PENDING_CASH orders

INSERT INTO public.site_content (key, content, updated_at) 
VALUES (
  'order_timeout_settings',
  '{"cash_payment_timeout_hours": 24}'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  content = EXCLUDED.content,
  updated_at = NOW();

-- Add comment
COMMENT ON COLUMN public.site_content.content IS 'JSON content. For order_timeout_settings key: {"cash_payment_timeout_hours": number}';

