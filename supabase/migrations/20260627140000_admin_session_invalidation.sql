-- Post-incident: force admin password reset and invalidate existing JWT sessions.

ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS requires_password_change BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.admins.requires_password_change IS
  'When true, admin must change password via /api/admin/change-password before full access.';
COMMENT ON COLUMN public.admins.session_version IS
  'Incremented to invalidate outstanding admin JWT cookies after security incidents.';

UPDATE public.admins
SET
  requires_password_change = true,
  session_version = COALESCE(session_version, 1) + 1,
  updated_at = NOW();
