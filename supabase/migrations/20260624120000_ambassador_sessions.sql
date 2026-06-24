-- Server-side ambassador sessions (opaque token hash only; raw token lives in HttpOnly cookie).
-- Accessed exclusively via service-role backend — no client/anon RLS policies.

CREATE TABLE IF NOT EXISTS ambassador_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id UUID NOT NULL REFERENCES ambassadors(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  absolute_expires_at TIMESTAMPTZ NOT NULL,
  rotated_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  user_agent TEXT,
  ip_address TEXT,
  device_label TEXT,
  created_by_ip TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ambassador_sessions_token_hash
  ON ambassador_sessions (token_hash);

CREATE INDEX IF NOT EXISTS idx_ambassador_sessions_ambassador_id
  ON ambassador_sessions (ambassador_id);

CREATE INDEX IF NOT EXISTS idx_ambassador_sessions_expires_at
  ON ambassador_sessions (expires_at);

CREATE INDEX IF NOT EXISTS idx_ambassador_sessions_revoked_at
  ON ambassador_sessions (revoked_at);

CREATE INDEX IF NOT EXISTS idx_ambassador_sessions_active_by_ambassador
  ON ambassador_sessions (ambassador_id)
  WHERE revoked_at IS NULL;

ALTER TABLE ambassador_sessions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE ambassador_sessions IS
  'Opaque ambassador portal sessions. Raw tokens are HttpOnly cookies; only token_hash is stored. Backend service-role only.';
