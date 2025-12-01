-- Fix orders status constraint to allow all actual status values
-- Based on the actual database, status values include uppercase versions and additional values

-- Drop the existing constraint if it exists
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add a new constraint that allows all the status values actually used in the database
-- Including both lowercase and uppercase versions, and additional statuses
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN (
    -- Lowercase versions (from original migration)
    'pending_ambassador',
    'assigned',
    'accepted',
    'cancelled',
    'completed',
    'refunded',
    'fraud_flagged',
    -- Uppercase versions (from actual database)
    'PENDING_AMBASSADOR',
    'ASSIGNED',
    'ACCEPTED',
    'CANCELLED',
    'CANCELLED_BY_AMBASSADOR',
    'COMPLETED',
    'REFUNDED',
    'FRAUD_FLAGGED',
    'PAID'
  ));

-- Update any existing lowercase statuses to uppercase for consistency
-- (Optional - you can comment this out if you want to keep lowercase)
UPDATE public.orders 
SET status = UPPER(status)
WHERE status IN (
  'pending_ambassador',
  'assigned',
  'accepted',
  'cancelled',
  'completed',
  'refunded',
  'fraud_flagged'
);



