-- Fix qr_tickets.ticket_status constraint to use scan statuses instead of delivery statuses
-- This fixes the blocking bug where inserts fail silently due to constraint mismatch

-- Drop the existing constraint if it exists
ALTER TABLE public.qr_tickets 
  DROP CONSTRAINT IF EXISTS qr_tickets_ticket_status_check;

-- Add new constraint with scan status values
ALTER TABLE public.qr_tickets 
  ADD CONSTRAINT qr_tickets_ticket_status_check 
  CHECK (ticket_status IN ('VALID', 'USED', 'INVALID', 'WRONG_EVENT', 'EXPIRED'));

-- Set default value to VALID for new inserts
ALTER TABLE public.qr_tickets 
  ALTER COLUMN ticket_status SET DEFAULT 'VALID';

-- Update existing records to VALID (if any exist with old statuses)
UPDATE public.qr_tickets 
SET ticket_status = 'VALID' 
WHERE ticket_status NOT IN ('VALID', 'USED', 'INVALID', 'WRONG_EVENT', 'EXPIRED');

-- Add comment for documentation
COMMENT ON COLUMN public.qr_tickets.ticket_status IS 'Scan status of the ticket. VALID = ready for scanning, USED = already scanned, INVALID = invalid ticket, WRONG_EVENT = scanned at wrong event, EXPIRED = past event date.';
