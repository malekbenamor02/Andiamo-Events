-- Migration: Add approved_at column to orders table
-- This column tracks when an order was approved by admin (for PENDING_ADMIN_APPROVAL -> PAID flow)

-- Add approved_at column if it doesn't exist
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- Add comment explaining the column
COMMENT ON COLUMN public.orders.approved_at IS 
  'Timestamp when order was approved by admin (changes status from PENDING_ADMIN_APPROVAL to PAID)';

