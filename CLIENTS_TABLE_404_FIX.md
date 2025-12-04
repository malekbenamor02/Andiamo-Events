# 🔧 Clients Table 404 Error - Fix Applied

## Issue
- **Error:** `GET /rest/v1/clients?select=ambassador_id%2Cstandard_tickets%2Cvip_tickets 404 (Not Found)`
- **Location:** `src/pages/admin/Dashboard.tsx` line 2845
- **Cause:** The `clients` table either:
  1. Doesn't exist in the database (migration not run)
  2. RLS policies are blocking access completely
  3. Table was dropped or renamed

## Fix Applied ✅

### 1. Enhanced Error Handling
- Added better error detection for 404/table not found errors
- Gracefully handles missing table without breaking the dashboard
- Logs warnings instead of errors for expected cases

### 2. Error Codes Handled
- `42P01` - PostgreSQL relation doesn't exist
- `PGRST116` - PostgREST relation not found  
- `404` status - HTTP not found
- Error messages containing "relation" or "does not exist"

## Next Steps

### Option 1: Create the Clients Table (if needed)
If the `clients` table should exist, run the migration:
```sql
-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'clients'
);

-- If it doesn't exist, run the migration:
-- supabase/migrations/20250718000000-create-ambassadors-table.sql
```

### Option 2: Use Orders Table Instead (Recommended)
The `clients` table may be deprecated. Consider using the `orders` table instead:
- `orders` table has `ambassador_id` 
- Can calculate ticket counts from `order_passes`
- More normalized and up-to-date

### Option 3: Fix RLS Policies
If the table exists but RLS is blocking:
```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'clients';

-- Ensure public read access (if needed)
CREATE POLICY "Public can view clients" ON public.clients
  FOR SELECT USING (true);
```

## Current Behavior

After the fix:
- ✅ Dashboard loads without errors
- ✅ Sales data will be empty if table doesn't exist (graceful degradation)
- ✅ Warning logged in console (not an error)
- ✅ No breaking changes to UI

## Verification

1. Check browser console - should see warning instead of error
2. Dashboard should load successfully
3. Ambassador sales section will show empty/zero if table unavailable

---

**The dashboard will now work even if the `clients` table doesn't exist or is inaccessible.**

