-- Add payment_confirm_response to store getOrderStatus response for admin Payment Logs display
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_confirm_response JSONB;
COMMENT ON COLUMN public.orders.payment_confirm_response IS 'ClicToPay getOrderStatusExtended response, stored when confirm is processed. Shown in admin Payment Logs.';
