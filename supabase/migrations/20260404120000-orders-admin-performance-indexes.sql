-- Performance indexes for admin Online Orders tab and Ambassador Sales (COD) API.
-- Matches common filters: source/payment_method, exclude REMOVED_BY_ADMIN, ORDER BY created_at DESC,
-- optional event_id / ambassador_id / city / date range.
--
-- Partial indexes keep the working set small and speed up nested order_passes loads (fewer parent rows scanned).

-- ---------------------------------------------------------------------------
-- Online orders (Dashboard: source = platform_online, status <> REMOVED_BY_ADMIN)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_online_active_created_desc
  ON public.orders (created_at DESC)
  WHERE source = 'platform_online'
    AND status IS DISTINCT FROM 'REMOVED_BY_ADMIN';

CREATE INDEX IF NOT EXISTS idx_orders_online_active_event_created_desc
  ON public.orders (event_id, created_at DESC)
  WHERE source = 'platform_online'
    AND status IS DISTINCT FROM 'REMOVED_BY_ADMIN';

-- Optional city filter (online tab)
CREATE INDEX IF NOT EXISTS idx_orders_online_active_city_created_desc
  ON public.orders (city, created_at DESC)
  WHERE source = 'platform_online'
    AND status IS DISTINCT FROM 'REMOVED_BY_ADMIN'
    AND city IS NOT NULL;

-- Payment status slice (pending / failed filters on online tab)
CREATE INDEX IF NOT EXISTS idx_orders_online_active_payment_status_created_desc
  ON public.orders (payment_status, created_at DESC)
  WHERE source = 'platform_online'
    AND status IS DISTINCT FROM 'REMOVED_BY_ADMIN';

-- ---------------------------------------------------------------------------
-- Ambassador COD orders (API: payment_method = ambassador_cash, status handling)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_ambassador_cash_active_created_desc
  ON public.orders (created_at DESC)
  WHERE payment_method = 'ambassador_cash'
    AND status IS DISTINCT FROM 'REMOVED_BY_ADMIN';

CREATE INDEX IF NOT EXISTS idx_orders_ambassador_cash_active_event_created_desc
  ON public.orders (event_id, created_at DESC)
  WHERE payment_method = 'ambassador_cash'
    AND status IS DISTINCT FROM 'REMOVED_BY_ADMIN';

CREATE INDEX IF NOT EXISTS idx_orders_ambassador_cash_active_ambassador_created_desc
  ON public.orders (ambassador_id, created_at DESC)
  WHERE payment_method = 'ambassador_cash'
    AND status IS DISTINCT FROM 'REMOVED_BY_ADMIN'
    AND ambassador_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_ambassador_cash_active_city_created_desc
  ON public.orders (city, created_at DESC)
  WHERE payment_method = 'ambassador_cash'
    AND status IS DISTINCT FROM 'REMOVED_BY_ADMIN'
    AND city IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_ambassador_cash_active_ville_created_desc
  ON public.orders (ville, created_at DESC)
  WHERE payment_method = 'ambassador_cash'
    AND status IS DISTINCT FROM 'REMOVED_BY_ADMIN'
    AND ville IS NOT NULL;

-- Explicit "removed only" admin view (rare; keeps bitmap alternative cheap)
CREATE INDEX IF NOT EXISTS idx_orders_ambassador_cash_removed_created_desc
  ON public.orders (created_at DESC)
  WHERE payment_method = 'ambassador_cash'
    AND status = 'REMOVED_BY_ADMIN';

-- ---------------------------------------------------------------------------
-- Ambassador app: list by ambassador_id, newest first (server.cjs / misc.js)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_ambassador_id_created_desc
  ON public.orders (ambassador_id, created_at DESC)
  WHERE ambassador_id IS NOT NULL
    AND status IS DISTINCT FROM 'REMOVED_BY_ADMIN';

-- ---------------------------------------------------------------------------
-- Order logs feed (Ambassador Sales tab loads recent logs)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_order_logs_created_at_desc
  ON public.order_logs (created_at DESC);

COMMENT ON INDEX idx_orders_online_active_created_desc IS
  'Admin online orders list: platform_online, not removed, sort by created_at.';
COMMENT ON INDEX idx_orders_ambassador_cash_active_created_desc IS
  'Admin ambassador-sales API: ambassador_cash, not removed, sort by created_at.';
