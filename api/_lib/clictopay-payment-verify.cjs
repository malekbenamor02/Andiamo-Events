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
  } else if (order.total_price != null && order.total_price !== '') {
    amount = Number(order.total_price);
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

function normalizeAcademyRegistrationRef(registration) {
  if (!registration || typeof registration !== 'object') return '';
  const num = registration.registration_number;
  if (num != null && String(num).trim() !== '') {
    return String(num).replace(/-/g, '').trim().toUpperCase().substring(0, 32);
  }
  return String(registration.id || '')
    .replace(/-/g, '')
    .trim()
    .toUpperCase()
    .substring(0, 32);
}

function expectedAcademyRegistrationAmountMillimes(registration) {
  const amount = Number(registration?.total_amount_dt);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 1000);
}

function gatewayOrderRefMatchesAcademyRegistration(registration, statusData) {
  const expected = normalizeAcademyRegistrationRef(registration);
  const gatewayOrderNumber = statusData.orderNumber ?? statusData.order_number;
  if (gatewayOrderNumber != null) {
    const gwNorm = String(gatewayOrderNumber).replace(/-/g, '').trim().toUpperCase();
    if (gwNorm === expected || gwNorm.substring(0, 32) === expected) return true;
  }
  if (registration.payment_gateway_reference != null) {
    const gw = String(registration.payment_gateway_reference);
    const statusOrderId = statusData.orderId ?? statusData.order_id;
    if (statusOrderId != null && String(statusOrderId) === gw) return true;
  }
  return gatewayOrderNumber == null;
}

function buildAcademyPaymentValidationAudit(registration, statusData, validation) {
  return {
    registrationId: registration?.id,
    registrationNumber: registration?.registration_number,
    gatewayReference: registration?.payment_gateway_reference,
    expectedAmountMillimes: expectedAcademyRegistrationAmountMillimes(registration),
    gatewayAmount: gatewayAmountMillimes(statusData),
    expectedCurrency: 'TND',
    gatewayCurrency: statusData?.currency ?? null,
    expectedOrderRef: normalizeAcademyRegistrationRef(registration),
    gatewayOrderRef: statusData?.orderNumber ?? statusData?.order_number ?? null,
    reason: validation?.reason,
  };
}

/**
 * Server-side validation of ClicToPay status response against an Academy registration.
 * @returns {{ ok: boolean, reason?: string, gatewayPaid?: boolean, expectedMillimes?: number, gatewayMillimes?: number }}
 */
function validateClicToPayPaymentForAcademyRegistration(registration, statusData) {
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

  if (!gatewayOrderRefMatchesAcademyRegistration(registration, statusData)) {
    return { ok: false, reason: 'order_reference_mismatch', gatewayPaid: true };
  }

  if (!gatewayCurrencyOk(statusData)) {
    return { ok: false, reason: 'currency_mismatch', gatewayPaid: true };
  }

  const expectedMillimes = expectedAcademyRegistrationAmountMillimes(registration);
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
  expectedAcademyRegistrationAmountMillimes,
  normalizeAcademyRegistrationRef,
  gatewayOrderRefMatchesAcademyRegistration,
  buildAcademyPaymentValidationAudit,
  validateClicToPayPaymentForOrder,
  validateClicToPayPaymentForAcademyRegistration,
  gatewayOrderRefMatches,
  hasDeclineIndicator,
  gatewayAmountMillimes,
  gatewayCurrencyOk,
};
