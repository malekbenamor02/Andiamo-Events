-- Per-pass presale discount rules (optional; uniform mode uses presale_codes columns)

ALTER TABLE public.presale_codes
  ADD COLUMN IF NOT EXISTS discount_mode text NOT NULL DEFAULT 'uniform'
    CHECK (discount_mode = ANY (ARRAY['uniform'::text, 'per_pass'::text]));

COMMENT ON COLUMN public.presale_codes.discount_mode IS
  'uniform: discount_type/discount_value apply to all passes; per_pass: rules in presale_code_pass_discounts.';

CREATE TABLE IF NOT EXISTS public.presale_code_pass_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presale_code_id uuid NOT NULL REFERENCES public.presale_codes(id) ON DELETE CASCADE,
  event_pass_id uuid NOT NULL REFERENCES public.event_passes(id) ON DELETE CASCADE,
  discount_type text NOT NULL CHECK (discount_type = ANY (ARRAY['percent'::text, 'fixed'::text])),
  discount_value numeric NOT NULL CHECK (discount_value >= 0::numeric),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (presale_code_id, event_pass_id)
);

CREATE INDEX IF NOT EXISTS idx_presale_code_pass_discounts_code
  ON public.presale_code_pass_discounts (presale_code_id);

ALTER TABLE public.presale_code_pass_discounts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.presale_code_pass_discounts IS
  'Per-pass presale discount rules when presale_codes.discount_mode = per_pass; service role only.';
