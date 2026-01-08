-- SECURITY FIX: Remove dangerous RLS policy that allows ambassadors to create orders
-- This policy was vulnerable because it didn't verify the logged-in ambassador
-- matches the ambassador_id being set, allowing order manipulation.

-- Drop the vulnerable policy
DROP POLICY IF EXISTS "Ambassadors can create manual orders" ON public.orders;

-- Note: Ambassadors should NOT be able to create orders directly.
-- If order creation is needed in the future, it must be done through:
-- 1. A secure server-side API endpoint with proper authentication
-- 2. Admin panel (for admin-created orders)
-- 3. Public order flow (for customer-created orders)

-- Ambassadors can still:
-- - View their own orders (SELECT policy remains)
-- - Update their own orders (UPDATE policy remains)
-- - View order logs for their orders (SELECT policy remains)

-- They CANNOT:
-- - Create new orders (INSERT policy removed)
-- - Create orders on behalf of other ambassadors
-- - Manipulate order data through direct database access
