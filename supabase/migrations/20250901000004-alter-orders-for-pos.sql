-- Alter orders for Point de Vente: add columns and update source/payment_method constraints

-- 1. Add columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pos_outlet_id UUID REFERENCES public.pos_outlets(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pos_user_id UUID REFERENCES public.pos_users(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.admins(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES public.admins(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES public.admins(id) ON DELETE SET NULL;

-- 2. Update orders_source_check to include 'point_de_vente'
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_source_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_source_check
  CHECK (source IN ('platform_online', 'platform_cod', 'ambassador_manual', 'official_invitation', 'point_de_vente'));

-- 3. Update orders_payment_method_check to include 'pos'
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('online', 'external_app', 'ambassador_cash', 'pos'));

-- 4. Add constraint: pos orders must have source=point_de_vente and payment_method=pos (informational; the CHECKs above already allow the combination)
-- Note: orders_cod_source_check and orders_online_source_check from enforce-cod-rules use
-- (payment_method = 'cod' AND ...) OR (payment_method != 'cod') etc., so payment_method='pos' passes.

CREATE INDEX IF NOT EXISTS idx_orders_pos_outlet ON public.orders(pos_outlet_id) WHERE pos_outlet_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_pos_user ON public.orders(pos_user_id) WHERE pos_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_source_point_de_vente ON public.orders(source) WHERE source = 'point_de_vente';

COMMENT ON COLUMN public.orders.pos_outlet_id IS 'Set when source=point_de_vente. Which outlet created the order.';
COMMENT ON COLUMN public.orders.pos_user_id IS 'Set when source=point_de_vente. Which POS user created the order.';
COMMENT ON COLUMN public.orders.approved_by IS 'Admin who approved (POS or COD).';
COMMENT ON COLUMN public.orders.rejected_by IS 'Admin who rejected.';
COMMENT ON COLUMN public.orders.removed_by IS 'Admin who removed.';
