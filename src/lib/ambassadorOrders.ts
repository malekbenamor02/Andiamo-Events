/**
 * Ambassador Orders Service
 * 
 * This module contains all logic related to ambassador order management:
 * - Creating COD orders
 * - Fetching ambassador sales data
 * - Order management (accept, complete, cancel)
 */

import { supabase } from '@/integrations/supabase/client';

export interface EnrichedOrder {
  id: string;
  ambassador_id?: string;
  ambassador_name?: string | null;
  [key: string]: any;
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


