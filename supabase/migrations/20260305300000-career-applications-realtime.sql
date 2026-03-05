-- Enable Supabase Realtime for career_applications so the admin dashboard
-- can show new applications and status changes without refresh.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'career_applications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.career_applications;
  END IF;
END $$;

-- Allow SELECT so the admin dashboard realtime subscription receives events
-- (same pattern as ambassador_applications; admin UI is protected by route auth).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'career_applications' AND policyname = 'career_applications_select'
  ) THEN
    CREATE POLICY "career_applications_select"
      ON public.career_applications FOR SELECT
      USING (true);
  END IF;
END $$;
