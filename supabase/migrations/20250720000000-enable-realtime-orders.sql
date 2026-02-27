-- Enable Supabase Realtime for orders table
-- Required for admin dashboard to show online orders in real time without refresh
-- When an order is created or status changes (e.g. ClicToPay payment confirmed),
-- the admin Online Orders tab will automatically update

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;
