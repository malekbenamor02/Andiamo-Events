/**
 * Ambassador Orders Service
 *
 * Fetches ambassador sales data via admin API routes (no direct Supabase client access).
 */

import { API_ROUTES, buildFullApiUrl, getApiBaseUrl } from '@/lib/api-routes';
import { adminApi } from '@/lib/adminApi';

export interface EnrichedOrder {
  id: string;
  ambassador_id?: string;
  ambassador_name?: string | null;
  [key: string]: unknown;
}

async function adminFetchJson(path: string, init?: RequestInit) {
  const url = buildFullApiUrl(path, getApiBaseUrl());
  if (!url) throw new Error('API URL not configured');
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || body.details || `Request failed (${response.status})`);
  }
  return body;
}

/**
 * Fetch all ambassador sales data including orders and performance
 */
export async function fetchAmbassadorSalesData(): Promise<{
  codOrders: EnrichedOrder[];
  manualOrders: EnrichedOrder[];
  allAmbassadorOrders: EnrichedOrder[];
  orderLogs: unknown[];
}> {
  const allAmbassadorsData = await adminApi.listAmbassadors();

  const ambassadorNameMap = new Map<string, string>();
  (allAmbassadorsData || []).forEach((amb: { id: string; full_name?: string }) => {
    ambassadorNameMap.set(amb.id, amb.full_name || 'Unknown');
  });

  const ordersBody = await adminFetchJson(`${API_ROUTES.AMBASSADOR_SALES_ORDERS}?limit=1000`);
  const manualData = (ordersBody.data || ordersBody.orders || []) as EnrichedOrder[];

  const enrichedManualOrders: EnrichedOrder[] = manualData.map((order) => ({
    ...order,
    ambassador_name: order.ambassador_id
      ? ambassadorNameMap.get(order.ambassador_id) || 'Unknown'
      : null,
  }));

  const logsBody = await adminFetchJson(`${API_ROUTES.AMBASSADOR_SALES_LOGS}?limit=100`);
  const logsData = (logsBody.data || []) as unknown[];

  return {
    codOrders: [],
    manualOrders: enrichedManualOrders,
    allAmbassadorOrders: enrichedManualOrders,
    orderLogs: logsData,
  };
}

/**
 * Accept an order as admin (server API only)
 */
export async function acceptOrderAsAdmin(_orderId: string): Promise<void> {
  throw new Error('acceptOrderAsAdmin: use server admin order APIs — client Supabase access removed');
}

/**
 * Complete an order as admin (server API only)
 */
export async function completeOrderAsAdmin(_orderId: string): Promise<void> {
  throw new Error('completeOrderAsAdmin: use server admin order APIs — client Supabase access removed');
}

/**
 * Cancel an order as admin (server API only)
 */
export async function cancelOrderAsAdmin(_orderId: string, _reason?: string): Promise<void> {
  throw new Error('cancelOrderAsAdmin: use server admin order APIs — client Supabase access removed');
}
