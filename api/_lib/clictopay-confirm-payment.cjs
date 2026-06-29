'use strict';

const { fetchClicToPayOrderStatus, sanitizeClicToPayConfirmResponse } = require('./clictopay-client.cjs');
const { validateClicToPayPaymentForOrder } = require('./clictopay-payment-verify.cjs');
const {
  fulfillPaidOrderTicketsAndEmail,
  buildFulfillmentDepsFromMisc,
  buildPaymentConfirmJson,
  fulfillmentResultToLegacyResponse,
  ORDER_PASSES_COLUMNS,
} = require('./paid-order-fulfillment.cjs');

const ORDER_CONFIRM_SELECT =
  'id, status, event_id, order_number, payment_gateway_reference, total_price, total_with_fees, fee_amount, payment_method, source';

async function loadOrderForConfirm(dbClient, orderId) {
  return dbClient.from('orders').select(ORDER_CONFIRM_SELECT).eq('id', orderId).single();
}

async function loadOrderPasses(dbClient, orderId) {
  return dbClient.from('order_passes').select(ORDER_PASSES_COLUMNS).eq('order_id', orderId);
}

async function verifyClicToPayForOrder(order, orderPasses) {
  const ctpOrderId = order.payment_gateway_reference;
  if (!ctpOrderId) {
    return { ok: false, reason: 'no_gateway_reference', statusData: null, gatewayPaid: false };
  }
  const fetched = await fetchClicToPayOrderStatus(ctpOrderId);
  if (!fetched.statusData) {
    return {
      ok: false,
      reason: fetched.error || 'gateway_unreachable',
      statusData: null,
      gatewayPaid: false,
    };
  }
  const validation = validateClicToPayPaymentForOrder(order, fetched.statusData, orderPasses || []);
  return {
    ...validation,
    statusData: fetched.statusData,
  };
}

async function runFulfillment(dbClient, requireFromRoot, nodePath, fulfillmentLibDir, orderId, source) {
  const fulfillmentDeps = buildFulfillmentDepsFromMisc(requireFromRoot, nodePath, fulfillmentLibDir);
  return fulfillPaidOrderTicketsAndEmail(dbClient, fulfillmentDeps, {
    orderId,
    source,
  });
}

async function logConfirm(dbClient, orderId, details) {
  try {
    await dbClient.from('order_logs').insert({
      order_id: orderId,
      action: 'clictopay_confirm',
      performed_by: null,
      performed_by_type: 'system',
      details,
    });
  } catch {
    /* ignore */
  }
}

/**
 * POST/GET /api/clictopay-confirm-payment
 * Public endpoint: only orderId from client; payment verified server-side with ClicToPay before fulfillment.
 */
async function handleClicToPayConfirmPayment(ctx) {
  const {
    req,
    res,
    method,
    parseBody,
    validatedOrderId,
    createServiceRoleClient,
    requireFromRoot,
    nodePath,
    fulfillmentLibDir,
    runTicketMetaTrackingSafe,
  } = ctx;

  try {
    let orderId = validatedOrderId || null;
    if (!orderId) {
      if (method === 'POST') {
        const bodyData = await parseBody(req).catch(() => ({}));
        orderId = bodyData?.orderId || bodyData?.order_id;
      } else {
        const urlObj = new URL(req.url || '', 'http://localhost');
        orderId = urlObj.searchParams.get('orderId') || urlObj.searchParams.get('order_id');
      }
    }
    if (!orderId) return res.status(400).json({ error: 'invalid_request' });

    const dbClient = await createServiceRoleClient();
    const { data: order, error: orderError } = await loadOrderForConfirm(dbClient, orderId);
    if (orderError || !order) {
      if (orderError?.code === 'PGRST116') {
        return res.status(404).json({ error: 'Order not found' });
      }
      console.error('ClicToPay confirm: failed to load order', orderId, orderError);
      return res.status(500).json({
        error: 'Failed to load order',
        details: orderError?.message || 'Order lookup failed',
      });
    }

    const { data: orderPasses } = await loadOrderPasses(dbClient, orderId);
    const gateway = await verifyClicToPayForOrder(order, orderPasses || []);

    if (order.status === 'PAID') {
      if (!gateway.statusData) {
        return res.status(200).json({
          success: false,
          status: 'UNKNOWN',
          orderId,
          message:
            'Unable to verify payment with the gateway. Please try again later or contact support.',
        });
      }
      if (!gateway.ok) {
        return res.status(200).json({
          success: false,
          paymentConfirmed: false,
          status: 'PAID',
          orderId,
          message: 'Payment could not be verified for fulfillment recovery.',
          gatewayReason: gateway.reason,
        });
      }
      const fulfillment = await runFulfillment(
        dbClient,
        requireFromRoot,
        nodePath,
        fulfillmentLibDir,
        orderId,
        'clictopay_confirm'
      );
      await logConfirm(dbClient, orderId, {
        already_paid: true,
        gateway_validation: gateway.reason || 'ok',
        fulfillment,
      });
      const metaTracking = await runTicketMetaTrackingSafe(dbClient, orderId, req);
      return res.status(200).json(
        buildPaymentConfirmJson(fulfillment, { alreadyPaid: true, metaTracking })
      );
    }

    if (order.status !== 'PENDING_ONLINE') {
      return res.status(400).json({
        error: 'Order is not pending online payment',
        details: `Status: ${order.status}`,
      });
    }

    if (!gateway.statusData) {
      return res.status(200).json({
        success: false,
        status: 'UNKNOWN',
        orderId,
        message:
          'Unable to verify payment with the gateway. Please try again later or contact support.',
      });
    }

    if (!gateway.ok) {
      try {
        await dbClient.rpc('release_order_stock_internal', { order_id_param: orderId });
      } catch {
        /* ignore */
      }
      const failUpdate = {
        status: 'FAILED',
        payment_status: 'FAILED',
        updated_at: new Date().toISOString(),
        payment_confirm_response: sanitizeClicToPayConfirmResponse(gateway.statusData),
      };
      const { error: failUpdateError } = await dbClient
        .from('orders')
        .update(failUpdate)
        .eq('id', orderId);
      if (failUpdateError) {
        return res.status(500).json({
          success: false,
          status: 'failed',
          orderId,
          message: 'Payment failed and order status could not be updated. Please contact support.',
          dbError: failUpdateError.message || String(failUpdateError),
        });
      }
      return res.status(200).json({
        success: false,
        status: 'failed',
        orderId,
        message: 'Payment failed or was declined by the gateway',
        gatewayReason: gateway.reason,
      });
    }

    const oldStatus = order.status;
    const paidUpdate = {
      status: 'PAID',
      payment_status: 'PAID',
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      payment_confirm_response: sanitizeClicToPayConfirmResponse(gateway.statusData),
    };
    const { data: updatedOrder, error: updateError } = await dbClient
      .from('orders')
      .update(paidUpdate)
      .eq('id', orderId)
      .eq('status', 'PENDING_ONLINE')
      .select('id, status')
      .single();

    if (updateError || !updatedOrder) {
      const { data: check } = await dbClient.from('orders').select('status').eq('id', orderId).single();
      if (check?.status === 'PAID') {
        const fulfillment = await runFulfillment(
          dbClient,
          requireFromRoot,
          nodePath,
          fulfillmentLibDir,
          orderId,
          'clictopay_confirm'
        );
        const metaTracking = await runTicketMetaTrackingSafe(dbClient, orderId, req);
        return res.status(200).json(
          buildPaymentConfirmJson(fulfillment, { alreadyPaid: true, metaTracking })
        );
      }
      return res.status(500).json({ error: 'Failed to update order', details: updateError?.message });
    }

    const fulfillment = await runFulfillment(
      dbClient,
      requireFromRoot,
      nodePath,
      fulfillmentLibDir,
      orderId,
      'clictopay_confirm'
    );
    const ticketResult = fulfillmentResultToLegacyResponse(fulfillment);
    await logConfirm(dbClient, orderId, {
      old_status: oldStatus,
      new_status: 'PAID',
      gateway_validation: 'ok',
      ticket_result: ticketResult,
      fulfillment,
    });
    const metaTracking = await runTicketMetaTrackingSafe(dbClient, orderId, req);
    return res.status(200).json(buildPaymentConfirmJson(fulfillment, { metaTracking }));
  } catch (err) {
    console.error('ClicToPay confirm error:', err);
    return res.status(500).json({ error: 'Payment confirmation failed', details: err.message });
  }
}

module.exports = {
  handleClicToPayConfirmPayment,
  verifyClicToPayForOrder,
  ORDER_CONFIRM_SELECT,
};
