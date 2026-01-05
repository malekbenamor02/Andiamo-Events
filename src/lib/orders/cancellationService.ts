/**
 * Cancellation Service
 * Handles order cancellation with proper tracking
 */

import { cancelOrder, getOrderById } from './orderService';
import { CancelOrderData } from '@/types/orders';
import { CancelledBy, OrderStatus } from '@/lib/constants/orderStatuses';
import { supabase } from '@/integrations/supabase/client';

/**
 * Cancel order by admin
 */
export async function cancelByAdmin(orderId: string, reason: string): Promise<void> {
  // Verify order exists and can be cancelled
  const order = await getOrderById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }
  
  if (order.status === OrderStatus.CANCELLED) {
    throw new Error('Order is already cancelled');
  }
  
  if (order.status === OrderStatus.PAID) {
    // Allow cancellation of paid orders (refund scenario)
    // This might require additional logic in production
  }
  
  const cancelData: CancelOrderData = {
    orderId,
    cancelledBy: 'admin',
    reason
  };
  
  await cancelOrder(cancelData);
  
  // Log cancellation
  await logCancellation(orderId, 'admin', null, reason);
}

/**
 * Cancel order by ambassador
 */
export async function cancelByAmbassador(orderId: string, ambassadorId: string, reason: string): Promise<void> {
  // Verify order exists and belongs to ambassador
  const order = await getOrderById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }
  
  if (order.ambassador_id !== ambassadorId) {
    throw new Error('Order does not belong to this ambassador');
  }
  
  if (order.status === OrderStatus.CANCELLED) {
    throw new Error('Order is already cancelled');
  }
  
  if (order.status === OrderStatus.PAID) {
    throw new Error('Cannot cancel a paid order');
  }
  
  const cancelData: CancelOrderData = {
    orderId,
    cancelledBy: 'ambassador',
    reason,
    ambassadorId
  };
  
  await cancelOrder(cancelData);
  
  // Log cancellation
  await logCancellation(orderId, 'ambassador', ambassadorId, reason);
}

/**
 * Cancel order by system (timeout)
 */
export async function cancelBySystem(orderId: string, reason: string = 'Order timeout - no payment confirmation'): Promise<void> {
  const order = await getOrderById(orderId);
  if (!order) {
    return; // Order doesn't exist, nothing to cancel
  }
  
  if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.PAID) {
    return; // Already cancelled or paid, skip
  }
  
  const cancelData: CancelOrderData = {
    orderId,
    cancelledBy: 'system',
    reason
  };
  
  await cancelOrder(cancelData);
  
  // Log cancellation
  await logCancellation(orderId, 'system', null, reason);
}

/**
 * Check for orders that have timed out and cancel them
 */
export async function checkAndCancelTimeouts(): Promise<{ cancelled: number; errors: number }> {
  // Get timeout settings
  const { data: settingsData } = await supabase
    .from('site_content')
    .select('content')
    .eq('key', 'order_timeout_settings')
    .single();
  
  const timeoutHours = settingsData?.content?.cash_payment_timeout_hours || 24;
  const timeoutDate = new Date();
  timeoutDate.setHours(timeoutDate.getHours() - timeoutHours);
  
  // Get orders that have timed out
  const { data: timedOutOrders, error } = await supabase
    .from('orders')
    .select('id')
    .eq('status', OrderStatus.PENDING_CASH)
    .eq('payment_method', 'ambassador_cash')
    .lt('created_at', timeoutDate.toISOString());
  
  if (error) {
    throw new Error(`Failed to fetch timed out orders: ${error.message}`);
  }
  
  let cancelled = 0;
  let errors = 0;
  
  // Cancel each timed out order
  for (const order of timedOutOrders || []) {
    try {
      await cancelBySystem(order.id);
      cancelled++;
    } catch (err) {
      console.error(`Failed to cancel order ${order.id}:`, err);
      errors++;
    }
  }
  
  return { cancelled, errors };
}

/**
 * Log cancellation in order_logs
 */
async function logCancellation(
  orderId: string,
  cancelledBy: CancelledBy,
  performerId: string | null,
  reason: string
): Promise<void> {
  const { error } = await supabase
    .from('order_logs')
    .insert({
      order_id: orderId,
      action: 'cancelled',
      performed_by: performerId,
      performed_by_type: cancelledBy === 'admin' ? 'admin' : cancelledBy === 'ambassador' ? 'ambassador' : 'system',
      details: {
        cancellation_reason: reason,
        cancelled_by: cancelledBy
      }
    });
  
  if (error) {
    console.error('Failed to log cancellation:', error);
    // Don't throw - logging failure shouldn't prevent cancellation
  }
}

