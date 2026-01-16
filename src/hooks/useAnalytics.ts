/**
 * Analytics Hook
 * Fetches and processes analytics data for Reports & Analytics page
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Order, OrderPass } from '@/types/orders';
import { OrderStatus, PaymentMethod } from '@/lib/constants/orderStatuses';

export type DateRange = 'ALL_TIME' | 'LAST_30_DAYS' | 'LAST_7_DAYS';

export interface AnalyticsData {
  // KPIs
  pendingCashAndApprovalOrders: number; // Number of orders with PENDING_CASH or PENDING_ADMIN_APPROVAL status
  pendingCashAndApprovalPasses: number; // Number of passes in pending cash and approval orders
  pendingCashAndApprovalRevenue: number; // Revenue from pending cash and approval orders
  totalTicketsSold: number;
  totalRevenue: number;
  totalOrders: number;
  orderCompletionRate: number; // Renamed from conversionRate for clarity
  averageTicketsPerDay: number;
  ambassadorsInvolved: number;
  
  // Trends (calculated vs previous period)
  trends: {
    tickets: number | null;
    revenue: number | null;
    orders: number | null;
    completionRate: number | null;
    avgTickets: number | null;
    ambassadors: number | null;
  };
  
  // Sales over time
  salesOverTime: Array<{
    date: string;
    tickets: number;
    revenue: number;
  }>;
  
  // Pass performance
  passPerformance: Array<{
    passName: string;
    ticketsSold: number;
    revenue: number;
  }>;
  
  // Sales channel breakdown
  channelBreakdown: {
    online: number;
    ambassadorCash: number;
    manual: number;
    other: number; // Unclassified payment methods
    total: number;
  };
  
  // Ambassador performance
  ambassadorPerformance: Array<{
    ambassadorId: string;
    ambassadorName: string;
    ordersCount: number;
    ticketsSold: number;
    revenue: number;
    conversionRate: number; // Calculated: paidOrders / totalOrdersCreated
  }>;
  
  // Insights
  insights: {
    bestSellingDay: string; // Based on tickets sold
    peakSalesHour: string; // Based on tickets sold
    lowestSalesPeriod: string; // Based on tickets sold
    highestPerformingPass: string; // Based on revenue
  };
  
  // Metadata
  dateRange: DateRange;
  dateRangeLabel: string;
}

function getDateRangeFilter(dateRange: DateRange): { startDate: Date | null; endDate: Date | null } {
  const now = new Date();
  now.setHours(23, 59, 59, 999); // End of today
  
  switch (dateRange) {
    case 'LAST_7_DAYS':
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      return { startDate: sevenDaysAgo, endDate: now };
    case 'LAST_30_DAYS':
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);
      return { startDate: thirtyDaysAgo, endDate: now };
    case 'ALL_TIME':
    default:
      return { startDate: null, endDate: null };
  }
}

/**
 * Calculate previous period date range for trend comparison
 * Returns the same-length period immediately before the current period
 */
function getPreviousPeriodDateRange(dateRange: DateRange): { startDate: Date | null; endDate: Date | null } | null {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  
  switch (dateRange) {
    case 'LAST_7_DAYS':
      // Previous 7 days: 14 days ago to 7 days ago (exclusive of current period start)
      const sevenDaysAgoStart = new Date(now);
      sevenDaysAgoStart.setDate(now.getDate() - 7);
      sevenDaysAgoStart.setHours(0, 0, 0, 0);
      
      // End of previous period: 1 millisecond before current period starts
      const previousPeriodEnd = new Date(sevenDaysAgoStart);
      previousPeriodEnd.setMilliseconds(previousPeriodEnd.getMilliseconds() - 1);
      
      const fourteenDaysAgo = new Date(now);
      fourteenDaysAgo.setDate(now.getDate() - 14);
      fourteenDaysAgo.setHours(0, 0, 0, 0);
      
      return { startDate: fourteenDaysAgo, endDate: previousPeriodEnd };
      
    case 'LAST_30_DAYS':
      // Previous 30 days: 60 days ago to 30 days ago (exclusive of current period start)
      const thirtyDaysAgoStart = new Date(now);
      thirtyDaysAgoStart.setDate(now.getDate() - 30);
      thirtyDaysAgoStart.setHours(0, 0, 0, 0);
      
      // End of previous period: 1 millisecond before current period starts
      const previousPeriodEnd30 = new Date(thirtyDaysAgoStart);
      previousPeriodEnd30.setMilliseconds(previousPeriodEnd30.getMilliseconds() - 1);
      
      const sixtyDaysAgo = new Date(now);
      sixtyDaysAgo.setDate(now.getDate() - 60);
      sixtyDaysAgo.setHours(0, 0, 0, 0);
      
      return { startDate: sixtyDaysAgo, endDate: previousPeriodEnd30 };
      
    case 'ALL_TIME':
    default:
      // No previous period for all-time
      return null;
  }
}

function getDateRangeLabel(dateRange: DateRange): string {
  switch (dateRange) {
    case 'LAST_7_DAYS':
      return 'Last 7 Days';
    case 'LAST_30_DAYS':
      return 'Last 30 Days';
    case 'ALL_TIME':
    default:
      return 'All Time';
  }
}

async function fetchAnalyticsData(
  eventId: string | null,
  dateRange: DateRange = 'ALL_TIME',
  previousPeriodData?: AnalyticsData,
  customDateRange?: { startDate: Date | null; endDate: Date | null }
): Promise<AnalyticsData> {
  // Use custom date range if provided (for previous period), otherwise use dateRange filter
  const dateFilter = customDateRange || getDateRangeFilter(dateRange);
  const { startDate, endDate } = dateFilter;
  // Build query - filter by event_id and date range if provided
  let query = supabase
    .from('orders')
    .select(`
      *,
      order_passes (*),
      ambassadors (
        id,
        full_name
      )
    `)
    .eq('status', OrderStatus.PAID); // Only count paid orders
  
  if (eventId) {
    query = query.eq('event_id', eventId);
  }
  
  if (startDate) {
    query = query.gte('created_at', startDate.toISOString());
  }
  
  if (endDate) {
    query = query.lte('created_at', endDate.toISOString());
  }
  
  const { data: orders, error } = await query;
  
  if (error) {
    throw new Error(`Failed to fetch analytics data: ${error.message}`);
  }
  
  const ordersList = (orders || []) as any[];
  
  // Fetch pending cash and approval orders for the new metrics
  let pendingOrdersQuery = supabase
    .from('orders')
    .select(`
      *,
      order_passes (*)
    `)
    .in('status', ['PENDING_CASH', 'PENDING_ADMIN_APPROVAL']);
  
  if (eventId) {
    pendingOrdersQuery = pendingOrdersQuery.eq('event_id', eventId);
  }
  
  if (startDate) {
    pendingOrdersQuery = pendingOrdersQuery.gte('created_at', startDate.toISOString());
  }
  
  if (endDate) {
    pendingOrdersQuery = pendingOrdersQuery.lte('created_at', endDate.toISOString());
  }
  
  const { data: pendingOrders, error: pendingError } = await pendingOrdersQuery;
  
  if (pendingError) {
    throw new Error(`Failed to fetch pending orders data: ${pendingError.message}`);
  }
  
  const pendingOrdersList = (pendingOrders || []) as any[];
  
  // Calculate pending cash and approval metrics
  let pendingCashAndApprovalOrders = pendingOrdersList.length;
  let pendingCashAndApprovalPasses = 0;
  let pendingCashAndApprovalRevenue = 0;
  
  pendingOrdersList.forEach((order: any) => {
    let orderRevenue = 0;
    let orderTickets = 0;
    
    if (order.order_passes && order.order_passes.length > 0) {
      order.order_passes.forEach((op: OrderPass) => {
        const tickets = op.quantity || 0;
        const revenue = (op.price || 0) * tickets;
        orderTickets += tickets;
        orderRevenue += revenue;
      });
    } else {
      // Fallback: use order quantity and total_price
      orderTickets = order.quantity || 0;
      orderRevenue = parseFloat(order.total_price) || 0;
    }
    
    pendingCashAndApprovalPasses += orderTickets;
    pendingCashAndApprovalRevenue += orderRevenue;
  });
  
  // Calculate KPIs
  let totalTicketsSold = 0;
  let totalRevenue = 0;
  const ambassadorIds = new Set<string>();
  const passPerformanceMap = new Map<string, { tickets: number; revenue: number }>();
  const channelBreakdown = {
    online: 0,
    ambassadorCash: 0,
    manual: 0,
    other: 0, // Unclassified payment methods
    total: 0
  };
  const ambassadorPerformanceMap = new Map<string, {
    ambassadorId: string;
    ambassadorName: string;
    paidOrdersCount: number;
    ticketsSold: number;
    revenue: number;
  }>();
  const salesByDate = new Map<string, { tickets: number; revenue: number }>();
  const salesByHour = new Map<number, number>();
  const salesByDayOfWeek = new Map<string, number>();
  
  // Process each order
  ordersList.forEach((order: any) => {
    // Calculate revenue and tickets from order_passes
    let orderRevenue = 0;
    let orderTickets = 0;
    
    if (order.order_passes && order.order_passes.length > 0) {
      order.order_passes.forEach((op: OrderPass) => {
        const tickets = op.quantity || 0;
        const revenue = (op.price || 0) * tickets;
        orderTickets += tickets;
        orderRevenue += revenue;
        
        // Track pass performance
        const passName = op.pass_type || 'Unknown';
        const existing = passPerformanceMap.get(passName) || { tickets: 0, revenue: 0 };
        passPerformanceMap.set(passName, {
          tickets: existing.tickets + tickets,
          revenue: existing.revenue + revenue
        });
      });
    } else {
      // Fallback: use order quantity and total_price
      orderTickets = order.quantity || 0;
      orderRevenue = parseFloat(order.total_price) || 0;
    }
    
    totalTicketsSold += orderTickets;
    totalRevenue += orderRevenue;
    
    // Track sales channels
    if (order.payment_method === PaymentMethod.ONLINE) {
      channelBreakdown.online += orderRevenue;
    } else if (order.payment_method === PaymentMethod.AMBASSADOR_CASH) {
      channelBreakdown.ambassadorCash += orderRevenue;
    } else if (order.payment_method === PaymentMethod.EXTERNAL_APP) {
      // External app payments count as manual/admin sales
      channelBreakdown.manual += orderRevenue;
    } else {
      // Unclassified payment method
      channelBreakdown.other += orderRevenue;
    }
    channelBreakdown.total += orderRevenue;
    
    // Track ambassadors
    if (order.ambassador_id && order.ambassadors) {
      ambassadorIds.add(order.ambassador_id);
      
      const amb = ambassadorPerformanceMap.get(order.ambassador_id) || {
        ambassadorId: order.ambassador_id,
        ambassadorName: order.ambassadors.full_name || 'Unknown',
        paidOrdersCount: 0,
        ticketsSold: 0,
        revenue: 0
      };
      
      amb.paidOrdersCount += 1;
      amb.ticketsSold += orderTickets;
      amb.revenue += orderRevenue;
      
      ambassadorPerformanceMap.set(order.ambassador_id, amb);
    }
    
    // Track sales over time
    const orderDate = new Date(order.created_at);
    const dateKey = orderDate.toISOString().split('T')[0];
    const existing = salesByDate.get(dateKey) || { tickets: 0, revenue: 0 };
    salesByDate.set(dateKey, {
      tickets: existing.tickets + orderTickets,
      revenue: existing.revenue + orderRevenue
    });
    
    // Track by hour and day for insights
    const hour = orderDate.getHours();
    salesByHour.set(hour, (salesByHour.get(hour) || 0) + orderTickets);
    
    const dayName = orderDate.toLocaleDateString('en-US', { weekday: 'long' });
    salesByDayOfWeek.set(dayName, (salesByDayOfWeek.get(dayName) || 0) + orderTickets);
  });
  
  // Get total orders created (for order completion rate) - need to fetch all orders, not just PAID
  let allOrdersQuery = supabase
    .from('orders')
    .select('id, ambassador_id, status, created_at');
  
  if (eventId) {
    allOrdersQuery = allOrdersQuery.eq('event_id', eventId);
  }
  
  if (startDate) {
    allOrdersQuery = allOrdersQuery.gte('created_at', startDate.toISOString());
  }
  
  if (endDate) {
    allOrdersQuery = allOrdersQuery.lte('created_at', endDate.toISOString());
  }
  
  const { data: allOrders } = await allOrdersQuery;
  const totalOrdersCreated = (allOrders || []).length;
  const totalOrdersPaid = ordersList.length;
  const orderCompletionRate = totalOrdersCreated > 0 
    ? (totalOrdersPaid / totalOrdersCreated) * 100 
    : 0;
  
  // Get all orders per ambassador for conversion rate calculation
  const ambassadorTotalOrdersMap = new Map<string, number>();
  if (allOrders) {
    allOrders.forEach((order: any) => {
      if (order.ambassador_id) {
        ambassadorTotalOrdersMap.set(
          order.ambassador_id,
          (ambassadorTotalOrdersMap.get(order.ambassador_id) || 0) + 1
        );
      }
    });
  }
  
  // Calculate average tickets per day
  const dateKeys = Array.from(salesByDate.keys()).sort();
  const daysWithSales = dateKeys.length;
  const averageTicketsPerDay = daysWithSales > 0 ? totalTicketsSold / daysWithSales : 0;
  
  // Build sales over time array (use all dates in the filtered range)
  const salesOverTime: Array<{ date: string; tickets: number; revenue: number }> = [];
  
  dateKeys.forEach(dateKey => {
    const data = salesByDate.get(dateKey)!;
    salesOverTime.push({
      date: dateKey,
      tickets: data.tickets,
      revenue: data.revenue
    });
  });
  
  // Sort by date
  salesOverTime.sort((a, b) => a.date.localeCompare(b.date));
  
  // Build pass performance array
  const passPerformance = Array.from(passPerformanceMap.entries()).map(([passName, data]) => ({
    passName,
    ticketsSold: data.tickets,
    revenue: data.revenue
  })).sort((a, b) => b.revenue - a.revenue);
  
  // Build ambassador performance array
  const ambassadorPerformance = Array.from(ambassadorPerformanceMap.values()).map(amb => {
    // Calculate conversion rate for this ambassador: paidOrders / totalOrdersCreated
    const totalOrdersForAmb = ambassadorTotalOrdersMap.get(amb.ambassadorId) || 0;
    const ambConversionRate = totalOrdersForAmb > 0 
      ? (amb.paidOrdersCount / totalOrdersForAmb) * 100 
      : 0;
    
    return {
      ambassadorId: amb.ambassadorId,
      ambassadorName: amb.ambassadorName,
      ordersCount: amb.paidOrdersCount,
      ticketsSold: amb.ticketsSold,
      revenue: amb.revenue,
      conversionRate: ambConversionRate
    };
  }).sort((a, b) => b.revenue - a.revenue);
  
  // Calculate trends vs previous period
  const calculateTrend = (current: number, previous: number | null): number | null => {
    if (previous === null || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };
  
  const trends = {
    tickets: previousPeriodData 
      ? calculateTrend(totalTicketsSold, previousPeriodData.totalTicketsSold)
      : null,
    revenue: previousPeriodData 
      ? calculateTrend(totalRevenue, previousPeriodData.totalRevenue)
      : null,
    orders: previousPeriodData 
      ? calculateTrend(totalOrdersPaid, previousPeriodData.totalOrders)
      : null,
    completionRate: previousPeriodData 
      ? calculateTrend(orderCompletionRate, previousPeriodData.orderCompletionRate)
      : null,
    avgTickets: previousPeriodData 
      ? calculateTrend(averageTicketsPerDay, previousPeriodData.averageTicketsPerDay)
      : null,
    ambassadors: previousPeriodData 
      ? calculateTrend(ambassadorIds.size, previousPeriodData.ambassadorsInvolved)
      : null,
  };
  
  // Mathematical validation checks
  const passPerformanceSum = Array.from(passPerformanceMap.values()).reduce(
    (sum, p) => ({ tickets: sum.tickets + p.tickets, revenue: sum.revenue + p.revenue }),
    { tickets: 0, revenue: 0 }
  );
  
  const ambassadorTicketsSum = Array.from(ambassadorPerformanceMap.values()).reduce(
    (sum, amb) => sum + amb.ticketsSold,
    0
  );
  
  // Validate consistency (with small tolerance for floating point errors)
  const revenueMismatch = Math.abs(totalRevenue - channelBreakdown.total);
  const ticketsMismatch = Math.abs(totalTicketsSold - passPerformanceSum.tickets);
  
  if (import.meta.env.DEV) {
    if (revenueMismatch > 0.01) {
      console.warn('[Analytics] Revenue mismatch:', {
        totalRevenue,
        channelBreakdownTotal: channelBreakdown.total,
        difference: revenueMismatch
      });
    }
    if (ticketsMismatch > 0.01) {
      console.warn('[Analytics] Tickets mismatch:', {
        totalTicketsSold,
        passPerformanceSum: passPerformanceSum.tickets,
        difference: ticketsMismatch
      });
    }
    if (totalTicketsSold < ambassadorTicketsSum - 0.01) {
      console.warn('[Analytics] Ambassador tickets exceed total:', {
        totalTicketsSold,
        ambassadorTicketsSum,
        difference: ambassadorTicketsSum - totalTicketsSold
      });
    }
  }
  
  // Ensure channelBreakdown.total matches totalRevenue (account for rounding)
  channelBreakdown.total = totalRevenue;
  
  // Calculate insights
  const bestSellingDay = salesByDayOfWeek.size > 0
    ? Array.from(salesByDayOfWeek.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
    : 'N/A';
  
  const peakSalesHourEntry = salesByHour.size > 0
    ? Array.from(salesByHour.entries())
        .sort((a, b) => b[1] - a[1])[0]
    : null;
  const peakHourFormatted = peakSalesHourEntry && peakSalesHourEntry[1] > 0
    ? `${peakSalesHourEntry[0]}:00`
    : 'N/A';
  
  const lowestSalesPeriod = salesByDayOfWeek.size > 0
    ? Array.from(salesByDayOfWeek.entries())
        .sort((a, b) => a[1] - b[1])[0]?.[0] || 'N/A'
    : 'N/A';
  
  const highestPerformingPass = passPerformance.length > 0 && passPerformance[0].revenue > 0
    ? passPerformance[0].passName
    : 'N/A';
  
  return {
    pendingCashAndApprovalOrders,
    pendingCashAndApprovalPasses,
    pendingCashAndApprovalRevenue,
    totalTicketsSold,
    totalRevenue,
    totalOrders: totalOrdersPaid,
    orderCompletionRate,
    averageTicketsPerDay,
    ambassadorsInvolved: ambassadorIds.size,
    trends,
    salesOverTime,
    passPerformance,
    channelBreakdown,
    ambassadorPerformance,
    insights: {
      bestSellingDay,
      peakSalesHour: peakHourFormatted,
      lowestSalesPeriod,
      highestPerformingPass
    },
    dateRange,
    dateRangeLabel: getDateRangeLabel(dateRange)
  };
}

export function useAnalytics(eventId: string | null, dateRange: DateRange = 'ALL_TIME') {
  // Calculate previous period date range (same length as current period)
  const previousPeriodRange = getPreviousPeriodDateRange(dateRange);
  
  // Fetch previous period data for trend calculation (only if needed)
  const { data: previousData, isFetched: previousDataFetched } = useQuery<AnalyticsData>({
    queryKey: ['analytics', eventId, 'previous', dateRange, previousPeriodRange?.startDate?.toISOString(), previousPeriodRange?.endDate?.toISOString()],
    queryFn: () => previousPeriodRange 
      ? fetchAnalyticsData(eventId, dateRange, undefined, previousPeriodRange)
      : Promise.resolve(null as any),
    enabled: !!previousPeriodRange,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  
  // Main analytics query
  return useQuery<AnalyticsData>({
    queryKey: ['analytics', eventId, dateRange],
    queryFn: () => fetchAnalyticsData(eventId, dateRange, previousData || undefined),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: !previousPeriodRange || previousDataFetched, // Wait for previous data if needed
  });
}
