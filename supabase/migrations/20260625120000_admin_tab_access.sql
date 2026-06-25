-- Per-admin dashboard tab access (explicit grants override role defaults for regular admins).
-- Backend service role only — no anon/authenticated direct access.

CREATE TABLE IF NOT EXISTS public.admin_tab_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  tab_key text NOT NULL,
  show_in_mobile boolean NOT NULL DEFAULT false,
  mobile_order integer NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_tab_access_admin_tab_unique UNIQUE (admin_id, tab_key)
);

CREATE INDEX IF NOT EXISTS idx_admin_tab_access_admin_id
  ON public.admin_tab_access (admin_id);

CREATE INDEX IF NOT EXISTS idx_admin_tab_access_mobile
  ON public.admin_tab_access (admin_id, show_in_mobile, mobile_order);

COMMENT ON TABLE public.admin_tab_access IS
  'Explicit per-admin dashboard tab grants. No rows = role defaults. Super admins ignore rows (always full access).';

-- updated_at trigger (function exists from earlier migrations)
DROP TRIGGER IF EXISTS update_admin_tab_access_updated_at ON public.admin_tab_access;
CREATE TRIGGER update_admin_tab_access_updated_at
  BEFORE UPDATE ON public.admin_tab_access
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: deny all — writes via backend service role only
ALTER TABLE public.admin_tab_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_tab_access_deny_anon_all" ON public.admin_tab_access;
CREATE POLICY "admin_tab_access_deny_anon_all" ON public.admin_tab_access
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Atomically replace tab access rows for one admin
CREATE OR REPLACE FUNCTION public.replace_admin_tab_access(
  p_admin_id uuid,
  p_rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.admin_tab_access WHERE admin_id = p_admin_id;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.admin_tab_access (admin_id, tab_key, show_in_mobile, mobile_order)
  SELECT
    p_admin_id,
    r.tab_key,
    COALESCE(r.show_in_mobile, false),
    CASE
      WHEN r.mobile_order IS NULL OR btrim(r.mobile_order) = '' OR lower(btrim(r.mobile_order)) = 'null' THEN NULL
      ELSE r.mobile_order::integer
    END
  FROM jsonb_to_recordset(p_rows) AS r(
    tab_key text,
    show_in_mobile boolean,
    mobile_order text
  );
END;
$$;

COMMENT ON FUNCTION public.replace_admin_tab_access(uuid, jsonb) IS
  'Deletes and re-inserts admin_tab_access rows for one admin in a single transaction.';
