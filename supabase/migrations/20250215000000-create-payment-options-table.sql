-- Create payment_options table
-- This table stores admin-configurable payment options for the order system
-- Supports: online, external_app, ambassador_cash

CREATE TABLE IF NOT EXISTS public.payment_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  option_type TEXT NOT NULL UNIQUE CHECK (option_type IN ('online', 'external_app', 'ambassador_cash')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  app_name TEXT,  -- For external_app only (default: 'AIO Events')
  external_link TEXT,  -- For external_app only
  app_image TEXT,  -- For external_app only (URL or storage path)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_payment_options_option_type ON public.payment_options(option_type);
CREATE INDEX IF NOT EXISTS idx_payment_options_enabled ON public.payment_options(enabled);

-- Insert default rows (all disabled initially)
INSERT INTO public.payment_options (option_type, enabled, app_name) VALUES
  ('online', false, NULL),
  ('external_app', false, 'AIO Events'),
  ('ambassador_cash', false, NULL)
ON CONFLICT (option_type) DO NOTHING;

-- Enable RLS
ALTER TABLE public.payment_options ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public can view enabled status (for order page)
CREATE POLICY "Public can view payment options" ON public.payment_options
  FOR SELECT USING (true);

-- RLS Policy: Admins can manage all payment options
CREATE POLICY "Admins can manage payment options" ON public.payment_options
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admins WHERE id = auth.uid()
    )
  );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_payment_options_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payment_options_updated_at
  BEFORE UPDATE ON public.payment_options
  FOR EACH ROW
  EXECUTE FUNCTION public.update_payment_options_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.payment_options IS 'Stores admin-configurable payment options. Each option can be enabled/disabled. External app option includes app_name, external_link, and app_image.';
COMMENT ON COLUMN public.payment_options.option_type IS 'Type of payment option: online, external_app, or ambassador_cash';
COMMENT ON COLUMN public.payment_options.enabled IS 'Whether this payment option is enabled for customers';
COMMENT ON COLUMN public.payment_options.app_name IS 'Name of external app (default: AIO Events). Only used for external_app type.';
COMMENT ON COLUMN public.payment_options.external_link IS 'URL to redirect users for external app payment. Only used for external_app type.';
COMMENT ON COLUMN public.payment_options.app_image IS 'Image URL or storage path for external app. Only used for external_app type.';

