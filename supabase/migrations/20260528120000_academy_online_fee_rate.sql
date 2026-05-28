-- Academy-specific online card fee rate and sold-out messages

ALTER TABLE public.academy_settings
  ADD COLUMN IF NOT EXISTS online_payment_fee_rate numeric NOT NULL DEFAULT 0.05
    CHECK (online_payment_fee_rate >= 0 AND online_payment_fee_rate <= 0.5);

ALTER TABLE public.academy_settings
  ADD COLUMN IF NOT EXISTS sold_out_message_en text NULL;

ALTER TABLE public.academy_settings
  ADD COLUMN IF NOT EXISTS sold_out_message_fr text NULL;
