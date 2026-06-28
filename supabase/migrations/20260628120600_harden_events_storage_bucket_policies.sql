-- Explicit service_role-only policies for private events storage bucket (F-013).
-- Idempotent: safe to re-run.

DROP POLICY IF EXISTS "Service role manage events assets" ON storage.objects;
CREATE POLICY "Service role manage events assets" ON storage.objects
  FOR ALL
  USING (bucket_id = 'events' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'events' AND auth.role() = 'service_role');

COMMENT ON POLICY "Service role manage events assets" ON storage.objects IS
  'Private events bucket: service_role only. Matches tickets/career-documents pattern.';
