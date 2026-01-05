-- Migration: Add test phone number for Broadcast Mode testing
-- This test number (27169458) will be used to test the Broadcast SMS functionality
-- When testing Broadcast Mode, SMS will be sent only to this number

-- Insert test number if it doesn't already exist
-- The phone_number column has a UNIQUE constraint, so ON CONFLICT prevents duplicates
INSERT INTO public.phone_subscribers (phone_number, language)
VALUES ('27169458', 'en')
ON CONFLICT (phone_number) DO NOTHING;

