-- Point de Vente: pos_users table
-- Each pos_user belongs to one pos_outlet. Email unique per outlet.
-- password_hash never exposed in API. Admin can edit any pos_user password.

CREATE TABLE IF NOT EXISTS public.pos_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_outlet_id UUID NOT NULL REFERENCES public.pos_outlets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_paused BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email unique per outlet (expression-based: must use UNIQUE INDEX, not inline UNIQUE)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_users_outlet_email_lower
  ON public.pos_users (pos_outlet_id, LOWER(email));

CREATE INDEX IF NOT EXISTS idx_pos_users_outlet ON public.pos_users(pos_outlet_id);
CREATE INDEX IF NOT EXISTS idx_pos_users_email_lower ON public.pos_users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_pos_users_active_paused ON public.pos_users(is_active, is_paused);

ALTER TABLE public.pos_users ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.pos_users IS 'POS users per outlet. password_hash never in API. Admin can edit any password.';
