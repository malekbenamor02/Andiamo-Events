'use strict';

/**
 * Release sold_quantity for an order (idempotent via stock_released flag).
 * @param {import('@supabase/supabase-js').SupabaseClient} dbClient — service role
 */
async function releaseOrderStock(dbClient, orderId, reason) {
  if (!dbClient) {
    throw new Error('Database client is required');
  }

  const { data: orderUpdate, error: updateError } = await dbClient
    .from('orders')
    .update({ stock_released: true })
    .eq('id', orderId)
    .eq('stock_released', false)
    .select('id, status')
    .single();

  if (updateError || !orderUpdate) {
    if (updateError && updateError.code !== 'PGRST116') {
      console.error('Error updating stock_released flag:', updateError);
      throw new Error(`Failed to release stock: ${updateError.message}`);
    }
    return { released: false, message: 'Stock already released or order not found' };
  }

  const { data: orderPasses, error: passesError } = await dbClient
    .from('order_passes')
    .select('pass_id, pass_type, quantity')
    .eq('order_id', orderId);

  if (passesError) {
    throw new Error(`Failed to fetch order passes: ${passesError.message}`);
  }

  if (!orderPasses || orderPasses.length === 0) {
    console.warn(`Order ${orderId} has no order_passes - cannot release stock`);
    return { released: false, message: 'No order_passes found' };
  }

  const { data: order, error: orderError } = await dbClient
    .from('orders')
    .select('event_id')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    throw new Error(`Failed to fetch order: ${orderError?.message || 'Order not found'}`);
  }

  let releasedCount = 0;
  for (const orderPass of orderPasses) {
    let passIdToUse = orderPass.pass_id;

    if (!passIdToUse && orderPass.pass_type && order.event_id) {
      const { data: matchedPass, error: matchError } = await dbClient
        .from('event_passes')
        .select('id')
        .eq('name', orderPass.pass_type)
        .eq('event_id', order.event_id)
        .limit(1)
        .single();

      if (!matchError && matchedPass) {
        passIdToUse = matchedPass.id;
      } else {
        continue;
      }
    }

    if (!passIdToUse) continue;

    const { data: currentPass, error: fetchError } = await dbClient
      .from('event_passes')
      .select('sold_quantity')
      .eq('id', passIdToUse)
      .single();

    if (fetchError || !currentPass) continue;

    const newSoldQuantity = Math.max(0, currentPass.sold_quantity - orderPass.quantity);
    const { error: passUpdateError } = await dbClient
      .from('event_passes')
      .update({ sold_quantity: newSoldQuantity })
      .eq('id', passIdToUse)
      .eq('sold_quantity', currentPass.sold_quantity);

    if (!passUpdateError) releasedCount++;
  }

  try {
    await dbClient.from('order_logs').insert({
      order_id: orderId,
      action: 'stock_released',
      performed_by: null,
      performed_by_type: 'system',
      details: {
        reason,
        passes_released: releasedCount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (logError) {
    console.warn('Failed to log stock release (non-fatal):', logError);
  }

  return {
    released: true,
    passesReleased: releasedCount,
    message: `Stock released for ${releasedCount} pass(es)`,
  };
}

module.exports = { releaseOrderStock };
