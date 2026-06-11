-- Draft selections for ambassador application review batches.
-- Additive only: no changes to ambassador_applications.

CREATE TABLE IF NOT EXISTS public.ambassador_application_selections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_admin_id UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  created_by_name TEXT
);

CREATE TABLE IF NOT EXISTS public.ambassador_application_selection_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  selection_id UUID NOT NULL REFERENCES public.ambassador_application_selections(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.ambassador_applications(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by_admin_id UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  added_by_name TEXT,
  UNIQUE (selection_id, application_id)
);

CREATE INDEX IF NOT EXISTS idx_ambassador_application_selections_status
  ON public.ambassador_application_selections(status);
CREATE INDEX IF NOT EXISTS idx_ambassador_application_selections_created_at
  ON public.ambassador_application_selections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ambassador_application_selection_items_selection_id
  ON public.ambassador_application_selection_items(selection_id);
CREATE INDEX IF NOT EXISTS idx_ambassador_application_selection_items_application_id
  ON public.ambassador_application_selection_items(application_id);

ALTER TABLE public.ambassador_application_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambassador_application_selection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY ambassador_application_selections_select
  ON public.ambassador_application_selections FOR SELECT USING (true);
CREATE POLICY ambassador_application_selections_insert
  ON public.ambassador_application_selections FOR INSERT WITH CHECK (true);
CREATE POLICY ambassador_application_selections_update
  ON public.ambassador_application_selections FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY ambassador_application_selections_delete
  ON public.ambassador_application_selections FOR DELETE USING (true);

CREATE POLICY ambassador_application_selection_items_select
  ON public.ambassador_application_selection_items FOR SELECT USING (true);
CREATE POLICY ambassador_application_selection_items_insert
  ON public.ambassador_application_selection_items FOR INSERT WITH CHECK (true);
CREATE POLICY ambassador_application_selection_items_update
  ON public.ambassador_application_selection_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY ambassador_application_selection_items_delete
  ON public.ambassador_application_selection_items FOR DELETE USING (true);

CREATE TRIGGER update_ambassador_application_selections_updated_at
  BEFORE UPDATE ON public.ambassador_application_selections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.ambassador_application_selections IS 'Named draft batches for grouping ambassador applications during admin review';
COMMENT ON TABLE public.ambassador_application_selection_items IS 'Applications included in a review selection; tracks who added each item';
