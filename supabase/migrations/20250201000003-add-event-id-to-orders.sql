-- Add event_id column to orders table to link orders to specific events

-- Add event_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'event_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_orders_event_id ON public.orders(event_id);
  END IF;
END $$;






