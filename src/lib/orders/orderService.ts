/**
 * Order Service
 * Handles order CRUD operations and status transitions
 */

import { supabase } from '@/integrations/supabase/client';
import { Order, CreateOrderData, UpdateOrderStatusData, CancelOrderData } from '@/types/orders';
import { OrderPass } from '@/types/orders';
import { OrderStatus, PaymentMethod } from '@/lib/constants/orderStatuses';

/**
 * Create a new order
 * CRITICAL: Routes to server-side endpoint for stock validation and atomic reservation
 */
export async function createOrder(data: CreateOrderData): Promise<Order> {
  const { customerInfo, passes, paymentMethod, ambassadorId, eventId } = data;
  
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
  
  const response = await fetch(`${apiBase}/api/orders/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      customerInfo,
      passes,
      paymentMethod,
      ambassadorId,
      eventId
    })
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || result.details || 'Failed to create order');
  }

  if (!result.success || !result.order) {
    throw new Error('Invalid response from server');
  }

  // Return created order (server returns order with order_passes)
  return result.order as Order;
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

