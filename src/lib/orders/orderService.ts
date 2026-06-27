/**
 * Order Service
 * Handles order CRUD operations and status transitions
 */

import { Order, CreateOrderData, UpdateOrderStatusData, CancelOrderData } from '@/types/orders';
import { OrderPass } from '@/types/orders';
import { OrderStatus, PaymentMethod } from '@/lib/constants/orderStatuses';
import { getApiBaseUrl } from '@/lib/api-routes';
import { PublicOrderError } from '@/lib/orders/PublicOrderError';
import type { TicketMetaTrackingResponse } from '@/lib/meta';

export interface CreateOrderResult {
  order: Order;
  metaTracking?: TicketMetaTrackingResponse;
}

/**
 * Create a new order
 * CRITICAL: Routes to server-side endpoint for stock validation and atomic reservation
 */
export async function createOrder(
  data: CreateOrderData,
  options?: { signal?: AbortSignal }
): Promise<CreateOrderResult> {
  const {
    customerInfo,
    passes,
    paymentMethod,
    ambassadorId,
    eventId,
    recaptchaToken,
    idempotencyKey,
    metaEventId,
    metaFbp,
    metaFbc,
    metaFbclid,
    metaEventSourceUrl,
    presaleCsrfToken,
    promoCode,
  } = data;
  
  // Validate required fields
  if (!customerInfo || !passes || !paymentMethod) {
    throw new Error('Missing required fields: customerInfo, passes, and paymentMethod are required');
  }

  if (!Array.isArray(passes) || passes.length === 0) {
    throw new Error('At least one pass is required');
  }

  // Call server-side order creation endpoint
  // Server handles: stock validation, atomic reservation, order creation, order_passes creation
  // Use getApiBaseUrl() for consistent API routing
  const apiBase = getApiBaseUrl();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (presaleCsrfToken) {
    headers['X-Presale-CSRF'] = presaleCsrfToken;
  }

  // Server derives pass prices; client display fields (price, passName) are rejected by pricing guard.
  const passesForApi = passes.map((p) => ({
    passId: p.passId,
    quantity: p.quantity,
  }));

  const response = await fetch(`${apiBase}/api/orders/create`, {
    method: 'POST',
    headers,
    credentials: 'include',
    signal: options?.signal,
    body: JSON.stringify({
      customerInfo,
      passes: passesForApi,
      paymentMethod,
      ambassadorId,
      eventId,
      recaptchaToken: recaptchaToken ?? undefined,
      idempotencyKey: idempotencyKey ?? undefined,
      metaEventId: metaEventId ?? undefined,
      metaFbp: metaFbp ?? undefined,
      metaFbc: metaFbc ?? undefined,
      metaFbclid: metaFbclid ?? undefined,
      metaEventSourceUrl: metaEventSourceUrl ?? undefined,
      ...(promoCode ? { promoCode } : {}),
    })
  });

  const result = await response.json();

  if (!response.ok) {
    const code = typeof result.error === 'string' ? result.error : 'service_unavailable';
    const message =
      typeof result.message === 'string' && result.message.trim()
        ? result.message.trim()
        : typeof result.error === 'string'
          ? result.error
          : 'Failed to create order';
    throw new PublicOrderError(code, message);
  }

  if (!result.success || !result.order) {
    throw new PublicOrderError('service_unavailable', 'Invalid response from server');
  }

  // Return created order (server returns order with order_passes)
  return {
    order: result.order as Order,
    ...(result.metaTracking ? { metaTracking: result.metaTracking as TicketMetaTrackingResponse } : {}),
  };
}

/**
 * Get order by ID with relations — server API only (client Supabase removed)
 */
export async function getOrderById(_orderId: string): Promise<Order | null> {
  throw new Error('getOrderById: use server admin/ambassador order APIs — client Supabase access removed');
}

/**
 * Update order status — server API only (client Supabase removed)
 */
export async function updateOrderStatus(_data: UpdateOrderStatusData): Promise<Order> {
  throw new Error('updateOrderStatus: use server order APIs — client Supabase access removed');
}

/**
 * Cancel an order — server API only (client Supabase removed)
 */
export async function cancelOrder(_data: CancelOrderData): Promise<Order> {
  throw new Error('cancelOrder: use server admin/ambassador order APIs — client Supabase access removed');
}

/**
 * Get orders with filters — server API only (client Supabase removed)
 */
export async function getOrders(_filters?: {
  status?: OrderStatus;
  paymentMethod?: PaymentMethod;
  ambassadorId?: string;
  city?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}): Promise<{ orders: Order[]; count: number }> {
  throw new Error('getOrders: use server admin order APIs — client Supabase access removed');
}

