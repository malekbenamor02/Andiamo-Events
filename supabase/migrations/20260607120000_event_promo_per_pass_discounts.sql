-- Per-pass event promo discounts (mirrors presale_codes.discount_mode + presale_code_pass_discounts).

ALTER TABLE public.event_promo_codes
  ADD COLUMN IF NOT EXISTS discount_mode text NOT NULL DEFAULT 'uniform'
    CHECK (discount_mode = ANY (ARRAY['uniform'::text, 'per_pass'::text]));

COMMENT ON COLUMN public.event_promo_codes.discount_mode IS
  'uniform: discount_type/discount_value on all passes; per_pass: rules in event_promo_code_pass_discounts.';

CREATE TABLE IF NOT EXISTS public.event_promo_code_pass_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid NOT NULL REFERENCES public.event_promo_codes(id) ON DELETE CASCADE,
  event_pass_id uuid NOT NULL REFERENCES public.event_passes(id) ON DELETE CASCADE,
  discount_type text NOT NULL CHECK (discount_type = ANY (ARRAY['percent'::text, 'fixed'::text])),
  discount_value numeric NOT NULL CHECK (discount_value >= 0::numeric),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promo_code_id, event_pass_id)
);

CREATE INDEX IF NOT EXISTS idx_event_promo_code_pass_discounts_code
  ON public.event_promo_code_pass_discounts (promo_code_id);

ALTER TABLE public.event_promo_code_pass_discounts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.event_promo_code_pass_discounts IS
  'Per-pass promo rules when event_promo_codes.discount_mode = per_pass; service role only.';

-- Legacy scoped codes (applies_to_all = false): one rule per linked pass using header discount.
INSERT INTO public.event_promo_code_pass_discounts (
  promo_code_id,
  event_pass_id,
  discount_type,
  discount_value,
  updated_at
)
SELECT
  j.promo_code_id,
  j.event_pass_id,
  c.discount_type,
  c.discount_value,
  now()
FROM public.event_promo_code_passes j
JOIN public.event_promo_codes c ON c.id = j.promo_code_id
WHERE c.applies_to_all = false
  AND c.discount_mode = 'uniform'
  AND NOT EXISTS (
    SELECT 1
    FROM public.event_promo_code_pass_discounts d
    WHERE d.promo_code_id = j.promo_code_id
      AND d.event_pass_id = j.event_pass_id
  );

UPDATE public.event_promo_codes
SET discount_mode = 'per_pass'
WHERE applies_to_all = false
  AND discount_mode = 'uniform';
