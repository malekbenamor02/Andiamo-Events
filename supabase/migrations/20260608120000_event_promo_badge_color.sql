-- One random badge color per promo code (stored, not derived from code name).

ALTER TABLE public.event_promo_codes
  ADD COLUMN IF NOT EXISTS badge_color text;

UPDATE public.event_promo_codes
SET badge_color = (
  ARRAY[
    '#e11d48', '#ea580c', '#ca8a04', '#16a34a', '#0891b2',
    '#2563eb', '#7c3aed', '#db2777', '#0d9488', '#4f46e5'
  ]
)[1 + floor(random() * 10)::int]
WHERE badge_color IS NULL;

ALTER TABLE public.event_promo_codes
  ALTER COLUMN badge_color SET NOT NULL;

ALTER TABLE public.event_promo_codes
  DROP CONSTRAINT IF EXISTS event_promo_codes_badge_color_check;

ALTER TABLE public.event_promo_codes
  ADD CONSTRAINT event_promo_codes_badge_color_check
  CHECK (badge_color = ANY (ARRAY[
    '#e11d48'::text, '#ea580c'::text, '#ca8a04'::text, '#16a34a'::text, '#0891b2'::text,
    '#2563eb'::text, '#7c3aed'::text, '#db2777'::text, '#0d9488'::text, '#4f46e5'::text
  ]));

COMMENT ON COLUMN public.event_promo_codes.badge_color IS
  'Random UI color assigned at creation; stable for this promo code.';
