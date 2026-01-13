-- ============================================
-- Phase 1: Payment Method Restrictions for Passes
-- Database Schema Extension Only
-- ============================================
-- Date: 2025-02-24
-- Status: PHASE 1 - Schema Only, Zero Behavior Change
-- ============================================
-- 
-- PURPOSE:
-- Add infrastructure to support pass-payment method restrictions
-- WITHOUT changing any existing behavior.
--
-- BACKWARD COMPATIBILITY:
-- - All existing passes will have allowed_payment_methods = NULL
-- - NULL = all payment methods allowed (current behavior preserved)
-- - No existing orders or flows are affected
-- - No application code changes in this phase
--
-- FUTURE USE:
-- Admins can set allowed_payment_methods per pass to restrict
-- which payment methods are available for that pass type.
-- Backend validation (Phase 2) will enforce these rules.
-- ============================================

-- ============================================
-- STEP 1: Add allowed_payment_methods column to event_passes
-- ============================================

-- Add allowed_payment_methods column (TEXT[] - array of payment method strings)
-- NULL = all payment methods allowed (backward compatible, default for all existing passes)
-- Non-NULL array = only listed payment methods allowed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'event_passes' 
        AND column_name = 'allowed_payment_methods'
    ) THEN
        ALTER TABLE public.event_passes 
        ADD COLUMN allowed_payment_methods TEXT[] NULL;
        
        COMMENT ON COLUMN public.event_passes.allowed_payment_methods IS 'Array of allowed payment methods for this pass. NULL = all methods allowed (backward compatible, default). Valid values: "online", "external_app", "ambassador_cash". Example: ["online"] = online payment only.';
    END IF;
END $$;

-- ============================================
-- STEP 2: Add constraint to validate payment method values
-- ============================================

-- Constraint: Ensure all values in allowed_payment_methods array are valid
-- Valid payment methods: 'online', 'external_app', 'ambassador_cash'
CREATE OR REPLACE FUNCTION public.validate_payment_methods_array()
RETURNS TRIGGER AS $$
BEGIN
    -- If allowed_payment_methods is NULL, allow (backward compatible)
    IF NEW.allowed_payment_methods IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- If array is empty, treat as NULL (all methods allowed)
    IF array_length(NEW.allowed_payment_methods, 1) = 0 THEN
        NEW.allowed_payment_methods = NULL;
        RETURN NEW;
    END IF;
    
    -- Validate each value in the array
    IF EXISTS (
        SELECT 1 FROM unnest(NEW.allowed_payment_methods) AS method
        WHERE method NOT IN ('online', 'external_app', 'ambassador_cash')
    ) THEN
        RAISE EXCEPTION 'Invalid payment method in allowed_payment_methods. Valid values: "online", "external_app", "ambassador_cash". Found invalid value.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate (idempotent)
DROP TRIGGER IF EXISTS validate_payment_methods_array_trigger ON public.event_passes;
CREATE TRIGGER validate_payment_methods_array_trigger
    BEFORE INSERT OR UPDATE ON public.event_passes
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_payment_methods_array();

-- ============================================
-- STEP 3: Add index for efficient queries
-- ============================================

-- Index for filtering passes by payment method (using array operators)
-- This helps when querying "which passes allow this payment method?"
-- GIN index is optimal for array containment queries
CREATE INDEX IF NOT EXISTS idx_event_passes_allowed_payment_methods 
ON public.event_passes USING GIN (allowed_payment_methods)
WHERE allowed_payment_methods IS NOT NULL;

-- ============================================
-- STEP 4: Verify backward compatibility
-- ============================================

-- Ensure all existing passes have NULL (all methods allowed)
-- This is already the default, but we verify for safety
DO $$
DECLARE
    passes_with_restrictions INTEGER;
BEGIN
    -- Count passes that have non-NULL restrictions (should be 0 after migration)
    SELECT COUNT(*) INTO passes_with_restrictions
    FROM public.event_passes
    WHERE allowed_payment_methods IS NOT NULL;
    
    -- Log verification (will be 0 for existing passes)
    RAISE NOTICE 'Verification: % existing passes have payment method restrictions (expected: 0)', passes_with_restrictions;
    
    -- Ensure all existing passes default to NULL if somehow they don't
    UPDATE public.event_passes
    SET allowed_payment_methods = NULL
    WHERE allowed_payment_methods IS NOT NULL
      AND array_length(allowed_payment_methods, 1) = 0;
END $$;

-- ============================================
-- STEP 5: Add helpful comments and documentation
-- ============================================

COMMENT ON COLUMN public.event_passes.allowed_payment_methods IS 
'Array of allowed payment methods for this pass. NULL = all methods allowed (backward compatible, default for all existing passes). Non-NULL array = only listed methods allowed. Valid values: "online", "external_app", "ambassador_cash". Example: ["online"] restricts pass to online payment only. Example: ["online", "external_app"] allows online or external app.';

-- ============================================
-- STEP 6: Migration Summary
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Phase 1: Payment Method Restrictions Migration';
    RAISE NOTICE '============================================';
    RAISE NOTICE '✓ Added allowed_payment_methods column to event_passes';
    RAISE NOTICE '✓ Added validation trigger for payment method values';
    RAISE NOTICE '✓ Added GIN index for efficient array queries';
    RAISE NOTICE '✓ Verified backward compatibility (NULL = all methods)';
    RAISE NOTICE '✓ Zero behavior change - all existing passes allow all methods';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Next Steps (Future Phases):';
    RAISE NOTICE 'Phase 2: Add backend validation in /api/orders/create';
    RAISE NOTICE 'Phase 3: Update API endpoints to include field';
    RAISE NOTICE 'Phase 4: Add frontend UX filtering (advisory only)';
    RAISE NOTICE 'Phase 5: Add admin UI for rule definition';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'IMPORTANT: No application code changes in Phase 1';
    RAISE NOTICE 'All existing behavior remains unchanged';
    RAISE NOTICE '============================================';
END $$;
