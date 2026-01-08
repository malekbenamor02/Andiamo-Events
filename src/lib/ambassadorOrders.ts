/**
 * Ambassador Orders Service
 * 
 * This module contains all logic related to ambassador order management:
 * - Creating COD orders
 * - Fetching ambassador sales data
 * - Order management (accept, complete, cancel)
 */

import { supabase } from '@/integrations/supabase/client';

export interface SelectedPass {
  passId: string;
  passName: string;
  quantity: number;
  price: number;
}

export interface CustomerInfo {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  ville: string;
}

export interface OrderData {
  source: 'platform_online' | 'ambassador_manual'; // platform_cod is deprecated
  user_name: string;
  user_phone: string;
  user_email: string | null;
  city: string;
  ville: string | null;
  event_id: string | null;
  pass_type: string;
  quantity: number;
  total_price: number;
  payment_method: 'cod' | 'online';
  status: string;
  notes?: string;
}


export interface EnrichedOrder {
  id: string;
  ambassador_id?: string;
  ambassador_name?: string | null;
  [key: string]: any;
}

/**
 * Create a COD (Cash on Delivery) order
 * 
 * ⚠️ SECURITY WARNING: This function is DEPRECATED and BLOCKED
 * 
 * Ambassadors are NOT allowed to create orders manually.
 * This function will throw an error if called.
 * 
 * Order creation should only happen through:
 * 1. Public order flow (PassPurchase page)
 * 2. Admin panel (for admin-created orders)
 * 3. Secure server-side API endpoints (if implemented)
 * 
 * @deprecated This function is disabled for security reasons
 * @throws Error Always throws an error - function is disabled
 */
export async function createCODOrder(
  passes: SelectedPass[],
  totalPrice: number,
  customerInfo: CustomerInfo,
  eventId: string | null
): Promise<any> {
  // SECURITY FIX: Block this function - ambassadors cannot create orders
  throw new Error(
    'SECURITY: Ambassadors are not allowed to create orders manually. ' +
    'Orders must be created through the public order flow or admin panel.'
  );
  
  // Original code removed for security reasons
  // This function was vulnerable and allowed unauthorized order creation
}

/**
 * Fetch all ambassador sales data including orders and performance
 */
export async function fetchAmbassadorSalesData(): Promise<{
  codOrders: EnrichedOrder[];
  manualOrders: EnrichedOrder[];
  allAmbassadorOrders: EnrichedOrder[];
  orderLogs: any[];
}> {
  // First, fetch all ambassadors to create name mapping
  const { data: allAmbassadorsData, error: ambassadorsError } = await (supabase as any)
    .from('ambassadors')
    .select('id, full_name, ville, status, city')
    .eq('status', 'approved');
  
  if (ambassadorsError) throw ambassadorsError;
  
  // Create ambassador name mapping
  const ambassadorNameMap = new Map<string, string>();
  (allAmbassadorsData || []).forEach((amb: any) => {
    ambassadorNameMap.set(amb.id, amb.full_name);
  });

  // Note: platform_cod source is deprecated - all COD orders are now ambassador_manual
  // Fetch all ambassador manual orders (includes COD orders)
  const { data: manualData, error: manualError } = await (supabase as any)
    .from('orders')
    .select('*')
    .eq('source', 'ambassador_manual')
    .order('created_at', { ascending: false });

  if (manualError) throw manualError;

  // Fetch all ambassador orders (all COD orders are now ambassador_manual)
  const { data: allData, error: allError } = await (supabase as any)
    .from('orders')
    .select('*')
    .eq('source', 'ambassador_manual')
    .order('created_at', { ascending: false });

  if (allError) throw allError;

  // Legacy: Keep codOrders empty array for backward compatibility (platform_cod is deprecated)
  const enrichedCodOrders: EnrichedOrder[] = [];
  
  const enrichedManualOrders: EnrichedOrder[] = (manualData || []).map((order: any) => ({
    ...order,
    ambassador_name: order.ambassador_id ? (ambassadorNameMap.get(order.ambassador_id) || 'Unknown') : null
  }));
  
  const enrichedAllOrders: EnrichedOrder[] = (allData || []).map((order: any) => ({
    ...order,
    ambassador_name: order.ambassador_id ? (ambassadorNameMap.get(order.ambassador_id) || 'Unknown') : null
  }));

  // Fetch order logs
  const { data: logsData, error: logsError } = await (supabase as any)
    .from('order_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (logsError) throw logsError;

  return {
    codOrders: enrichedCodOrders,
    manualOrders: enrichedManualOrders,
    allAmbassadorOrders: enrichedAllOrders,
    orderLogs: logsData || []
  };
}

/**
 * Accept an order as admin
 */
export async function acceptOrderAsAdmin(orderId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('orders')
    .update({
      status: 'ACCEPTED',
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId);

  if (error) throw error;

  // Log the acceptance
  await (supabase as any)
    .from('order_logs')
    .insert({
      order_id: orderId,
      action: 'accepted',
      performed_by: null,
      performed_by_type: 'admin',
      details: { admin_action: true }
    });
}

/**
 * Complete an order as admin
 * 
 * ⚠️ SECURITY WARNING: This function directly updates the database
 * Frontend should use API endpoint: /api/admin/complete-order (if exists)
 * 
 * @deprecated Use API endpoint instead
 */
export async function completeOrderAsAdmin(orderId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('orders')
    .update({
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId);

  if (error) throw error;

  // Log the completion
  await (supabase as any)
    .from('order_logs')
    .insert({
      order_id: orderId,
      action: 'completed',
      performed_by: null,
      performed_by_type: 'admin',
      details: { admin_action: true }
    });
}

/**
 * Cancel an order as admin
 * 
 * ⚠️ SECURITY WARNING: This function directly updates the database
 * Frontend should use API endpoint: /api/admin/reject-order or /api/admin/cancel-order
 * 
 * @deprecated Use API endpoint instead
 */
export async function cancelOrderAsAdmin(
  orderId: string,
  reason?: string
): Promise<void> {
  const { error } = await (supabase as any)
    .from('orders')
    .update({
      status: 'CANCELLED',
      cancellation_reason: reason || null,
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId);

  if (error) throw error;

  // Log the cancellation
  await (supabase as any)
    .from('order_logs')
    .insert({
      order_id: orderId,
      action: 'cancelled',
      performed_by: null,
      performed_by_type: 'admin',
      details: { admin_action: true, reason: reason || null }
    });
}


