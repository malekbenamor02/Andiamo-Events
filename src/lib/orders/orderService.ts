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
 */
export async function createOrder(data: CreateOrderData): Promise<Order> {
  const { customerInfo, passes, paymentMethod, ambassadorId, eventId } = data;
  
  // Calculate totals
  const totalQuantity = passes.reduce((sum, pass) => sum + pass.quantity, 0);
  const totalPrice = passes.reduce((sum, pass) => sum + (pass.price * pass.quantity), 0);
  
  // Determine initial status based on payment method
  let initialStatus: OrderStatus;
  switch (paymentMethod) {
    case PaymentMethod.ONLINE:
      initialStatus = OrderStatus.PENDING_ONLINE;
      break;
    case PaymentMethod.EXTERNAL_APP:
      initialStatus = OrderStatus.PENDING_ONLINE;  // Will be updated to REDIRECTED after redirect
      break;
    case PaymentMethod.AMBASSADOR_CASH:
      initialStatus = OrderStatus.PENDING_CASH;
      if (!ambassadorId) {
        throw new Error('Ambassador ID is required for ambassador cash payment');
      }
      break;
    default:
      throw new Error('Invalid payment method');
  }
  
  // Prepare order data
  const orderData: any = {
    source: paymentMethod === PaymentMethod.AMBASSADOR_CASH ? 'platform_cod' : 'platform_online',
    user_name: customerInfo.full_name.trim(),
    user_phone: customerInfo.phone.trim(),
    user_email: customerInfo.email.trim() || null,
    city: customerInfo.city.trim(),
    ville: customerInfo.ville?.trim() || null,
    event_id: eventId || null,
    ambassador_id: ambassadorId || null,
    quantity: totalQuantity,
    total_price: totalPrice,
    payment_method: paymentMethod,
    status: initialStatus,
    assigned_at: ambassadorId ? new Date().toISOString() : null,
    notes: JSON.stringify({
      all_passes: passes.map(p => ({
        passId: p.passId,
        passName: p.passName,
        quantity: p.quantity,
        price: p.price
      })),
      total_order_price: totalPrice,
      pass_count: passes.length
    })
  };
  
  // Create order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert(orderData)
    .select()
    .single();
  
  if (orderError) {
    throw new Error(`Failed to create order: ${orderError.message}`);
  }
  
  // Create order_passes entries
  const orderPassesData = passes.map(pass => ({
    order_id: order.id,
    pass_type: pass.passName,
    quantity: pass.quantity,
    price: pass.price
  }));
  
  const { error: passesError } = await supabase
    .from('order_passes')
    .insert(orderPassesData);
  
  if (passesError) {
    // Cleanup: delete order if order_passes creation fails
    await supabase.from('orders').delete().eq('id', order.id);
    throw new Error(`Failed to create order passes: ${passesError.message}`);
  }

  // Send SMS notifications for COD orders with ambassador assigned
  // TEMPORARILY DISABLED - Set ENABLE_ORDER_SMS=true in .env to re-enable
  const ENABLE_ORDER_SMS = import.meta.env.VITE_ENABLE_ORDER_SMS === 'true';
  
  if (ENABLE_ORDER_SMS && paymentMethod === PaymentMethod.AMBASSADOR_CASH && ambassadorId) {
    try {
      // Send SMS to client (non-blocking - don't fail order creation if SMS fails)
      // In development, use proxy from vite.config.ts (just '/api')
      // In production, use full URL from VITE_API_URL
      const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : 'http://localhost:8082');
      console.log('📱 Sending SMS notifications for order:', order.id, 'Payment method:', paymentMethod, 'Ambassador ID:', ambassadorId);
      console.log('📱 API Base URL:', apiBase);
      
      fetch(`${apiBase}/api/send-order-confirmation-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id })
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(err => {
            console.error('❌ Failed to send order confirmation SMS:', response.status, err);
            throw new Error(err.error || 'SMS request failed');
          });
        }
        return response.json();
      })
      .then(data => {
        console.log('✅ Order confirmation SMS sent successfully:', data);
      })
      .catch(err => {
        console.error('❌ Failed to send order confirmation SMS:', err);
        // Silent failure - don't block order creation
      });

      // Send SMS to ambassador (non-blocking - don't fail order creation if SMS fails)
      fetch(`${apiBase}/api/send-ambassador-order-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id })
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(err => {
            console.error('❌ Failed to send ambassador order SMS:', response.status, err);
            throw new Error(err.error || 'SMS request failed');
          });
        }
        return response.json();
      })
      .then(data => {
        console.log('✅ Ambassador order SMS sent successfully:', data);
      })
      .catch(err => {
        console.error('❌ Failed to send ambassador order SMS:', err);
        // Silent failure - don't block order creation
      });
    } catch (error) {
      console.error('❌ Error initiating SMS notifications:', error);
      // Silent failure - don't block order creation
    }
  } else {
    if (!ENABLE_ORDER_SMS) {
      console.log('⏭️ SMS notifications disabled (set VITE_ENABLE_ORDER_SMS=true to enable)');
    } else {
      console.log('⏭️ SMS notifications skipped - Payment method:', paymentMethod, 'Ambassador ID:', ambassadorId);
    }
  }
  
  return order as Order;
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

