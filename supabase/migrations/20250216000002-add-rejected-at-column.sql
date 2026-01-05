-- Migration: Add rejected_at column to orders table
-- This column tracks when an order was rejected by admin (for PENDING_ADMIN_APPROVAL -> REJECTED flow)

-- Add rejected_at column if it doesn't exist
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;

-- Add comment explaining the column
COMMENT ON COLUMN public.orders.rejected_at IS 
  'Timestamp when order was rejected by admin (changes status from PENDING_ADMIN_APPROVAL to REJECTED)';

