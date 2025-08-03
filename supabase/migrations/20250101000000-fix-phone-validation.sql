-- Fix phone number validation for clients table
-- Tunisian phone numbers should be exactly 8 digits and start with 2, 5, 9, or 4

-- First, let's clean up existing invalid phone numbers
UPDATE clients 
SET phone = REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL;

-- Remove leading country code if present
UPDATE clients 
SET phone = SUBSTRING(phone FROM 4)
WHERE phone LIKE '+216%';

-- Remove leading zeros
UPDATE clients 
SET phone = LTRIM(phone, '0')
WHERE phone IS NOT NULL;

-- Now add the constraint
ALTER TABLE clients 
ADD CONSTRAINT valid_tunisian_phone 
CHECK (
  phone ~ '^[2594][0-9]{7}$'
);

-- Add a comment to document the phone format
COMMENT ON COLUMN clients.phone IS 'Tunisian phone number: 8 digits starting with 2, 5, 9, or 4';

-- Also fix the ambassadors table phone validation
UPDATE ambassadors 
SET phone = REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL;

UPDATE ambassadors 
SET phone = SUBSTRING(phone FROM 4)
WHERE phone LIKE '+216%';

UPDATE ambassadors 
SET phone = LTRIM(phone, '0')
WHERE phone IS NOT NULL;

ALTER TABLE ambassadors 
ADD CONSTRAINT valid_ambassador_phone 
CHECK (
  phone ~ '^[2594][0-9]{7}$'
);

COMMENT ON COLUMN ambassadors.phone IS 'Tunisian phone number: 8 digits starting with 2, 5, 9, or 4'; 