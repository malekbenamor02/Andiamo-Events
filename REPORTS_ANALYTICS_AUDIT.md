# Reports & Analytics Page - Data Consistency Audit Report

**Date**: 2025-01-02  
**Scope**: Data connections, mathematical consistency, single source of truth verification  
**Status**: ⚠️ **PARTIAL CONSISTENCY ISSUES FOUND**

---

## Executive Summary

The Reports & Analytics page uses a **single source of truth** (`useAnalytics` hook) which is good, but has **critical data consistency issues**:

1. ❌ **Time Range Mismatch**: `salesOverTime` only shows last 30 days, but KPIs show all-time totals
2. ❌ **Hardcoded Trend Values**: All trend indicators are placeholder values (8.2%, 15.3%, etc.)
3. ❌ **Ambassador Conversion Rate**: Hardcoded to 85% for all ambassadors
4. ⚠️ **Revenue Sum Validation**: Channel breakdown total may not match total revenue if payment methods are missing
5. ⚠️ **Conversion Rate Definition**: Unclear if it's orders/orders or orders/visitors

---

## 1. Data Connections Verification

### ✅ **CONNECTED METRICS**

#### Total Tickets Sold
- **Source**: `useAnalytics.ts` line 88-137
- **Calculation**: Sum of `orderTickets` from all PAID orders
- **Consistency Check**:
  - ✅ Matches sum of `passPerformance[].ticketsSold` (same loop, line 124-129)
  - ✅ Matches sum of `ambassadorPerformance[].ticketsSold` (same loop, line 165)
  - ⚠️ **DOES NOT** match sum of `salesOverTime[].tickets` (only last 30 days, line 209-224)
  - ⚠️ **DOES NOT** match `averageTicketsPerDay * daysWithSales` if using all-time data

#### Total Revenue
- **Source**: `useAnalytics.ts` line 89-137
- **Calculation**: Sum of `orderRevenue` from all PAID orders
- **Consistency Check**:
  - ✅ Matches sum of `passPerformance[].revenue` (same loop, line 124-129)
  - ✅ Matches sum of `ambassadorPerformance[].revenue` (same loop, line 166)
  - ⚠️ **DOES NOT** match sum of `salesOverTime[].revenue` (only last 30 days, line 209-224)
  - ⚠️ **MAY NOT** match `channelBreakdown.total` if orders have unhandled payment methods (line 141-149)

#### Total Orders
- **Source**: `useAnalytics.ts` line 199
- **Calculation**: `ordersList.length` (PAID orders only)
- **Consistency Check**:
  - ✅ Matches number of orders used in all calculations (same `ordersList` array)
  - ✅ Consistent across all sections

#### Pass Performance
- **Source**: `useAnalytics.ts` line 91, 124-129, 230-234
- **Calculation**: Aggregated from `order_passes` during order processing
- **Consistency Check**:
  - ✅ Sum of `passPerformance[].ticketsSold` = `totalTicketsSold`
  - ✅ Sum of `passPerformance[].revenue` = `totalRevenue`
  - ✅ Sorted by revenue descending (line 234)

#### Ambassador Performance
- **Source**: `useAnalytics.ts` line 98-105, 151-169, 237-250
- **Calculation**: Aggregated by `ambassador_id` during order processing
- **Consistency Check**:
  - ✅ Sum of `ambassadorPerformance[].ticketsSold` = `totalTicketsSold` (for ambassador orders)
  - ✅ Sum of `ambassadorPerformance[].revenue` = subset of `totalRevenue` (only ambassador orders)
  - ⚠️ **INCONSISTENT**: `conversionRate` is hardcoded to 85% (line 240)

#### Sales Channel Breakdown
- **Source**: `useAnalytics.ts` line 92-97, 141-149
- **Calculation**: Revenue grouped by `payment_method`
- **Consistency Check**:
  - ⚠️ `channelBreakdown.total` = sum of online + ambassadorCash + manual
  - ⚠️ **MAY NOT** equal `totalRevenue` if orders have:
    - `null` payment_method
    - Payment methods not in enum (ONLINE, AMBASSADOR_CASH, EXTERNAL_APP)
  - ⚠️ Missing validation to ensure `channelBreakdown.total === totalRevenue`

---

### ❌ **HARDCODED / INCONSISTENT METRICS**

#### Trend Indicators (KPI Cards)
- **Location**: `KPICards.tsx` line 141-148
- **Status**: ❌ **HARDCODED PLACEHOLDER VALUES**
- **Values**:
  ```typescript
  const trends = {
    tickets: 8.2,      // Hardcoded
    revenue: 15.3,     // Hardcoded
    orders: 12.5,      // Hardcoded
    conversion: -2.1,  // Hardcoded
    avgTickets: 5.4,   // Hardcoded
    ambassadors: 10.0  // Hardcoded
  };
  ```
- **Impact**: Misleading users with fake trend data
- **Recommendation**: Calculate by comparing current period vs previous period

#### Ambassador Conversion Rate
- **Location**: `useAnalytics.ts` line 240
- **Status**: ❌ **HARDCODED TO 85%**
- **Code**: `const ambConversionRate = amb.ordersCount > 0 ? 85 : 0; // Placeholder`
- **Impact**: All ambassadors show same conversion rate regardless of actual performance
- **Recommendation**: Calculate actual conversion rate per ambassador (paid orders / total orders created)

---

### ⚠️ **PARTIALLY CONNECTED METRICS**

#### Sales Over Time
- **Source**: `useAnalytics.ts` line 209-227
- **Issue**: Only includes last 30 days (line 211-212)
- **Impact**: 
  - Sum of `salesOverTime[].tickets` ≠ `totalTicketsSold` (if sales > 30 days old)
  - Sum of `salesOverTime[].revenue` ≠ `totalRevenue` (if sales > 30 days old)
- **Recommendation**: 
  - Option A: Show all-time data in chart (remove 30-day filter)
  - Option B: Add date range selector and filter KPIs to match selected range
  - Option C: Add label "Last 30 Days" to chart and "All Time" to KPIs

#### Average Tickets Per Day
- **Source**: `useAnalytics.ts` line 204-207
- **Calculation**: `totalTicketsSold / daysWithSales`
- **Issue**: 
  - `daysWithSales` includes ALL dates with sales (all-time)
  - But `salesOverTime` only shows last 30 days
  - Inconsistent time ranges
- **Recommendation**: Use same time range as `salesOverTime` or document the difference

#### Conversion Rate
- **Source**: `useAnalytics.ts` line 188-202
- **Calculation**: `(totalOrdersPaid / totalOrdersCreated) * 100`
- **Issue**: 
  - Definition unclear: Is this orders/orders or orders/visitors?
  - Currently: PAID orders / ALL orders (including cancelled, pending)
  - Not a true "conversion rate" (typically visitors → purchasers)
- **Recommendation**: 
  - Document: "Order Completion Rate" or "Payment Success Rate"
  - OR: Track actual conversion (visitors/checkouts → orders) if data available

---

## 2. Single Source of Truth Verification

### ✅ **STRENGTHS**

1. **Single Hook**: All data comes from `useAnalytics(eventId)` hook
2. **Single Query**: One database query per event (line 63-79)
3. **Single Processing Loop**: All aggregations in one `forEach` (line 111-186)
4. **Shared Data Object**: All components receive same `analyticsData` object
5. **Event Filtering**: Consistent event filtering applied at query level (line 75-77)

### ⚠️ **ISSUES**

1. **Time Range Inconsistency**: 
   - KPIs use all-time data
   - Charts use last 30 days only
   - No shared time range constant

2. **Missing Validation**:
   - No checksum validation (e.g., `totalRevenue === sum(channelBreakdown)`)
   - No validation that all orders are counted exactly once

3. **Separate Query for Conversion Rate**:
   - Line 189-197: Second query to get all orders (not just PAID)
   - Could be optimized to single query with status filter

---

## 3. Consistency on Event Change

### ✅ **VERIFIED**

1. **Event Selection**: `selectedEventId` state triggers new query (line 33-39 in ReportsAnalytics.tsx)
2. **Query Key**: `['analytics', eventId]` ensures cache invalidation on event change (line 287)
3. **Animation Reset**: `animationKey` increments on event change (line 29-31)
4. **Data Propagation**: All components receive updated `analyticsData` from same hook

### ✅ **NO STALE DATA ISSUES**

- React Query handles cache invalidation
- All components re-render with new data
- No local state caching old values

---

## 4. Missing Safeguards

### ❌ **MISSING PROTECTIONS**

#### Division by Zero
- **Location**: `useAnalytics.ts` line 200-202, 207
- **Current**: Basic checks (`totalOrdersCreated > 0`, `daysWithSales > 0`)
- **Missing**: 
  - No check for `totalTicketsSold === 0` before division
  - No check for empty `salesByDate` map
  - No check for empty `passPerformanceMap`

#### Zero-State Handling
- **Status**: ⚠️ **PARTIAL**
- **Present**: 
  - Empty state in `PassPerformance.tsx` (line 44-57)
  - Empty state in `SalesChannelBreakdown.tsx` (line 41-54)
  - Empty state in `AmbassadorPerformance.tsx` (line 127-140)
- **Missing**:
  - No zero-state for `KPICards` (returns `null`, line 138)
  - No zero-state for `SalesOverTime` (shows empty chart)
  - No zero-state for `Insights` (returns `null`, line 76)

#### Partial Data Labels
- **Status**: ❌ **MISSING**
- **Issues**:
  - No label indicating "Last 30 Days" on charts
  - No label indicating "All Time" on KPIs
  - No indication when data is filtered by event vs all events
  - No indication when ambassador data excludes non-ambassador orders

#### Error States
- **Status**: ⚠️ **PARTIAL**
- **Present**: Loading states (skeleton loaders) in all components
- **Missing**: 
  - No error state handling in components
  - No error boundary for analytics hook failures
  - No retry mechanism on query failure

---

## 5. Mathematical Consistency Issues

### ❌ **CRITICAL ISSUES**

1. **Time Range Mismatch**:
   ```
   totalTicketsSold = sum(all-time orders)
   salesOverTime = sum(last 30 days only)
   ```
   **Result**: Sum of chart data ≠ KPI value

2. **Revenue Channel Validation**:
   ```typescript
   channelBreakdown.total = online + ambassadorCash + manual
   // But totalRevenue includes ALL orders, even if payment_method is null/unknown
   ```
   **Result**: May not match if unhandled payment methods exist

3. **Ambassador Tickets Sum**:
   ```typescript
   sum(ambassadorPerformance[].ticketsSold) ≤ totalTicketsSold
   // Only if ALL orders have ambassador_id
   ```
   **Result**: Ambassador sum is subset, not total (this is correct, but should be documented)

### ⚠️ **MINOR ISSUES**

1. **Best Selling Day**: Based on tickets, not revenue (line 253-254)
2. **Peak Sales Hour**: Based on tickets, not revenue (line 256-258)
3. **Top Performing Pass**: Based on revenue, not tickets (line 263)
   - **Recommendation**: Document the criteria for each insight

---

## 6. Recommendations (DO NOT IMPLEMENT YET)

### 🔴 **CRITICAL FIXES NEEDED**

1. **Fix Time Range Consistency**:
   - Add date range selector (All Time / Last 30 Days / Last 7 Days / Custom)
   - Filter all metrics by same date range
   - OR: Clearly label "All Time" vs "Last 30 Days" on each section

2. **Remove Hardcoded Trends**:
   - Calculate trends by comparing current period vs previous period
   - Store previous period data or calculate on-the-fly
   - Show "N/A" or hide trend if insufficient data

3. **Fix Ambassador Conversion Rate**:
   - Fetch all orders per ambassador (not just PAID)
   - Calculate: `(paidOrders / totalOrders) * 100`
   - Handle division by zero

4. **Add Revenue Validation**:
   ```typescript
   // After calculating channelBreakdown
   const unaccountedRevenue = totalRevenue - channelBreakdown.total;
   if (Math.abs(unaccountedRevenue) > 0.01) {
     console.warn('Revenue mismatch:', unaccountedRevenue);
     // Either add "Other" category or fix calculation
   }
   ```

5. **Add Zero-State Handling**:
   - Show friendly message when no data
   - Add "No sales yet" state for all components
   - Hide trend indicators when no previous period data

### 🟡 **IMPROVEMENTS SUGGESTED**

6. **Date Range Filter**:
   - Add custom date range picker
   - Filter all metrics consistently
   - Persist selection in URL params

7. **Comparison vs Previous Period**:
   - Show percentage change vs previous period
   - Add "vs Last Week/Month" toggle
   - Visual indicators (green/red arrows)

8. **Refunds / Canceled Orders Impact**:
   - Add refunded orders count
   - Show net revenue (gross - refunds)
   - Add cancellation rate metric

9. **Net Revenue vs Gross Revenue**:
   - Show both gross and net revenue
   - Calculate net = gross - refunds - fees
   - Add toggle to switch between views

10. **Export Functionality**:
    - Export to CSV (all metrics)
    - Export to PDF (formatted report)
    - Include date range in export filename

11. **Sales Velocity**:
    - Calculate tickets/hour
    - Show peak velocity period
    - Add velocity trend chart

12. **Forecast / Trend Projection**:
    - Simple linear regression for next 7 days
    - Show projected revenue/tickets
    - Add confidence interval

13. **Data Freshness Indicator**:
    - Show "Last updated: X minutes ago"
    - Add manual refresh button
    - Auto-refresh every 5 minutes

14. **Insight Criteria Documentation**:
    - Add tooltip explaining how each insight is calculated
    - Show "Based on tickets" vs "Based on revenue" labels
    - Add "Learn more" links

---

## 7. Summary Checklist

### ✅ **WORKING CORRECTLY**
- [x] Single source of truth (useAnalytics hook)
- [x] Event filtering works consistently
- [x] All components receive same data object
- [x] No stale data on event change
- [x] Loading states present
- [x] Basic zero-state handling (partial)

### ⚠️ **NEEDS ATTENTION**
- [ ] Time range consistency (KPIs vs charts)
- [ ] Revenue sum validation
- [ ] Zero-state for all components
- [ ] Error state handling
- [ ] Partial data labels

### ❌ **CRITICAL ISSUES**
- [ ] Hardcoded trend values (all fake)
- [ ] Hardcoded ambassador conversion rate (85%)
- [ ] Time range mismatch (all-time vs 30 days)
- [ ] Missing revenue validation checks

---

## 8. Proposed Data Flow Improvements

### Current Flow (Issues)
```
useAnalytics(eventId)
  ├─ Fetch PAID orders (all-time)
  ├─ Calculate KPIs (all-time)
  ├─ Calculate salesOverTime (last 30 days only) ❌
  ├─ Calculate passPerformance (all-time)
  ├─ Calculate channelBreakdown (all-time)
  └─ Calculate insights (all-time)
```

### Proposed Flow (Fixed)
```
useAnalytics(eventId, dateRange)
  ├─ Fetch PAID orders (filtered by dateRange)
  ├─ Calculate KPIs (filtered by dateRange)
  ├─ Calculate salesOverTime (filtered by dateRange) ✅
  ├─ Calculate passPerformance (filtered by dateRange)
  ├─ Calculate channelBreakdown (filtered by dateRange)
  ├─ Validate: totalRevenue === sum(channelBreakdown) ✅
  ├─ Validate: totalTicketsSold === sum(passPerformance) ✅
  ├─ Calculate insights (filtered by dateRange)
  └─ Calculate trends (compare vs previous period) ✅
```

---

## 9. Testing Recommendations

1. **Unit Tests**:
   - Test `fetchAnalyticsData` with various order sets
   - Verify mathematical consistency (sums match)
   - Test edge cases (zero orders, single order, etc.)

2. **Integration Tests**:
   - Test event switching (data updates correctly)
   - Test date range filtering (all metrics update)
   - Test zero-state rendering

3. **Data Validation Tests**:
   - Verify `totalRevenue === sum(channelBreakdown)`
   - Verify `totalTicketsSold === sum(passPerformance)`
   - Verify `totalTicketsSold === sum(ambassadorPerformance)` (for ambassador orders only)

---

**End of Audit Report**
