-- Add Order Expiration System
-- Allows admins to set expiration dates/timers for pending orders
--
-- PRODUCTION-SAFE MIGRATION:
-- - Uses IF NOT EXISTS to prevent errors
-- - Idempotent: safe to run multiple times
-- - No data loss: only adds new columns and tables

-- Step 1: Add expiration fields to orders table
DO $$ 
BEGIN
  -- Add expires_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Add expiration_set_by column (admin_id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'expiration_set_by'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN expiration_set_by UUID REFERENCES public.admins(id) ON DELETE SET NULL;
  END IF;

  -- Add expiration_notes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'expiration_notes'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN expiration_notes TEXT;
  END IF;
END $$;

-- Step 2: Create order_expiration_settings table for global defaults
CREATE TABLE IF NOT EXISTS public.order_expiration_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_status TEXT NOT NULL CHECK (order_status IN ('PENDING_CASH', 'PENDING_ONLINE', 'PENDING_ADMIN_APPROVAL')),
  default_expiration_hours INTEGER NOT NULL DEFAULT 24 CHECK (default_expiration_hours > 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(order_status)
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_expires_at ON public.orders(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_expiration_set_by ON public.orders(expiration_set_by) WHERE expiration_set_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status_expires_at ON public.orders(status, expires_at) WHERE expires_at IS NOT NULL;

-- Step 4: Insert default expiration settings
INSERT INTO public.order_expiration_settings (order_status, default_expiration_hours, is_active)
VALUES 
  ('PENDING_CASH', 48, true),
  ('PENDING_ONLINE', 24, true),
  ('PENDING_ADMIN_APPROVAL', 72, true)
ON CONFLICT (order_status) DO NOTHING;

-- Step 5: Add comments
COMMENT ON COLUMN public.orders.expires_at IS 'Timestamp when order expires (if set by admin)';
COMMENT ON COLUMN public.orders.expiration_set_by IS 'Admin ID who set the expiration';
COMMENT ON COLUMN public.orders.expiration_notes IS 'Optional notes/reason for setting expiration';
COMMENT ON TABLE public.order_expiration_settings IS 'Global default expiration settings per order status';

-- Step 6: Add RLS policies for order_expiration_settings (admin only)
ALTER TABLE public.order_expiration_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all settings
CREATE POLICY IF NOT EXISTS "Admins can view expiration settings"
  ON public.order_expiration_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.id = auth.uid()
      AND admins.is_active = true
    )
  );

-- Policy: Admins can insert settings
CREATE POLICY IF NOT EXISTS "Admins can insert expiration settings"
  ON public.order_expiration_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.id = auth.uid()
      AND admins.is_active = true
    )
  );

-- Policy: Admins can update settings
CREATE POLICY IF NOT EXISTS "Admins can update expiration settings"
  ON public.order_expiration_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.id = auth.uid()
      AND admins.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.id = auth.uid()
      AND admins.is_active = true
    )
  );

-- Policy: Admins can delete settings
CREATE POLICY IF NOT EXISTS "Admins can delete expiration settings"
  ON public.order_expiration_settings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.id = auth.uid()
      AND admins.is_active = true
    )
  );
