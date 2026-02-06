-- Run this in Supabase SQL Editor AFTER running the direct_qr migration.
-- Creates 2 direct QR tickets for event d186df20-ca94-4344-b0f6-b57b4d4aa033

INSERT INTO public.qr_tickets (
  secure_token,
  source,
  payment_method,
  ticket_id,
  order_id,
  order_pass_id,
  invitation_id,
  buyer_name,
  buyer_phone,
  buyer_city,
  pass_type,
  pass_price,
  ticket_status,
  generated_at,
  event_id,
  event_name,
  event_date
)
VALUES
  (
    gen_random_uuid(),
    'Invitation',
    'external_app',
    NULL,
    NULL,
    NULL,
    NULL,
    'Malek Ben Amor',
    '27169458',
    'Sousse',
    'VIP',
    120,
    'VALID',
    NOW(),
    'd186df20-ca94-4344-b0f6-b57b4d4aa033',
    NULL,
    NULL
  )