-- Quick script to enable payment options
-- Run this in Supabase SQL Editor to enable payment methods

-- Enable Online Payment
UPDATE public.payment_options 
SET enabled = true, updated_at = NOW()
WHERE option_type = 'online';

-- Enable Ambassador Cash Payment
UPDATE public.payment_options 
SET enabled = true, updated_at = NOW()
WHERE option_type = 'ambassador_cash';

-- Enable External App Payment (optional - configure link first)
-- UPDATE public.payment_options 
-- SET enabled = true, 
--     external_link = 'https://your-payment-app.com',
--     app_name = 'AIO Events',
--     updated_at = NOW()
-- WHERE option_type = 'external_app';

-- Verify the changes
SELECT option_type, enabled, app_name, external_link 
FROM public.payment_options 
ORDER BY option_type;

