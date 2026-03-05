-- App install prompt config: single row for super_admin-editable banner (title, body, CTA, frequency).
CREATE TABLE IF NOT EXISTS app_install_prompt_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Install Andiamo Events',
  body text NOT NULL DEFAULT 'Add to your home screen for quick access and a better experience.',
  cta_label text NOT NULL DEFAULT 'Install',
  dismiss_label text NOT NULL DEFAULT 'Not now',
  show_frequency text NOT NULL DEFAULT 'once_every_n_days' CHECK (show_frequency IN ('disabled', 'once_per_session', 'once_every_n_days', 'once_per_week', 'always_until_dismissed')),
  n_days int CHECK (n_days IS NULL OR (n_days >= 1 AND n_days <= 365)),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES admins(id)
);

-- Single row: use fixed id so we can upsert in API.
INSERT INTO app_install_prompt_config (id, title, body, cta_label, dismiss_label, show_frequency, n_days)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Install Andiamo Events', 'Add to your home screen for quick access and a better experience.', 'Install', 'Not now', 'once_every_n_days', 7)
ON CONFLICT (id) DO NOTHING;

-- FCM tokens: store device tokens for push (admin-only for now).
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  device_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_admin_id ON fcm_tokens(admin_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_token ON fcm_tokens(token);

-- RLS: no direct client access; backend uses service role.
ALTER TABLE app_install_prompt_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Deny all for anon and authenticated (API uses service role).
CREATE POLICY "app_install_prompt_config_no_client" ON app_install_prompt_config FOR ALL USING (false);
CREATE POLICY "fcm_tokens_no_client" ON fcm_tokens FOR ALL USING (false);
