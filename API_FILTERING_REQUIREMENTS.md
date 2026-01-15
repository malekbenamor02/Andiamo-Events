# API Filtering Requirements for REMOVED_BY_ADMIN Orders

## Overview
All filtering of `REMOVED_BY_ADMIN` orders must be done in API endpoints, NOT in frontend code. Frontend should not trust or filter data.

## Current Status

### ✅ API Endpoints with Filtering (Backend)
1. **`/api/admin/ambassador-sales/overview`** (server.cjs:4890)
   - ✅ Filters out `REMOVED_BY_ADMIN` orders
   - Used for: Sales overview and performance metrics

2. **`/api/admin/ambassador-sales/orders`** (server.cjs:4980)
   - ✅ Filters out `REMOVED_BY_ADMIN` orders by default
   - ✅ Only shows removed orders when `status=REMOVED_BY_ADMIN` is explicitly requested
   - Used for: Admin order list with filters

3. **`/api/admin-remove-order`** (api/misc.js:2694)
   - ✅ Prevents removal of PAID orders
   - ✅ Sets status to `REMOVED_BY_ADMIN`

### ⚠️ Direct Supabase Queries (Need API Endpoints)

The following locations use direct Supabase queries and should be migrated to API endpoints:

1. **`src/pages/ambassador/Dashboard.tsx`**
   - `fetchData()` - Fetches new orders and history orders
   - `fetchPerformance()` - Fetches orders for performance calculations
   - **Action Required**: Create API endpoints:
     - `/api/ambassador/orders` - Get ambassador's orders (excludes REMOVED_BY_ADMIN)
     - `/api/ambassador/performance` - Get ambassador performance (excludes REMOVED_BY_ADMIN)

2. **`src/pages/admin/Dashboard.tsx`**
   - `fetchAmbassadorSalesData()` - Fetches COD ambassador orders
   - `fetchOnlineOrders()` - Fetches online orders
   - **Action Required**: These should use existing API endpoints:
     - Use `/api/admin/ambassador-sales/orders` instead of direct query
     - Create `/api/admin/online-orders` endpoint if needed

3. **`src/lib/ambassadors/ambassadorSalesService.ts`**
   - `getSalesOverview()` - Direct Supabase query
   - `getSalesAnalytics()` - Direct Supabase query
   - **Action Required**: Use `/api/admin/ambassador-sales/overview` API endpoint

4. **`src/lib/ambassadorOrders.ts`**
   - `fetchAmbassadorSalesData()` - Direct Supabase query
   - **Action Required**: Use API endpoints instead

## Filtering Rules

### Default Behavior
- **All API endpoints that fetch orders MUST exclude `REMOVED_BY_ADMIN` orders by default**
- Exception: When explicitly filtering by `status=REMOVED_BY_ADMIN`, show only removed orders

### Implementation Pattern
```javascript
// In API endpoint (server.cjs or api/*.js)
let query = supabase
  .from('orders')
  .select('*')
  .eq('payment_method', 'ambassador_cash');

// Exclude REMOVED_BY_ADMIN by default
if (status === 'REMOVED_BY_ADMIN') {
  query = query.eq('status', 'REMOVED_BY_ADMIN');
} else {
  query = query.neq('status', 'REMOVED_BY_ADMIN');
  if (status) {
    query = query.eq('status', status);
  }
}
```

## Migration Priority

1. **High Priority**: Ambassador dashboard queries (affects sales reports)
2. **Medium Priority**: Admin dashboard direct queries (can use existing APIs)
3. **Low Priority**: Service layer queries (should use existing APIs)

## Notes

- Frontend filtering is NOT trusted - all filtering must be in API
- Removed orders should only appear when explicitly filtering by `REMOVED_BY_ADMIN` status
- Removed orders should NOT appear in:
  - Sales reports
  - Revenue calculations
  - Performance metrics
  - Ambassador dashboards
  - Default order lists
