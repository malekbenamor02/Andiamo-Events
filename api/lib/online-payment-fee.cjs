'use strict';

/**
 * Online card payment fee: rate from ONLINE_PAYMENT_FEE_RATE (decimal, e.g. 0.05 = 5%).
 * Default 0.05. Clamped to [0, 0.5].
 *
 * For checkout UI, set VITE_ONLINE_PAYMENT_FEE_RATE to the same value (see src/lib/onlinePaymentFee.ts).
 */

const DEFAULT_ONLINE_PAYMENT_FEE_RATE = 0.05;
const MAX_ONLINE_PAYMENT_FEE_RATE = 0.5;

function parseOnlinePaymentFeeRate(raw) {
  if (raw == null || String(raw).trim() === '') {
    return DEFAULT_ONLINE_PAYMENT_FEE_RATE;
  }
  const n = Number.parseFloat(String(raw).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) {
    return DEFAULT_ONLINE_PAYMENT_FEE_RATE;
  }
  return Math.min(MAX_ONLINE_PAYMENT_FEE_RATE, n);
}

function getOnlinePaymentFeeRate() {
  return parseOnlinePaymentFeeRate(process.env.ONLINE_PAYMENT_FEE_RATE);
}

/**
 * @param {number} subtotal - pass line subtotal (before fee)
 * @returns {{ feeRate: number, feeAmount: number, totalWithFees: number }}
 */
function computeOnlinePaymentFees(subtotal) {
  const rate = getOnlinePaymentFeeRate();
  const sub = Number(subtotal);
  if (!Number.isFinite(sub) || sub <= 0) {
    return { feeRate: rate, feeAmount: 0, totalWithFees: 0 };
  }
  if (rate <= 0) {
    return { feeRate: rate, feeAmount: 0, totalWithFees: sub };
  }
  const feeAmount = Number((sub * rate).toFixed(3));
  const totalWithFees = sub + feeAmount;
  return { feeRate: rate, feeAmount, totalWithFees };
}

/**
 * When only the fee-inclusive total is known (legacy rows without fee_amount), infer fee for display.
 * fee = total × rate / (1 + rate)
 * @param {number} inclusiveTotal
 * @returns {number|undefined}
 */
function inferFeeFromInclusiveTotal(inclusiveTotal) {
  const rate = getOnlinePaymentFeeRate();
  const t = Number(inclusiveTotal);
  if (!Number.isFinite(t) || t <= 0 || rate <= 0) {
    return undefined;
  }
  return Math.round(((t * rate) / (1 + rate)) * 1000) / 1000;
}

module.exports = {
  DEFAULT_ONLINE_PAYMENT_FEE_RATE,
  getOnlinePaymentFeeRate,
  computeOnlinePaymentFees,
  inferFeeFromInclusiveTotal,
};
