# Pass Stock Summary Queries

This directory contains SQL queries to get comprehensive stock calculations and summaries for all passes.

## 📊 Available Queries

### 1. `PASS_STOCK_COMPLETE_VIEW.sql` ⭐ **RECOMMENDED**
**Single comprehensive query showing everything in one result set**

**What it shows:**
- All passes with max stock, current sold, and available stock
- Breakdown by order status (active, pending, excluded)
- Discrepancy check (calculated vs stored)
- Stock release status
- Stock status indicators (Sold Out, Almost Sold Out, etc.)

**Best for:** Quick overview of all passes with full details

**Usage:**
```sql
-- Copy and paste the entire query into Supabase SQL Editor
-- Run it to see all passes with complete breakdown
```

---

### 2. `FULL_PASS_STOCK_SUMMARY.sql`
**Multiple summary queries for different views**

**Contains 6 different summaries:**
1. **Summary 1**: All Passes with Stock Overview (basic info)
2. **Summary 2**: Detailed Breakdown by Order Status (most detailed)
3. **Summary 3**: Order Status Summary (all passes combined)
4. **Summary 4**: Verification Check (discrepancies only)
5. **Summary 5**: Problematic Orders Check (orders that need stock release)
6. **Summary 6**: Event-Level Summary (aggregated by event)

**Best for:** Detailed analysis and troubleshooting

**Usage:**
```sql
-- Run each summary separately, or run all at once
-- Each summary provides different insights
```

---

## 🎯 Quick Start

### For a Complete Overview:
Run `PASS_STOCK_COMPLETE_VIEW.sql` - This gives you everything in one table.

### For Detailed Analysis:
Run `FULL_PASS_STOCK_SUMMARY.sql` - Run each summary to see different perspectives.

---

## 📋 What Each Column Means

### Stock Information:
- **max_stock**: Maximum available passes
- **current_sold**: Currently stored `sold_quantity` value
- **calculated_sold**: What `sold_quantity` should be (based on orders)
- **available_stock**: `max_stock - current_sold`
- **sold_percentage**: Percentage of stock sold
- **discrepancy**: Difference between `current_sold` and `calculated_sold` (should be 0)

### Order Breakdown:
- **active_orders**: PAID, COMPLETED, MANUAL_COMPLETED orders
- **pending_orders**: PENDING_CASH, PENDING_ONLINE, etc. (where stock not released)
- **total_counted**: Sum of active + pending (what's included in `sold_quantity`)

### Excluded Orders (NOT counted in sold_quantity):
- **removed_by_admin**: REMOVED_BY_ADMIN orders
- **rejected**: REJECTED orders
- **cancelled**: CANCELLED orders
- **cancelled_by_ambassador**: CANCELLED_BY_AMBASSADOR orders
- **cancelled_by_admin**: CANCELLED_BY_ADMIN orders
- **refunded**: REFUNDED orders
- **total_excluded**: Sum of all excluded orders

### Stock Release Status:
- **stock_released**: Total passes where stock has been released
- **stock_reserved**: Total passes where stock is still reserved

---

## ✅ Expected Results

### For Zone B (from your original issue):
- **max_stock**: 32
- **current_sold**: 29 (17 PAID + 12 PENDING_CASH)
- **calculated_sold**: 29 (should match)
- **discrepancy**: 0 ✅
- **removed_by_admin**: 7 (excluded from sold_quantity)
- **available_stock**: 3

### Verification:
- All passes should show `discrepancy = 0`
- All excluded orders should have `stock_released = true`
- `current_sold` should equal `calculated_sold`

---

## 🔍 Troubleshooting

### If you see discrepancies:
1. Check Summary 5 in `FULL_PASS_STOCK_SUMMARY.sql` for problematic orders
2. Run the fix migration: `20250301000001-fix-missing-stock-releases.sql`
3. Recalculate: `20250301000000-fix-sold-quantity-exclude-removed-orders.sql`

### If stock counts don't match:
1. Verify all excluded orders have `stock_released = true`
2. Check that pending orders have `stock_released = false`
3. Run the verification function: `SELECT * FROM verify_stock_calculations();`

---

## 📝 Notes

- All queries are read-only (safe to run)
- Results are based on current database state
- `calculated_sold` is computed from orders, `current_sold` is stored in `event_passes.sold_quantity`
- They should always match if the system is working correctly
