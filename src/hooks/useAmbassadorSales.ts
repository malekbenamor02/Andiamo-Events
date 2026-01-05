/**
 * useAmbassadorSales Hook
 * Fetches ambassador sales data, stats, and analytics
 */

import { useQuery } from '@tanstack/react-query';
import { AmbassadorSalesOverview, AmbassadorSalesAnalytics, Order } from '@/types/orders';
import { API_ROUTES } from '@/lib/api-routes';

interface SalesOverviewResponse {
  success: boolean;
  data: AmbassadorSalesOverview;
}

interface SalesOrdersResponse {
  success: boolean;
  data: Order[];
  count: number;
}

interface SalesLogsResponse {
  success: boolean;
  data: any[];
  count: number;
}

export function useAmbassadorSalesOverview() {
  return useQuery<AmbassadorSalesOverview>({
    queryKey: ['ambassador-sales-overview'],
    queryFn: async () => {
      const response = await fetch('/api/admin/ambassador-sales/overview', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch sales overview');
      }
      const result: SalesOverviewResponse = await response.json();
      return result.data;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAmbassadorSalesOrders(filters?: {
  status?: string;
  ambassador_id?: string;
  city?: string;
  ville?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery<{ orders: Order[]; count: number }>({
    queryKey: ['ambassador-sales-orders', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.ambassador_id) params.append('ambassador_id', filters.ambassador_id);
      if (filters?.city) params.append('city', filters.city);
      if (filters?.ville) params.append('ville', filters.ville);
      if (filters?.date_from) params.append('date_from', filters.date_from);
      if (filters?.date_to) params.append('date_to', filters.date_to);
      params.append('limit', String(filters?.limit || 50));
      params.append('offset', String(filters?.offset || 0));
      
      const response = await fetch(`/api/admin/ambassador-sales/orders?${params.toString()}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch ambassador orders');
      }
      const result: SalesOrdersResponse = await response.json();
      return {
        orders: result.data,
        count: result.count
      };
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useAmbassadorSalesLogs(filters?: {
  date_from?: string;
  date_to?: string;
  action?: string;
  ambassador_id?: string;
  order_id?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery<{ logs: any[]; count: number }>({
    queryKey: ['ambassador-sales-logs', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.date_from) params.append('date_from', filters.date_from);
      if (filters?.date_to) params.append('date_to', filters.date_to);
      if (filters?.action) params.append('action', filters.action);
      if (filters?.ambassador_id) params.append('ambassador_id', filters.ambassador_id);
      if (filters?.order_id) params.append('order_id', filters.order_id);
      params.append('limit', String(filters?.limit || 100));
      params.append('offset', String(filters?.offset || 0));
      
      const response = await fetch(`/api/admin/ambassador-sales/logs?${params.toString()}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Super admin access required');
        }
        throw new Error('Failed to fetch order logs');
      }
      const result: SalesLogsResponse = await response.json();
      return {
        logs: result.data,
        count: result.count
      };
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
  });
}

