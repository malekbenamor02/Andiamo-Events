-- Prevent duplicate Meta Lead event_id across ambassador applications (frontend retry protection).
CREATE UNIQUE INDEX IF NOT EXISTS idx_ambassador_applications_meta_event_id_unique
  ON public.ambassador_applications ((meta_attribution->>'eventId'))
  WHERE meta_attribution->>'eventId' IS NOT NULL;

COMMENT ON INDEX public.idx_ambassador_applications_meta_event_id_unique IS
  'Ensures one ambassador application per Meta Lead event_id for CAPI dedup and retry safety';
