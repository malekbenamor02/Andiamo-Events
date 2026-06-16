import { API_ROUTES, buildFullApiUrl, getApiBaseUrl } from '@/lib/api-routes';

async function adminOrdersFetch(path: string, init?: RequestInit) {
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

function qs(params: Record<string, string | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const adminOrdersApi = {
  listOnlineOrders: (params: {
    event_id?: string | null;
    payment_status?: string;
    city?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
  }) =>
    adminOrdersFetch(
      API_ROUTES.ADMIN_ORDERS_ONLINE +
        qs({
          event_id: params.event_id ?? undefined,
          payment_status: params.payment_status,
          city: params.city,
          date_from: params.date_from,
          date_to: params.date_to,
          limit: params.limit != null ? String(params.limit) : undefined,
        })
    ),

  chartOnlineOrders: (eventId: string) =>
    adminOrdersFetch(API_ROUTES.ADMIN_ORDERS_CHART + qs({ event_id: eventId })),

  posOverviewOrders: (eventId: string) =>
    adminOrdersFetch(API_ROUTES.ADMIN_ORDERS_POS_OVERVIEW + qs({ event_id: eventId })),

  analyticsOrders: (
    eventId: string | null,
    dateRange: string,
    customRange?: { start: string; end: string }
  ) =>
    adminOrdersFetch(
      API_ROUTES.ADMIN_ANALYTICS_ORDERS +
        qs({
          event_id: eventId ?? undefined,
          date_range: dateRange,
          start_date: customRange?.start,
          end_date: customRange?.end,
        })
    ),

  exportOrders: (eventId: string | null, dateRange: string) =>
    adminOrdersFetch(
      API_ROUTES.ADMIN_ANALYTICS_EXPORT_ORDERS +
        qs({
          event_id: eventId ?? undefined,
          date_range: dateRange,
        })
    ),

  orderSummariesByIds: (ids: string[]) =>
    adminOrdersFetch(API_ROUTES.ADMIN_ANALYTICS_ORDER_SUMMARIES, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  listOrderLogs: (limit = 100) =>
    adminOrdersFetch(API_ROUTES.ADMIN_ORDER_LOGS + qs({ limit: String(limit) })),

  updatePaymentStatus: (
    orderId: string,
    payment_status: string,
    old_payment_status?: string | null
  ) =>
    adminOrdersFetch(API_ROUTES.ADMIN_ORDER_PAYMENT_STATUS(orderId), {
      method: 'PATCH',
      body: JSON.stringify({ payment_status, old_payment_status }),
    }),

  completeOrder: (orderId: string) =>
    adminOrdersFetch(API_ROUTES.ADMIN_ORDER_COMPLETE(orderId), { method: 'PATCH' }),

  approveEmailSmsDelivery: (orderId: string) =>
    adminOrdersFetch(API_ROUTES.ADMIN_ORDER_APPROVE_EMAIL_SMS(orderId), { method: 'POST' }),

  rejectOrder: (orderId: string, reason?: string) =>
    adminOrdersFetch(API_ROUTES.ADMIN_REJECT_ORDER, {
      method: 'POST',
      body: JSON.stringify({ orderId, reason }),
    }),

  listAuditLogs: (limit = 150) =>
    adminOrdersFetch(API_ROUTES.ADMIN_AUDIT_LOGS + qs({ limit: String(limit) })),

  writeAuditLog: (payload: {
    action: string;
    targetType?: string | null;
    targetId?: string | null;
    details?: Record<string, unknown> | null;
  }) =>
    adminOrdersFetch(API_ROUTES.ADMIN_AUDIT_LOG, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
