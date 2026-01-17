# Stock Calculation Fix - Summary

## ✅ What Was Fixed

1. **Created Migration**: `20250301000000-fix-sold-quantity-exclude-removed-orders.sql`
   - Recalculates `sold_quantity` correctly
   - Excludes `REMOVED_BY_ADMIN`, `REJECTED`, and `CANCELLED` orders
   - Only counts orders that represent actual sold/reserved stock

2. **Created Verification Function**: `verify_stock_calculations()`
   - Tests if stock calculations are correct
   - Shows any discrepancies
   - Can be run anytime to verify accuracy

3. **Created Documentation**:
   - `STOCK_FIX_INSTRUCTIONS.md` - Step-by-step instructions
   - `STOCK_VERIFICATION_TEST.md` - Detailed test queries

## 📋 What You Need to Do

### 1. Run the Migration

**Option A: Using Supabase CLI**
```bash
cd your-project-directory
supabase migration up
```

**Option B: Using Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Click on "SQL Editor"
3. Open the file: `supabase/migrations/20250301000000-fix-sold-quantity-exclude-removed-orders.sql`
4. Copy all contents
5. Paste into SQL Editor
6. Click "Run"

### 2. Verify the Fix

After migration completes, run this in SQL Editor:

```sql
SELECT * FROM verify_stock_calculations();
```

**Expected**: All rows should show `discrepancy = 0`

### 3. Check Zone B Pass Specifically

```sql
SELECT 
    ep.name as pass_name,
    ep.max_quantity,
    ep.sold_quantity,
    ep.max_quantity - ep.sold_quantity as remaining
FROM event_passes ep
WHERE ep.name LIKE '%Zone B%';
```

**Expected Results:**
- `max_quantity`: 32
- `sold_quantity`: 29 (17 PAID + 12 PENDING_CASH)
- `remaining`: 3

### 4. Verify in Application

Check these views - numbers should now match:

| View | Expected Count | Status |
|------|---------------|--------|
| Pass Stock (Zone B) | 32 max, 29 sold, 3 remaining | ✅ |
| Ticket Management | 17 passes sold | ✅ |
| Ambassadors Sales - Paid | 17 passes | ✅ |
| Ambassadors Sales - Pending Cash | 12 passes | ✅ |
| Ambassadors Sales - Removed | 7 passes (excluded from stock) | ✅ |

## 🔍 How to Test

### Quick Test
```sql
SELECT * FROM verify_stock_calculations();
```

### Detailed Test (Zone B)
See `STOCK_VERIFICATION_TEST.md` for comprehensive test queries.

### Test Checklist
- [ ] Migration runs without errors
- [ ] `verify_stock_calculations()` shows no discrepancies
- [ ] Zone B shows: max=32, sold=29, remaining=3
- [ ] All application views show correct numbers

## 🐛 If Issues Occur

1. **Check for discrepancies**:
   ```sql
   SELECT * FROM verify_stock_calculations() WHERE discrepancy != 0;
   ```

2. **Check REMOVED_BY_ADMIN orders**:
   ```sql
   SELECT id, status, stock_released 
   FROM orders 
   WHERE status = 'REMOVED_BY_ADMIN' AND stock_released = false;
   ```

3. **See detailed instructions**: `STOCK_FIX_INSTRUCTIONS.md`

## 📊 Expected Results

### Before Fix ❌
- sold_quantity: 36 (included REMOVED_BY_ADMIN)
- Max stock: 32
- **Problem**: Exceeds max stock!

### After Fix ✅
- sold_quantity: 29 (17 PAID + 12 PENDING_CASH)
- REMOVED_BY_ADMIN: 7 (excluded from stock)
- Max stock: 32
- Remaining: 3
- **Result**: All numbers match! ✅

## 📝 Files Created

1. `supabase/migrations/20250301000000-fix-sold-quantity-exclude-removed-orders.sql` - The fix
2. `STOCK_FIX_INSTRUCTIONS.md` - Detailed instructions
3. `STOCK_VERIFICATION_TEST.md` - Test queries
4. `STOCK_FIX_SUMMARY.md` - This file

## ⚠️ Important Notes

- The migration is **idempotent** (safe to run multiple times)
- The fix applies to **all pass types** (including order type passes)
- Future orders will automatically follow correct calculation rules
- The verification function can be run anytime to check accuracy

## ✅ Success Criteria

After running the migration, you should see:
1. ✅ No discrepancies in `verify_stock_calculations()`
2. ✅ Zone B pass shows correct numbers (32 max, 29 sold, 3 remaining)
3. ✅ All application views show matching numbers
4. ✅ REMOVED_BY_ADMIN orders are excluded from stock counts

---

**Next Steps**: Run the migration, then verify using the test queries above.
