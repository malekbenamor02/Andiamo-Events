-- Remove round-robin assignment infrastructure
-- Drops round_robin_tracker table and assign_order_to_ambassador function
-- Users now select ambassadors manually
-- 
-- IMPORTANT: This ONLY removes round_robin_tracker table
-- round_robin_settings table is DIFFERENT and is NOT affected (left intact)

-- Step 1: Drop the assign_order_to_ambassador function (if it exists)
DROP FUNCTION IF EXISTS public.assign_order_to_ambassador(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.assign_order_to_ambassador(text, text) CASCADE; -- Alternative signature

-- Step 2: Drop round_robin_tracker table (and related objects)
-- NOTE: round_robin_settings is a DIFFERENT table and is NOT dropped
DROP TABLE IF EXISTS public.round_robin_tracker CASCADE;

-- Step 3: Drop get_next_ambassador_for_ville function if it exists
DROP FUNCTION IF EXISTS public.get_next_ambassador_for_ville(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_next_ambassador_for_ville(text) CASCADE; -- Alternative signature

-- Note: This migration removes automatic assignment logic.
-- Orders with payment_method = 'ambassador_cash' will have ambassador_id set
-- directly by user selection during order creation.
-- 
-- round_robin_settings table remains intact (it's a different table for settings, not tracking)

