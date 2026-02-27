// POST /api/clictopay-generate-payment
// Generates ClicToPay payment and returns redirect URL
// ClicToPay (Société Monétique Tunisie) - register.do

import { createClient } from '@supabase/supabase-js';

let corsUtils = null;
async function getCorsUtils() {
  if (!corsUtils) {
    corsUtils = await import('./utils/cors.js');
  }
  return corsUtils;
}

export default async function handler(req, res) {
  const { setCORSHeaders, handlePreflight } = await getCorsUtils();
  if (handlePreflight(req, res, { methods: 'POST, OPTIONS', headers: 'Content-Type' })) return;
  if (!setCORSHeaders(res, req, { methods: 'POST', headers: 'Content-Type' })) {
    if (req.headers.origin) return res.status(403).json({ error: 'CORS not allowed' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiUser = process.env.CLICTOPAY_API_USER;
  const apiPassword = process.env.CLICTOPAY_API_PASSWORD;
  // In production, require explicit base URL so we never accidentally use test gateway
  const isProd = process.env.NODE_ENV === 'production';
  const baseUrl = process.env.CLICTOPAY_BASE_URL || (isProd ? '' : 'https://test.clictopay.com/payment/rest');

  if (!apiUser || !apiPassword) {
    console.error('ClicToPay: Missing CLICTOPAY_API_USER or CLICTOPAY_API_PASSWORD');
    return res.status(500).json({
      error: 'Payment gateway not configured',
      message: 'Please configure CLICTOPAY_API_USER and CLICTOPAY_API_PASSWORD'
    });
  }
  if (!baseUrl) {
    console.error('ClicToPay: CLICTOPAY_BASE_URL is required in production');
    return res.status(500).json({
      error: 'Payment gateway not configured',
      message: 'Please set CLICTOPAY_BASE_URL (e.g. https://ipay.clictopay.com/payment/rest for production)'
    });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    body = {};
  }
  const { orderId } = body;
  if (!orderId) return res.status(400).json({ error: 'orderId is required' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const dbClient = createClient(supabaseUrl, supabaseKey);

  const { data: order, error: orderError } = await dbClient
    .from('orders')
    .select(`
      id,
      order_number,
      status,
      total_price,
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
    return res.status(404).json({ error: 'Order not found' });
  }
  if (order.status === 'PAID') {
    return res.status(400).json({
      error: 'Order already paid',
      alreadyPaid: true
    });
  }
  if (order.status !== 'PENDING_ONLINE') {
    return res.status(400).json({
      error: 'Order is not ready for payment',
      details: `Order status: ${order.status}`
    });
  }

  let amount = 0;
  if (order.order_passes?.length) {
    amount = order.order_passes.reduce((sum, p) => sum + Number(p.price) * Number(p.quantity), 0);
  } else {
    amount = Number(order.total_price) || 0;
  }
  if (amount <= 0) return res.status(400).json({ error: 'Invalid order amount' });

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
        await dbClient
          .from('orders')
          .update({
            payment_gateway_reference: String(ctpOrderId),
            payment_response_data: data,
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
    return res.status(500).json({
      error: data.errorMessage || data.error || 'Failed to generate payment',
      details: data
    });
  } catch (err) {
    console.error('ClicToPay generate error:', err);
    return res.status(500).json({
      error: 'Payment gateway error',
      message: err.message || 'Unknown error'
    });
  }
}
