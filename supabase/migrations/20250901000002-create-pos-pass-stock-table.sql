-- Point de Vente: pos_pass_stock table
-- Stock per outlet. Never touches event_passes.sold_quantity.

CREATE TABLE IF NOT EXISTS public.pos_pass_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_outlet_id UUID NOT NULL REFERENCES public.pos_outlets(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  pass_id UUID NOT NULL REFERENCES public.event_passes(id) ON DELETE CASCADE,
  max_quantity INTEGER NULL,
  sold_quantity INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pos_outlet_id, event_id, pass_id),
  CHECK (sold_quantity >= 0),
  CHECK (max_quantity IS NULL OR max_quantity >= 0),
  CHECK (max_quantity IS NULL OR sold_quantity <= max_quantity)
);

CREATE INDEX IF NOT EXISTS idx_pos_pass_stock_outlet_event ON public.pos_pass_stock(pos_outlet_id, event_id);

ALTER TABLE public.pos_pass_stock ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.pos_pass_stock IS 'POS stock per outlet. Independent from event_passes.sold_quantity.';
