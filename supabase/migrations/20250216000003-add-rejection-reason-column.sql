-- Migration: Add rejection_reason column to orders table
-- This column stores the reason why an order was rejected by admin

-- Add rejection_reason column if it doesn't exist
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN public.orders.rejection_reason IS 
  'Reason for order rejection (required when admin rejects a PENDING_ADMIN_APPROVAL order)';

