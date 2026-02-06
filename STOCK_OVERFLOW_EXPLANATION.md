# Stock Overflow Issue - Constraint Violation

## The Problem

**Zone B has a constraint violation:**
- `max_quantity` = 35
- Calculated `sold_quantity` = 37
- **Difference: +2 tickets OVER the limit**

The database constraint `event_passes_stock_check` prevents `sold_quantity` from exceeding `max_quantity`, so the recalculation fails.

## Why This Happened

This is a **data integrity issue** - more orders were created than the stock limit allows. Possible causes:

1. **Stock check failed during order creation** - Orders were allowed even when stock was insufficient
2. **max_quantity was reduced after orders were placed** - Someone lowered the max stock after orders were already created
3. **Race condition** - Multiple orders created simultaneously, both passed stock check
4. **Manual order creation** - Orders created directly in database bypassing stock validation
5. **Stock calculation bug** - Previous calculation was wrong, allowing over-selling

## The Constraint

```sql
CHECK (max_quantity IS NULL OR sold_quantity <= max_quantity)
```

This constraint ensures data integrity - you cannot have more sold tickets than your maximum stock.

## Impact

- **Cannot recalculate `sold_quantity`** - The constraint blocks the update
- **Stored value is out of sync** - Current stored value (35) doesn't match calculated (37)
- **Stock display is incorrect** - Shows wrong available stock

## Solutions (Choose One)

### Option 1: Increase max_quantity (Recommended if you want to honor all orders)
```sql
UPDATE public.event_passes 
SET max_quantity = 37 
WHERE id = 'c3b76e76-5481-466e-89e3-b44815d018f4';
```
Then run the recalculation.

### Option 2: Reject/Cancel some orders to bring it under limit
- Find the 2 most recent PENDING_CASH orders
- Reject them (this will release their stock)
- Then run recalculation

### Option 3: Release stock from some orders
- Find orders that should have stock released
- Set `stock_released = true` for those orders
- Then run recalculation

### Option 4: Temporarily disable constraint, recalculate, then re-enable
**⚠️ NOT RECOMMENDED** - This could cause other data integrity issues.

## Diagnostic Queries

I've created `STOCK_OVERFLOW_ANALYSIS.sql` with queries to:
1. Identify all passes with overflow issues
2. Show which specific orders caused the overflow
3. Show the exact order that pushed it over the limit
4. Provide a summary with recommended actions

## Next Steps

1. **Run Query 3 from `STOCK_OVERFLOW_ANALYSIS.sql`** to see which order caused the overflow
2. **Decide on a solution** (increase max_quantity, reject orders, or release stock)
3. **Apply the fix**
4. **Run the recalculation** to sync `sold_quantity`

## For Zone A & C

- **Zone A**: No overflow (calculated 51, max 50) - but still has sync issue
- **Zone C**: No overflow (calculated 83, max 87) - has sync issue (+4 stored vs calculated)

Zone A also needs attention - it's at 51/50, which means it's also over the limit by 1.
