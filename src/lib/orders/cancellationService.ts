/**
 * Cancellation Service
 * Handles order cancellation with proper tracking
 */

import { cancelOrder, getOrderById } from './orderService';
import { CancelOrderData } from '@/types/orders';
import { CancelledBy, OrderStatus } from '@/lib/constants/orderStatuses';

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
  throw new Error('checkAndCancelTimeouts must run on the server (cron/API), not in the browser');
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
  void orderId;
  void cancelledBy;
  void performerId;
  void reason;
  // Order logs are written server-side when cancel routes run.
}

