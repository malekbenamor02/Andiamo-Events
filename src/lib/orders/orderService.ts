/**
 * Order Service
 * Handles order CRUD operations and status transitions
 * 
 * SECURITY: All order creation now goes through server-side API endpoint
 * Frontend NEVER directly accesses database for order creation
 */

import { supabase } from '@/integrations/supabase/client';
import { Order, CreateOrderData, UpdateOrderStatusData, CancelOrderData } from '@/types/orders';
import { OrderPass } from '@/types/orders';
import { OrderStatus, PaymentMethod } from '@/lib/constants/orderStatuses';
import { API_ROUTES, buildFullApiUrl, getApiBaseUrl } from '@/lib/api-routes';
import { sanitizeUrl } from '@/lib/url-validator';

/**
 * Create a new order
 * 
 * SECURITY: This function now calls the server-side API endpoint
 * All validation happens server-side - frontend only sends request
 * Server validates passes, calculates prices, and blocks ambassadors
 */
export async function createOrder(data: CreateOrderData): Promise<Order> {
  const { customerInfo, passes, paymentMethod, ambassadorId, eventId } = data;
  
  // SECURITY: Check if user is logged in as ambassador
  // Block ambassadors from creating orders
  const ambassadorSession = localStorage.getItem('ambassadorSession');
  if (ambassadorSession) {
    throw new Error(
      'SECURITY: Ambassadors cannot create orders. You can only receive orders from clients.'
    );
  }

  // SECURITY: Prepare request for SERVER-SIDE API
  // Frontend sends ONLY: passIds and quantities, idempotencyKey
  // Server fetches prices, names, calculates totals, and sends SMS (all internal)
  const apiBase = getApiBaseUrl();
  const apiUrl = buildFullApiUrl(API_ROUTES.CREATE_ORDER, apiBase) || `${apiBase}/api/orders/create`;
  
  if (!apiUrl) {
    throw new Error('Invalid API URL configuration');
  }

  // SECURITY: Generate idempotency key to prevent duplicate orders
  // If user clicks submit twice, server returns existing order
  let idempotencyKey: string;
  try {
    // Use crypto.randomUUID() if available (browser), otherwise generate UUID
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      idempotencyKey = crypto.randomUUID();
    } else {
      // Fallback UUID generation for older browsers
      idempotencyKey = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
  } catch (e) {
    // Fallback if crypto not available
    idempotencyKey = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  // ============================================
  // PHASE 1 SECURITY FIX: FRONTEND PRICE PROTECTION
  // ============================================
  // CRITICAL: Frontend MUST NOT send any price/total values
  // - calculateTotal() in PassPurchase.tsx is for DISPLAY ONLY
  // - Server recalculates ALL prices from database
  // - Any price sent from frontend will be REJECTED by server
  // ============================================
  // SECURITY: Send minimal data - server will validate everything
  const requestData = {
    eventId: eventId || null,
    passIds: passes.map(p => ({
      passId: p.passId, // Only send ID
      quantity: p.quantity // Only send quantity
      // ⚠️ DO NOT send price or passName - server fetches from database
      // ⚠️ DO NOT send totalPrice - server calculates from database prices
      // ⚠️ Frontend calculateTotal() is for UI display only, NOT sent to server
    })),
    customer: {
      name: customerInfo.full_name.trim(),  // Renamed to match server
      phone: customerInfo.phone.trim(),
      email: customerInfo.email?.trim() || '',
      city: customerInfo.city.trim(),
      ville: customerInfo.ville?.trim() || ''
    },
    paymentMethod: paymentMethod,
    ambassadorId: (paymentMethod === PaymentMethod.AMBASSADOR_CASH && ambassadorId) ? ambassadorId : null,
    idempotencyKey: idempotencyKey  // Send idempotency key to prevent duplicates
  };

  // SECURITY: Call server-side API endpoint
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestData)
  });

  // CRITICAL: Check response.ok BEFORE parsing JSON
  // Error responses may not be JSON (could be HTML/text)
  if (!response.ok) {
    let errorMessage = `Failed to create order: ${response.statusText}`;
    try {
      // Try to parse error response as JSON
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch (jsonError) {
      // If response is not JSON, get text response
      try {
        const textResponse = await response.text();
        if (textResponse) {
          errorMessage = `Server error: ${textResponse.substring(0, 100)}`;
        }
      } catch (textError) {
        // If we can't read response, use status text
        errorMessage = `Failed to create order: ${response.status} ${response.statusText}`;
      }
    }
    throw new Error(errorMessage);
  }

  // Parse JSON only after confirming response is OK
  let result;
  try {
    result = await response.json();
  } catch (jsonError) {
    throw new Error(`Invalid response from server: Response is not valid JSON`);
  }

  if (!result.success || !result.order) {
    throw new Error(result.error || 'Failed to create order: Invalid response from server');
  }

  const order = result.order as Order;

  // SECURITY: SMS is now sent INTERNALLY by server during order creation
  // Frontend should NOT call SMS endpoints directly
  // SMS is only sent as part of order creation (internal to server)
  
  return order;
}

/**
 * Get order by ID with relations
 */
export async function getOrderById(orderId: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_passes (*),
      ambassadors (
        id,
        full_name,
        phone,
        email,
        city,
        ville,
        status
      ),
      events (
        id,
        name,
        date,
        venue,
        city
      )
    `)
    .eq('id', orderId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch order: ${error.message}`);
  }
  
  return data as Order;
}

/**
 * Update order status
 * 
 * ⚠️ SECURITY WARNING: This function directly updates the database
 * It should ONLY be used by server-side code, NEVER by frontend
 * Frontend should use API endpoints for all status updates
 * 
 * @deprecated Use API endpoints instead. This is kept for backward compatibility only.
 */
export async function updateOrderStatus(data: UpdateOrderStatusData): Promise<Order> {
  const { orderId, status, metadata } = data;
  
  const updateData: any = {
    status,
    updated_at: new Date().toISOString()
  };
  
  // Add metadata if provided
  if (metadata) {
    if (metadata.payment_gateway_reference) {
      updateData.payment_gateway_reference = metadata.payment_gateway_reference;
    }
    if (metadata.external_app_reference) {
      updateData.external_app_reference = metadata.external_app_reference;
    }
    if (metadata.payment_response_data) {
      updateData.payment_response_data = metadata.payment_response_data;
    }
  }
  
  // Set status-specific timestamps
  if (status === OrderStatus.PAID) {
    updateData.completed_at = new Date().toISOString();
    updateData.payment_status = 'PAID';
  }
  
  const { data: order, error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId)
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to update order status: ${error.message}`);
  }
  
  return order as Order;
}

/**
 * Cancel an order
 * 
 * ⚠️ SECURITY WARNING: This function directly updates the database
 * It should ONLY be used by server-side code, NEVER by frontend
 * Frontend should use API endpoints:
 * - /api/ambassador/cancel-order (for ambassadors)
 * - /api/admin/cancel-order (for admins)
 * 
 * @deprecated Use API endpoints instead. This is kept for backward compatibility only.
 */
export async function cancelOrder(data: CancelOrderData): Promise<Order> {
  const { orderId, cancelledBy, reason, ambassadorId } = data;
  
  if (!reason || reason.trim().length === 0) {
    throw new Error('Cancellation reason is required');
  }
  
  if (cancelledBy === 'ambassador' && !ambassadorId) {
    throw new Error('Ambassador ID is required when cancelling as ambassador');
  }
  
  const updateData: any = {
    status: OrderStatus.CANCELLED,
    cancelled_by: cancelledBy,
    cancellation_reason: reason.trim(),
    cancelled_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  const { data: order, error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId)
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to cancel order: ${error.message}`);
  }
  
  return order as Order;
}

/**
 * Get orders with filters
 */
export async function getOrders(filters?: {
  status?: OrderStatus;
  paymentMethod?: PaymentMethod;
  ambassadorId?: string;
  city?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}): Promise<{ orders: Order[]; count: number }> {
  let query = supabase
    .from('orders')
    .select('*, order_passes (*), ambassadors (id, full_name, phone, email)', { count: 'exact' });
  
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  
  if (filters?.paymentMethod) {
    query = query.eq('payment_method', filters.paymentMethod);
  }
  
  if (filters?.ambassadorId) {
    query = query.eq('ambassador_id', filters.ambassadorId);
  }
  
  if (filters?.city) {
    query = query.eq('city', filters.city);
  }
  
  if (filters?.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  
  if (filters?.dateTo) {
    query = query.lte('created_at', filters.dateTo);
  }
  
  query = query.order('created_at', { ascending: false });
  
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
  }
  
  const { data, error, count } = await query;
  
  if (error) {
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }
  
  return {
    orders: (data || []) as Order[],
    count: count || 0
  };
}

