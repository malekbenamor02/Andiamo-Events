-- Create event_passes table for flexible pass management
-- This table stores all pass types (Standard and custom) for each event

CREATE TABLE IF NOT EXISTS public.event_passes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  description TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure unique pass names per event
  UNIQUE(event_id, name)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_event_passes_event_id ON public.event_passes(event_id);
CREATE INDEX IF NOT EXISTS idx_event_passes_is_default ON public.event_passes(is_default);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_event_passes_updated_at
  BEFORE UPDATE ON public.event_passes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.event_passes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public can view event passes
CREATE POLICY "Public can view event passes" ON public.event_passes
  FOR SELECT USING (true);

-- RLS Policy: Admins can manage all event passes
CREATE POLICY "Admins can manage all event passes" ON public.event_passes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admins WHERE id = auth.uid()
    )
  );

-- Add constraint to ensure at least one default pass per event
-- This will be enforced at the application level, but we add a unique constraint
-- to prevent multiple default passes per event
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_passes_one_default_per_event 
ON public.event_passes(event_id) 
WHERE is_default = true;

-- Add comments for documentation
COMMENT ON TABLE public.event_passes IS 'Stores all pass types (Standard and custom) for each event. Each event must have at least one default pass named "Standard".';
COMMENT ON COLUMN public.event_passes.name IS 'Pass name (e.g., "Standard", "VIP", "Early Bird"). Must be unique within the same event.';
COMMENT ON COLUMN public.event_passes.price IS 'Pass price in TND. Must be >= 0.';
COMMENT ON COLUMN public.event_passes.description IS 'Short explanation of what the pass includes.';
COMMENT ON COLUMN public.event_passes.is_default IS 'True only for the mandatory "Standard" pass. Only one default pass per event.';

