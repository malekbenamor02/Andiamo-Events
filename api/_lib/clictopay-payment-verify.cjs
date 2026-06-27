'use strict';

const { computeOnlinePaymentFees } = require('./online-payment-fee.cjs');

const ALLOWED_CURRENCIES = new Set(['TND', '788', 'DTN', 'DT']);

function hasDeclineIndicator(errMsg) {
  if (typeof errMsg !== 'string' || !errMsg) return false;
  const lower = errMsg.toLowerCase();
  return (
    lower.includes('declined') ||
    lower.includes('refus') ||
    lower.includes('invalid')
  );
}

/** Amount sent to ClicToPay register.do (millimes: TND * 1000). */
function expectedOrderAmountMillimes(order, orderPasses) {
  let amount = 0;
  if (order.total_with_fees != null && order.total_with_fees !== '') {
    amount = Number(order.total_with_fees);
  } else if (order.total_amount != null && order.total_amount !== '') {
    amount = Number(order.total_amount);
  } else if (orderPasses?.length) {
    const baseAmount = orderPasses.reduce(
      (sum, p) => sum + Number(p.price) * Number(p.quantity),
      0
    );
    amount = Number(computeOnlinePaymentFees(baseAmount).totalWithFees.toFixed(3));
  }
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 1000);
}

function normalizeOrderRef(order) {
  if (order.order_number != null) return String(order.order_number).replace(/-/g, '');
  return String(order.id || '').replace(/-/g, '').substring(0, 32);
}

function gatewayOrderRefMatches(order, statusData) {
  const expected = normalizeOrderRef(order);
  const gatewayOrderNumber = statusData.orderNumber ?? statusData.order_number;
  if (gatewayOrderNumber != null) {
    if (String(gatewayOrderNumber).replace(/-/g, '') === expected) return true;
  }
  const attrs = statusData.attributes;
  if (Array.isArray(attrs)) {
    const mdOrder = attrs.find((a) => a && a.name === 'mdOrder');
    if (mdOrder?.value != null && String(mdOrder.value) === String(order.id)) return true;
  }
  if (order.payment_gateway_reference != null) {
    const gw = String(order.payment_gateway_reference);
    const statusOrderId = statusData.orderId ?? statusData.order_id;
    if (statusOrderId != null && String(statusOrderId) === gw) return true;
  }
  return gatewayOrderNumber == null;
}

function gatewayAmountMillimes(statusData) {
  const raw =
    statusData.amount ??
    statusData.paymentAmountInfo?.approvedAmount ??
    statusData.paymentAmountInfo?.depositedAmount;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function gatewayCurrencyOk(statusData) {
  const currency = statusData.currency;
  if (currency == null || currency === '') return true;
  return ALLOWED_CURRENCIES.has(String(currency).trim().toUpperCase());
}

/**
 * Server-side validation of ClicToPay status response against our order.
 * @returns {{ ok: boolean, reason?: string, gatewayPaid?: boolean }}
 */
function validateClicToPayPaymentForOrder(order, statusData, orderPasses = []) {
  if (!statusData || typeof statusData !== 'object') {
    return { ok: false, reason: 'no_gateway_response', gatewayPaid: false };
  }

  const orderStatus = statusData.orderStatus ?? statusData.order_status;
  const errorCode = statusData.errorCode ?? statusData.error_code;
  const errMsg = statusData.errorMessage ?? statusData.error_message ?? statusData.message ?? '';
  const isOrderStatusSuccess = orderStatus != null && String(orderStatus) === '2';
  const isErrorCodeOk = errorCode === undefined || errorCode === null || Number(errorCode) === 0;
  const gatewayPaid = isOrderStatusSuccess && isErrorCodeOk && !hasDeclineIndicator(errMsg);

  if (!gatewayPaid) {
    return { ok: false, reason: 'gateway_not_paid', gatewayPaid: false };
  }

  if (!gatewayOrderRefMatches(order, statusData)) {
    return { ok: false, reason: 'order_reference_mismatch', gatewayPaid: true };
  }

  if (!gatewayCurrencyOk(statusData)) {
    return { ok: false, reason: 'currency_mismatch', gatewayPaid: true };
  }

  const expectedMillimes = expectedOrderAmountMillimes(order, orderPasses);
  const gatewayMillimes = gatewayAmountMillimes(statusData);
  if (expectedMillimes != null && gatewayMillimes != null) {
    if (Math.abs(gatewayMillimes - expectedMillimes) > 1) {
      return {
        ok: false,
        reason: 'amount_mismatch',
        gatewayPaid: true,
        expectedMillimes,
        gatewayMillimes,
      };
    }
  }

  return { ok: true, gatewayPaid: true };
}

module.exports = {
  ALLOWED_CURRENCIES,
  expectedOrderAmountMillimes,
  validateClicToPayPaymentForOrder,
  gatewayOrderRefMatches,
  hasDeclineIndicator,
};
