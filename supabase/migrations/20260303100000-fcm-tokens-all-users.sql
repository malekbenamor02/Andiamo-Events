-- Allow FCM tokens for all PWA users (not only admins).
-- admin_id NULL = token from a public user who installed the PWA.
ALTER TABLE fcm_tokens
  ALTER COLUMN admin_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_admin_id_null ON fcm_tokens(admin_id) WHERE admin_id IS NOT NULL;
