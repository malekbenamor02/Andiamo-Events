-- Remove sensitive tables from supabase_realtime publication (F-002).
-- Client dashboards currently subscribe to career_applications; after apply, use admin API polling.
-- Idempotent: safe to re-run.

DO $$
DECLARE
  t text;
  sensitive_tables text[] := ARRAY[
    'orders',
    'ambassador_applications',
    'career_applications',
    'marketing_campaigns',
    'marketing_campaign_recipients'
  ];
BEGIN
  FOREACH t IN ARRAY sensitive_tables LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format(
        'ALTER PUBLICATION supabase_realtime DROP TABLE public.%I',
        t
      );
      RAISE NOTICE 'Dropped public.% from supabase_realtime', t;
    ELSE
      RAISE NOTICE 'public.% not in supabase_realtime (skip)', t;
    END IF;
  END LOOP;
END $$;
