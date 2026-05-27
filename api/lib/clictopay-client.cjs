'use strict';

function getClicToPayConfig() {
  const apiUser = process.env.CLICTOPAY_API_USER;
  const apiPassword = process.env.CLICTOPAY_API_PASSWORD;
  const isProd = process.env.NODE_ENV === 'production';
  const baseUrl =
    process.env.CLICTOPAY_BASE_URL || (isProd ? '' : 'https://test.clictopay.com/payment/rest');
  return { apiUser, apiPassword, baseUrl, isProd };
}

function sanitizeClicToPayConfirmResponse(raw) {
  if (raw == null || typeof raw !== 'object') return raw;
  const safe = {};
  const allow = [
    'orderNumber',
    'orderStatus',
    'errorCode',
    'errorMessage',
    'amount',
    'currency',
    'actionCode',
    'actionCodeDescription',
    'paymentWay',
    'date',
    'authDateTime',
    'feeAmount',
    'chargeback',
    'fraudLevel',
    'terminalId',
    'orderDescription',
  ];
  for (const k of allow) {
    if (Object.prototype.hasOwnProperty.call(raw, k)) safe[k] = raw[k];
  }
  if (raw.paymentAmountInfo && typeof raw.paymentAmountInfo === 'object') {
    safe.paymentAmountInfo = {
      paymentState: raw.paymentAmountInfo.paymentState,
      approvedAmount: raw.paymentAmountInfo.approvedAmount,
      refundedAmount: raw.paymentAmountInfo.refundedAmount,
      depositedAmount: raw.paymentAmountInfo.depositedAmount,
    };
  }
  if (raw.bankInfo && typeof raw.bankInfo === 'object' && raw.bankInfo.bankCountryCode != null) {
    safe.bankInfo = { bankCountryCode: raw.bankInfo.bankCountryCode };
  }
  if (Array.isArray(raw.attributes)) {
    const mdOrder = raw.attributes.find((a) => a && a.name === 'mdOrder');
    if (mdOrder && mdOrder.value != null) {
      safe.attributes = [{ name: 'mdOrder', value: mdOrder.value }];
    }
  }
  return safe;
}

/**
 * @param {string} gatewayOrderId - ClicToPay order id from register.do
 */
async function fetchClicToPayOrderStatus(gatewayOrderId) {
  const { apiUser, apiPassword, baseUrl } = getClicToPayConfig();
  if (!gatewayOrderId || !apiUser || !apiPassword || !baseUrl) {
    return { ok: false, error: 'gateway_not_configured', statusData: null };
  }
  const statusParams = new URLSearchParams({
    userName: apiUser,
    password: apiPassword,
    orderId: String(gatewayOrderId),
  });
  const statusUrl = baseUrl.replace(/\/$/, '') + '/getOrderStatusExtended.do';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  try {
    const statusRes = await fetch(statusUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: statusParams.toString(),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const statusText = await statusRes.text();
    let statusData = {};
    try {
      statusData = JSON.parse(statusText);
    } catch {
      const altUrl = baseUrl.replace(/\/$/, '') + '/getOrderStatus.do';
      const altRes = await fetch(altUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: statusParams.toString(),
      });
      const altText = await altRes.text();
      try {
        statusData = JSON.parse(altText);
      } catch {
        return { ok: false, error: 'invalid_json', statusData: null };
      }
    }
    const orderStatus = statusData.orderStatus ?? statusData.order_status;
    const errorCode = statusData.errorCode ?? statusData.error_code;
    const isOrderStatusSuccess = orderStatus != null && String(orderStatus) === '2';
    const isErrorOk = errorCode == null || String(errorCode) === '0';
    const gatewayStatusOk = isOrderStatusSuccess && isErrorOk;
    return {
      ok: gatewayStatusOk,
      statusData: sanitizeClicToPayConfirmResponse(statusData),
      rawOk: gatewayStatusOk,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return { ok: false, error: err.message || 'fetch_failed', statusData: null };
  }
}

/**
 * @param {{ amount: number, orderNumber: string, returnUrl: string, failUrl: string, description: string }} opts
 */
async function registerClicToPayPayment(opts) {
  const { apiUser, apiPassword, baseUrl, isProd } = getClicToPayConfig();
  if (!apiUser || !apiPassword) {
    return { ok: false, error: 'Payment gateway not configured' };
  }
  if (!baseUrl) {
    return {
      ok: false,
      error: isProd ? 'CLICTOPAY_BASE_URL required in production' : 'Missing base URL',
    };
  }
  const amount = Number(opts.amount);
  if (!amount || amount <= 0) return { ok: false, error: 'Invalid amount' };

  const params = new URLSearchParams({
    userName: apiUser,
    password: apiPassword,
    amount: String(Math.round(amount * 1000)),
    orderNumber: String(opts.orderNumber).replace(/-/g, '').substring(0, 32),
    returnUrl: opts.returnUrl,
    failUrl: opts.failUrl,
    description: opts.description || 'Academy registration',
  });

  const regUrl = baseUrl.replace(/\/$/, '') + '/register.do';
  const resp = await fetch(regUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const text = await resp.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }
  const formUrl = data.formUrl || data.form_url || data.redirectUrl;
  const ctpOrderId = data.orderId || data.order_id;
  if (!formUrl) {
    return { ok: false, error: data.errorMessage || data.error || 'Failed to generate payment', data };
  }
  return { ok: true, formUrl, gatewayOrderId: ctpOrderId ? String(ctpOrderId) : null };
}

function resolvePublicBaseUrl(req) {
  let base = req.headers?.origin;
  if (!base || !base.startsWith('http')) base = process.env.VITE_PUBLIC_URL;
  if (!base && process.env.VERCEL_URL) base = `https://${process.env.VERCEL_URL}`;
  if (!base) base = 'https://andiamoevents.com';
  if (!base.startsWith('http')) base = `https://${base}`;
  return base.replace(/\/$/, '');
}

module.exports = {
  getClicToPayConfig,
  sanitizeClicToPayConfirmResponse,
  fetchClicToPayOrderStatus,
  registerClicToPayPayment,
  resolvePublicBaseUrl,
};
