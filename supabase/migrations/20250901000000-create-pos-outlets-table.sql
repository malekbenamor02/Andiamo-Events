-- Point de Vente: pos_outlets table
-- Each outlet has a unique slug used as the URL (e.g. /pos/paris-store)
-- RLS: backend only (service_role). No direct Supabase client access.

CREATE TABLE IF NOT EXISTS public.pos_outlets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_outlets_slug ON public.pos_outlets(slug);
CREATE INDEX IF NOT EXISTS idx_pos_outlets_is_active ON public.pos_outlets(is_active);

ALTER TABLE public.pos_outlets ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated; backend uses service_role which bypasses RLS.
COMMENT ON TABLE public.pos_outlets IS 'POS outlets. Each has name and slug (URL). Access via backend only (service_role).';
