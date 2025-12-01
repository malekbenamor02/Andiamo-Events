-- Step 1: Create full database structure for Order Management System
-- This migration creates: cities, villes, orders, round_robin_tracker, and order_logs tables

-- ============================================
-- 1. CITIES TABLE (Reference Data)
-- ============================================
CREATE TABLE IF NOT EXISTS public.cities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default cities
INSERT INTO public.cities (name) VALUES
  ('Kairouan'),
  ('Mahdia'),
  ('Monastir'),
  ('Nabeul'),
  ('Sfax'),
  ('Sousse'),
  ('Tunis')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 2. VILLES TABLE (Reference Data - Neighborhoods)
-- ============================================
CREATE TABLE IF NOT EXISTS public.villes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  city_id UUID REFERENCES public.cities(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, city_id)
);

-- Insert default villes for Sousse
INSERT INTO public.villes (name, city_id)
SELECT 
  ville_name,
  (SELECT id FROM public.cities WHERE name = 'Sousse')
FROM (VALUES
  ('Sahloul'),
  ('Khezama'),
  ('Hammam-Sousse'),
  ('Jawhara'),
  ('Msaken'),
  ('Kalâa Kebira'),
  ('Kalâa Seghira'),
  ('Akouda'),
  ('Hergla'),
  ('Bouhsina'),
  ('Sidi Abdelhamid'),
  ('Sidi Bou Ali'),
  ('Enfidha')
) AS v(ville_name)
ON CONFLICT (name, city_id) DO NOTHING;

-- ============================================
-- 3. ADD VILLE TO AMBASSADORS TABLE
-- ============================================
ALTER TABLE public.ambassadors 
ADD COLUMN IF NOT EXISTS ville TEXT;

-- Create index for ville in ambassadors
CREATE INDEX IF NOT EXISTS idx_ambassadors_ville ON public.ambassadors(ville);

-- ============================================
-- 4. UNIFIED ORDERS TABLE
-- ============================================
-- Drop existing orders table if it exists (to avoid conflicts)
-- WARNING: This will delete all existing orders data!
-- Comment out the DROP statement if you want to preserve existing data
-- DROP TABLE IF EXISTS public.orders CASCADE;

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('platform_cod', 'platform_online', 'ambassador_manual')),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  city TEXT NOT NULL,
  ville TEXT, -- Required only if city = 'Sousse'
  ambassador_id UUID REFERENCES public.ambassadors(id) ON DELETE SET NULL,
  pass_type TEXT NOT NULL, -- e.g., 'standard', 'vip', 'premium'
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  total_price DECIMAL(10,2) NOT NULL CHECK (total_price >= 0),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('cod', 'online')),
  status TEXT NOT NULL DEFAULT 'pending_ambassador' CHECK (status IN (
    'pending_ambassador',
    'assigned',
    'accepted',
    'cancelled',
    'completed',
    'refunded',
    'fraud_flagged'
  )),
  cancellation_reason TEXT,
  assigned_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add payment_type column if it doesn't exist (for existing tables)
DO $$ 
BEGIN
  -- Check if table exists and column doesn't exist
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'orders'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'payment_type'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN payment_type TEXT NOT NULL DEFAULT 'cod';
    -- Add check constraint separately
    ALTER TABLE public.orders ADD CONSTRAINT orders_payment_type_check 
      CHECK (payment_type IN ('cod', 'online'));
  END IF;
END $$;

-- Create indexes for orders table
CREATE INDEX IF NOT EXISTS idx_orders_source ON public.orders(source);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_ambassador_id ON public.orders(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_orders_city ON public.orders(city);
CREATE INDEX IF NOT EXISTS idx_orders_ville ON public.orders(ville);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_payment_type ON public.orders(payment_type);

-- ============================================
-- 5. ROUND ROBIN TRACKER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.round_robin_tracker (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ville TEXT NOT NULL,
  last_assigned_ambassador_id UUID REFERENCES public.ambassadors(id) ON DELETE SET NULL,
  last_assigned_at TIMESTAMP WITH TIME ZONE,
  rotation_mode TEXT DEFAULT 'automatic' CHECK (rotation_mode IN ('automatic', 'manual')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ville)
);

-- Create index for round_robin_tracker
CREATE INDEX IF NOT EXISTS idx_round_robin_ville ON public.round_robin_tracker(ville);
CREATE INDEX IF NOT EXISTS idx_round_robin_ambassador ON public.round_robin_tracker(last_assigned_ambassador_id);

-- ============================================
-- 6. ORDER LOGS TABLE
-- ============================================
-- Drop order_logs if it exists but is missing required columns
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'order_logs'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'order_logs' 
    AND column_name = 'performed_by'
  ) THEN
    -- Table exists but missing required columns, drop it
    DROP TABLE IF EXISTS public.order_logs CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.order_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN (
    'created',
    'assigned',
    'accepted',
    'cancelled',
    'auto_reassigned',
    'completed',
    'manual_order_created',
    'admin_reassigned',
    'admin_cancelled',
    'admin_refunded',
    'admin_flagged_fraud',
    'email_sent',
    'email_failed',
    'sms_sent',
    'sms_failed',
    'status_changed'
  )),
  performed_by UUID, -- Ambassador ID or Admin ID (can be NULL for system actions)
  performed_by_type TEXT CHECK (performed_by_type IN ('ambassador', 'admin', 'system')),
  details JSONB, -- Additional details like reason, old_status, new_status, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure order_logs table has all required columns (for existing tables)
-- This must be done BEFORE creating indexes or functions that reference these columns
DO $$ 
BEGIN
  -- Add performed_by column if it doesn't exist
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'order_logs'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'order_logs' 
    AND column_name = 'performed_by'
  ) THEN
    ALTER TABLE public.order_logs ADD COLUMN performed_by UUID;
  END IF;

  -- Add performed_by_type column if it doesn't exist
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'order_logs'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'order_logs' 
    AND column_name = 'performed_by_type'
  ) THEN
    ALTER TABLE public.order_logs ADD COLUMN performed_by_type TEXT;
    ALTER TABLE public.order_logs ADD CONSTRAINT order_logs_performed_by_type_check 
      CHECK (performed_by_type IN ('ambassador', 'admin', 'system'));
  END IF;

  -- Add details column if it doesn't exist
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'order_logs'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'order_logs' 
    AND column_name = 'details'
  ) THEN
    ALTER TABLE public.order_logs ADD COLUMN details JSONB;
  END IF;
END $$;

-- Create indexes for order_logs (after ensuring columns exist)
CREATE INDEX IF NOT EXISTS idx_order_logs_order_id ON public.order_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_order_logs_action ON public.order_logs(action);
CREATE INDEX IF NOT EXISTS idx_order_logs_created_at ON public.order_logs(created_at);

-- Create index on performed_by only if column exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'order_logs' 
    AND column_name = 'performed_by'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_order_logs_performed_by ON public.order_logs(performed_by);
  END IF;
END $$;

-- ============================================
-- 7. ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.villes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_robin_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. RLS POLICIES
-- ============================================
-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Public can view cities" ON public.cities;
DROP POLICY IF EXISTS "Public can view villes" ON public.villes;
DROP POLICY IF EXISTS "Ambassadors can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Ambassadors can update own orders" ON public.orders;
DROP POLICY IF EXISTS "Ambassadors can create manual orders" ON public.orders;
DROP POLICY IF EXISTS "Public can create COD orders" ON public.orders;
DROP POLICY IF EXISTS "Public can create online orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can manage round robin tracker" ON public.round_robin_tracker;
DROP POLICY IF EXISTS "Ambassadors can view own order logs" ON public.order_logs;
DROP POLICY IF EXISTS "System can create order logs" ON public.order_logs;
DROP POLICY IF EXISTS "Admins can manage all order logs" ON public.order_logs;

-- Cities: Public read access
CREATE POLICY "Public can view cities" ON public.cities
  FOR SELECT USING (true);

-- Villes: Public read access
CREATE POLICY "Public can view villes" ON public.villes
  FOR SELECT USING (true);

-- Orders: Ambassadors can view their own orders
CREATE POLICY "Ambassadors can view own orders" ON public.orders
  FOR SELECT USING (
    ambassador_id IN (
      SELECT id FROM public.ambassadors WHERE auth.uid()::text = id::text
    )
  );

-- Orders: Ambassadors can update their own assigned orders
CREATE POLICY "Ambassadors can update own orders" ON public.orders
  FOR UPDATE USING (
    ambassador_id IN (
      SELECT id FROM public.ambassadors WHERE auth.uid()::text = id::text
    )
  );

-- Orders: Ambassadors can insert manual orders
CREATE POLICY "Ambassadors can create manual orders" ON public.orders
  FOR INSERT WITH CHECK (
    source = 'ambassador_manual' AND
    ambassador_id IN (
      SELECT id FROM public.ambassadors WHERE auth.uid()::text = id::text
    )
  );

-- Orders: Public can create COD orders
CREATE POLICY "Public can create COD orders" ON public.orders
  FOR INSERT WITH CHECK (source = 'platform_cod');

-- Orders: Public can create online orders
CREATE POLICY "Public can create online orders" ON public.orders
  FOR INSERT WITH CHECK (source = 'platform_online');

-- Orders: Admins have full access
CREATE POLICY "Admins can manage all orders" ON public.orders
  FOR ALL USING (true);

-- Round Robin Tracker: Admins only
CREATE POLICY "Admins can manage round robin tracker" ON public.round_robin_tracker
  FOR ALL USING (true);

-- Order Logs: Ambassadors can view logs for their orders
CREATE POLICY "Ambassadors can view own order logs" ON public.order_logs
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM public.orders 
      WHERE ambassador_id IN (
        SELECT id FROM public.ambassadors WHERE auth.uid()::text = id::text
      )
    )
  );

-- Order Logs: System can insert logs
CREATE POLICY "System can create order logs" ON public.order_logs
  FOR INSERT WITH CHECK (true);

-- Order Logs: Admins have full access
CREATE POLICY "Admins can manage all order logs" ON public.order_logs
  FOR ALL USING (true);

-- ============================================
-- 9. TRIGGERS FOR UPDATED_AT
-- ============================================
-- Drop existing triggers if they exist (to avoid conflicts)
DROP TRIGGER IF EXISTS update_cities_updated_at ON public.cities;
DROP TRIGGER IF EXISTS update_villes_updated_at ON public.villes;
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
DROP TRIGGER IF EXISTS update_round_robin_tracker_updated_at ON public.round_robin_tracker;

CREATE TRIGGER update_cities_updated_at
  BEFORE UPDATE ON public.cities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_villes_updated_at
  BEFORE UPDATE ON public.villes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_round_robin_tracker_updated_at
  BEFORE UPDATE ON public.round_robin_tracker
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 10. DROP EXISTING TRIGGERS AND FUNCTIONS (if they exist)
-- ============================================
DROP TRIGGER IF EXISTS order_action_logger ON public.orders;
DROP TRIGGER IF EXISTS order_creation_logger ON public.orders;
DROP FUNCTION IF EXISTS public.log_order_action();
DROP FUNCTION IF EXISTS public.log_order_creation();

-- ============================================
-- 11. FUNCTION TO AUTO-LOG ORDER ACTIONS
-- ============================================
CREATE OR REPLACE FUNCTION public.log_order_action()
RETURNS TRIGGER AS $$
BEGIN
  -- Log status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_logs (order_id, action, performed_by, performed_by_type, details)
    VALUES (
      NEW.id,
      CASE 
        WHEN NEW.status = 'assigned' THEN 'assigned'
        WHEN NEW.status = 'accepted' THEN 'accepted'
        WHEN NEW.status = 'cancelled' THEN 'cancelled'
        WHEN NEW.status = 'completed' THEN 'completed'
        ELSE 'status_changed'
      END,
      NEW.ambassador_id,
      'ambassador',
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'cancellation_reason', NEW.cancellation_reason
      )
    );
  END IF;

  -- Log assignment
  IF OLD.ambassador_id IS DISTINCT FROM NEW.ambassador_id AND NEW.ambassador_id IS NOT NULL THEN
    INSERT INTO public.order_logs (order_id, action, performed_by, performed_by_type, details)
    VALUES (
      NEW.id,
      'assigned',
      NEW.ambassador_id,
      'system',
      jsonb_build_object(
        'old_ambassador_id', OLD.ambassador_id,
        'new_ambassador_id', NEW.ambassador_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 12. FUNCTION TO LOG ORDER CREATION
-- ============================================
CREATE OR REPLACE FUNCTION public.log_order_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.order_logs (order_id, action, performed_by, performed_by_type, details)
  VALUES (
    NEW.id,
    CASE 
      WHEN NEW.source = 'ambassador_manual' THEN 'manual_order_created'
      ELSE 'created'
    END,
    NEW.ambassador_id,
    CASE 
      WHEN NEW.source = 'ambassador_manual' THEN 'ambassador'
      ELSE 'system'
    END,
    jsonb_build_object(
      'source', NEW.source,
      'payment_type', NEW.payment_type,
      'total_price', NEW.total_price
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 13. CREATE TRIGGERS (only after functions are created)
-- ============================================
CREATE TRIGGER order_action_logger
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_order_action();

CREATE TRIGGER order_creation_logger
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_order_creation();

