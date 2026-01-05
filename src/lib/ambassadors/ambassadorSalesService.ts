/**
 * Ambassador Sales Service
 * Handles analytics, performance metrics, and statistics for ambassador sales
 */

import { supabase } from '@/integrations/supabase/client';
import { AmbassadorSalesOverview, AmbassadorSalesAnalytics, Order } from '@/types/orders';
import { PaymentMethod, OrderStatus } from '@/lib/constants/orderStatuses';

/**
 * Get sales overview (performance metrics)
 */
export async function getSalesOverview(): Promise<AmbassadorSalesOverview> {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Start of this week (Sunday)
  startOfWeek.setHours(0, 0, 0, 0);
  
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Get all ambassador cash orders
  const { data: allOrders, error: allError } = await supabase
    .from('orders')
    .select('id, total_price, ambassador_id, created_at, status, ambassadors!inner(full_name)')
    .eq('payment_method', PaymentMethod.AMBASSADOR_CASH);
  
  if (allError) {
    throw new Error(`Failed to fetch orders: ${allError.message}`);
  }
  
  const orders = (allOrders || []) as any[];
  
  // Filter by date ranges
  const thisWeekOrders = orders.filter(o => new Date(o.created_at) >= startOfWeek);
  const thisMonthOrders = orders.filter(o => new Date(o.created_at) >= startOfMonth);
  
  // Calculate totals
  const totalOrders = {
    allTime: orders.length,
    thisMonth: thisMonthOrders.length,
    thisWeek: thisWeekOrders.length
  };
  
  const totalRevenue = {
    allTime: orders.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0),
    thisMonth: thisMonthOrders.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0),
    thisWeek: thisWeekOrders.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0)
  };
  
  // Calculate commissions (assuming 10% default, adjust as needed)
  const calculateCommission = (revenue: number) => revenue * 0.10;
  const totalCommissions = {
    allTime: calculateCommission(totalRevenue.allTime),
    thisMonth: calculateCommission(totalRevenue.thisMonth),
    thisWeek: calculateCommission(totalRevenue.thisWeek)
  };
  
  // Average order value
  const averageOrderValue = totalOrders.allTime > 0 
    ? totalRevenue.allTime / totalOrders.allTime 
    : 0;
  
  // Get unique ambassadors count
  const uniqueAmbassadors = new Set(orders.map(o => o.ambassador_id).filter(Boolean));
  const averageOrdersPerAmbassador = uniqueAmbassadors.size > 0
    ? totalOrders.allTime / uniqueAmbassadors.size
    : 0;
  
  // Top performers
  const ambassadorStats = new Map<string, {
    ambassador_id: string;
    ambassador_name: string;
    total_orders: number;
    total_revenue: number;
  }>();
  
  orders.forEach(order => {
    if (!order.ambassador_id) return;
    
    const existing = ambassadorStats.get(order.ambassador_id) || {
      ambassador_id: order.ambassador_id,
      ambassador_name: order.ambassadors?.full_name || 'Unknown',
      total_orders: 0,
      total_revenue: 0
    };
    
    existing.total_orders += 1;
    existing.total_revenue += parseFloat(order.total_price) || 0;
    ambassadorStats.set(order.ambassador_id, existing);
  });
  
  const topPerformers = Array.from(ambassadorStats.values())
    .map(stat => ({
      ...stat,
      total_commissions: calculateCommission(stat.total_revenue)
    }))
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, 10);
  
  return {
    totalOrders,
    totalRevenue,
    totalCommissions,
    averageOrderValue,
    averageOrdersPerAmbassador,
    topPerformers
  };
}

/**
 * Get analytics (time series, charts data)
 */
export async function getSalesAnalytics(): Promise<AmbassadorSalesAnalytics> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, total_price, city, status, payment_method, created_at, completed_at, ambassador_id, ambassadors!inner(full_name)')
    .eq('payment_method', PaymentMethod.AMBASSADOR_CASH)
    .order('created_at', { ascending: true });
  
  if (error) {
    throw new Error(`Failed to fetch orders for analytics: ${error.message}`);
  }
  
  const ordersList = (orders || []) as any[];
  
  // Orders over time (daily for last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const ordersOverTime = new Map<string, { count: number; revenue: number }>();
  ordersList
    .filter(o => new Date(o.created_at) >= thirtyDaysAgo)
    .forEach(order => {
      const date = new Date(order.created_at).toISOString().split('T')[0];
      const existing = ordersOverTime.get(date) || { count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += parseFloat(order.total_price) || 0;
      ordersOverTime.set(date, existing);
    });
  
  // Revenue trends (weekly for last 12 weeks)
  const revenueTrends = new Map<string, { revenue: number; orders: number }>();
  ordersList.forEach(order => {
    const date = new Date(order.created_at);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    
    const existing = revenueTrends.get(weekKey) || { revenue: 0, orders: 0 };
    existing.revenue += parseFloat(order.total_price) || 0;
    existing.orders += 1;
    revenueTrends.set(weekKey, existing);
  });
  
  // Ambassador performance
  const ambassadorPerf = new Map<string, {
    ambassador_id: string;
    ambassador_name: string;
    orders: number;
    revenue: number;
  }>();
  
  ordersList.forEach(order => {
    if (!order.ambassador_id) return;
    
    const existing = ambassadorPerf.get(order.ambassador_id) || {
      ambassador_id: order.ambassador_id,
      ambassador_name: order.ambassadors?.full_name || 'Unknown',
      orders: 0,
      revenue: 0
    };
    
    existing.orders += 1;
    existing.revenue += parseFloat(order.total_price) || 0;
    ambassadorPerf.set(order.ambassador_id, existing);
  });
  
  // City distribution
  const cityDist = new Map<string, { orders: number; revenue: number }>();
  ordersList.forEach(order => {
    const city = order.city || 'Unknown';
    const existing = cityDist.get(city) || { orders: 0, revenue: 0 };
    existing.orders += 1;
    existing.revenue += parseFloat(order.total_price) || 0;
    cityDist.set(city, existing);
  });
  
  // Status breakdown
  const statusBreakdown = {
    PENDING_CASH: ordersList.filter(o => o.status === OrderStatus.PENDING_CASH).length,
    PAID: ordersList.filter(o => o.status === OrderStatus.PAID).length,
    CANCELLED: ordersList.filter(o => o.status === OrderStatus.CANCELLED).length
  };
  
  // Payment method breakdown (should be mostly ambassador_cash, but include others for completeness)
  const paymentMethodBreakdown = {
    ambassador_cash: ordersList.filter(o => o.payment_method === PaymentMethod.AMBASSADOR_CASH).length,
    online: ordersList.filter(o => o.payment_method === PaymentMethod.ONLINE).length,
    external_app: ordersList.filter(o => o.payment_method === PaymentMethod.EXTERNAL_APP).length
  };
  
  // Conversion rate (orders created → PAID)
  const totalCreated = ordersList.length;
  const totalPaid = statusBreakdown.PAID;
  const conversionRate = totalCreated > 0 ? (totalPaid / totalCreated) * 100 : 0;
  
  // Cancellation rate
  const cancellationRate = totalCreated > 0 ? (statusBreakdown.CANCELLED / totalCreated) * 100 : 0;
  
  // Average time to payment (for paid orders)
  const paidOrders = ordersList.filter(o => 
    o.status === OrderStatus.PAID && o.created_at && o.completed_at
  );
  
  let averageTimeToPayment = 0;
  if (paidOrders.length > 0) {
    const totalHours = paidOrders.reduce((sum, order) => {
      const created = new Date(order.created_at);
      const completed = new Date(order.completed_at);
      const hours = (completed.getTime() - created.getTime()) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);
    averageTimeToPayment = totalHours / paidOrders.length;
  }
  
  return {
    ordersOverTime: Array.from(ordersOverTime.entries()).map(([date, data]) => ({
      date,
      ...data
    })),
    revenueTrends: Array.from(revenueTrends.entries())
      .slice(-12) // Last 12 weeks
      .map(([date, data]) => ({
        date,
        ...data
      })),
    ambassadorPerformance: Array.from(ambassadorPerf.values())
      .map(perf => ({
        ...perf,
        commissions: perf.revenue * 0.10 // 10% commission
      }))
      .sort((a, b) => b.revenue - a.revenue),
    cityDistribution: Array.from(cityDist.entries()).map(([city, data]) => ({
      city,
      ...data
    })),
    statusBreakdown,
    paymentMethodBreakdown,
    conversionRate,
    cancellationRate,
    averageTimeToPayment
  };
}

