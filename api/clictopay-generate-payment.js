// POST /api/clictopay-generate-payment
// Generates ClicToPay payment and returns redirect URL
// ClicToPay (Société Monétique Tunisie) - register.do

import { createRequire } from 'module';
import { createServiceRoleClient } from './_lib/service-role-client.js';
import { publicApiError, PUBLIC_ERROR_CODES } from './_lib/public-api-error.js';

const requireFee = createRequire(import.meta.url);
const { computeOnlinePaymentFees } = requireFee('./_lib/online-payment-fee.cjs');

let corsUtils = null;
async function getCorsUtils() {
  if (!corsUtils) {
    corsUtils = await import('../lib/cors.js');
  }
  return corsUtils;
}

export default async function handler(req, res) {
  const { setCORSHeaders, handlePreflight } = await getCorsUtils();
  if (handlePreflight(req, res, { methods: 'POST, OPTIONS', headers: 'Content-Type' })) return;
  if (!setCORSHeaders(res, req, { methods: 'POST', headers: 'Content-Type' })) {
    if (req.headers.origin) {
      return publicApiError(res, 403, PUBLIC_ERROR_CODES.INVALID_ACCESS, undefined, { logDetails: 'CORS' });
    }
  }
  if (req.method !== 'POST') {
    return publicApiError(res, 405, PUBLIC_ERROR_CODES.INVALID_REQUEST, undefined, { logDetails: 'Method not allowed' });
  }

  const apiUser = process.env.CLICTOPAY_API_USER;
  const apiPassword = process.env.CLICTOPAY_API_PASSWORD;
  // In production, require explicit base URL so we never accidentally use test gateway
  const isProd = process.env.NODE_ENV === 'production';
  const baseUrl = process.env.CLICTOPAY_BASE_URL || (isProd ? '' : 'https://test.clictopay.com/payment/rest');

  if (!apiUser || !apiPassword) {
    console.error('ClicToPay: Missing CLICTOPAY_API_USER or CLICTOPAY_API_PASSWORD');
    return publicApiError(res, 500, PUBLIC_ERROR_CODES.PAYMENT_UNAVAILABLE, undefined, {
      logDetails: 'Missing CLICTOPAY_API_USER or CLICTOPAY_API_PASSWORD',
    });
  }
  if (!baseUrl) {
    console.error('ClicToPay: CLICTOPAY_BASE_URL is required in production');
    return publicApiError(res, 500, PUBLIC_ERROR_CODES.PAYMENT_UNAVAILABLE, undefined, {
      logDetails: 'CLICTOPAY_BASE_URL missing in production',
    });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    body = {};
  }
  const { orderId } = body;
  if (!orderId) {
    return publicApiError(res, 400, PUBLIC_ERROR_CODES.INVALID_REQUEST, undefined, { logDetails: 'orderId required' });
  }

  let dbClient;
  try {
    dbClient = await createServiceRoleClient();
  } catch {
    return publicApiError(res, 500, PUBLIC_ERROR_CODES.SERVICE_UNAVAILABLE, undefined, {
      logDetails: 'SUPABASE_SERVICE_ROLE_KEY not configured',
    });
  }

  const { data: order, error: orderError } = await dbClient
    .from('orders')
    .select(`
      id,
      order_number,
      status,
      total_price,
      fee_amount,
      total_with_fees,
      payment_gateway_reference,
      order_passes (
        id,
        pass_type,
        quantity,
        price
      )
    `)
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    return publicApiError(res, 404, PUBLIC_ERROR_CODES.ORDER_NOT_FOUND, undefined, { logDetails: orderError });
  }
  if (order.status === 'PAID') {
    return res.status(400).json({
      error: PUBLIC_ERROR_CODES.PAYMENT_FAILED,
      message: 'Order already paid',
      alreadyPaid: true,
    });
  }
  if (order.status !== 'PENDING_ONLINE') {
    return publicApiError(res, 400, PUBLIC_ERROR_CODES.INVALID_REQUEST, undefined, {
      logDetails: `Order status: ${order.status}`,
    });
  }

  // Prefer the canonical fee-inclusive amount from total_with_fees when available.
  // Fallbacks:
  // - total_price (for legacy rows already fee-inclusive)
  // - recomputed subtotal + fee (ONLINE_PAYMENT_FEE_RATE) from order_passes as a last resort.
  let amount = 0;
  if (order.total_with_fees != null) {
    amount = Number(order.total_with_fees);
  } else if (order.total_price != null) {
    amount = Number(order.total_price);
  } else if (order.order_passes?.length) {
    const baseAmount = order.order_passes.reduce(
      (sum, p) => sum + Number(p.price) * Number(p.quantity),
      0
    );
    amount = Number(computeOnlinePaymentFees(baseAmount).totalWithFees.toFixed(3));
  }

  if (!amount || amount <= 0) {
    return publicApiError(res, 400, PUBLIC_ERROR_CODES.INVALID_REQUEST, undefined, {
      logDetails: 'Invalid order amount',
    });
  }

  // Prefer request Origin so user returns to same host (e.g. 172.20.10.4:3000 on phone, not localhost)
  let base = req.headers?.origin;
  if (!base || !base.startsWith('http')) base = process.env.VITE_PUBLIC_URL;
  if (!base && process.env.VERCEL_URL) base = `https://${process.env.VERCEL_URL}`;
  if (!base) base = 'https://andiamoevents.com';
  if (!base.startsWith('http')) base = `https://${base}`;
  const returnUrl = `${base}/payment-processing?orderId=${orderId}&return=1`;
  const failUrl = `${base}/payment-processing?orderId=${orderId}&return=1&status=failed`;

  // ClicToPay expects numeric or alphanumeric order ref (no hyphens). Use order_number if available, else sanitized id.
  const orderRef = order.order_number != null
    ? String(order.order_number)
    : orderId.replace(/-/g, '').substring(0, 32);

  const params = new URLSearchParams({
    userName: apiUser,
    password: apiPassword,
    amount: String(Math.round(amount * 1000)),
    orderNumber: orderRef,
    returnUrl,
    failUrl,
    description: `Order ${order.order_number != null ? order.order_number : orderId.substring(0, 8)}`
  });

  try {
    const regUrl = baseUrl.replace(/\/$/, '') + '/register.do';
    const resp = await fetch(regUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    const text = await resp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }

    const formUrl = data.formUrl || data.form_url || data.redirectUrl;
    const ctpOrderId = data.orderId || data.order_id;
    if (formUrl) {
      if (ctpOrderId) {
        // Store only minimal reference (no full gateway response with potential PII)
        const safePaymentResponseData = { gatewayOrderId: String(ctpOrderId) };
        await dbClient
          .from('orders')
          .update({
            payment_gateway_reference: String(ctpOrderId),
            payment_response_data: safePaymentResponseData,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId);
      }
      return res.status(200).json({
        success: true,
        formUrl,
        orderId: orderId
      });
    }

    console.error('ClicToPay register.do response:', { status: resp.status, text: text.slice(0, 500), data });
    return publicApiError(res, 500, PUBLIC_ERROR_CODES.PAYMENT_UNAVAILABLE, undefined, {
      logDetails: { status: resp.status, data },
    });
  } catch (err) {
    console.error('ClicToPay generate error:', err);
    return publicApiError(res, 500, PUBLIC_ERROR_CODES.PAYMENT_UNAVAILABLE, undefined, {
      logDetails: err,
    });
  }
}
