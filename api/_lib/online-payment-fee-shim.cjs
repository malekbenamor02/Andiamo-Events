'use strict';

/**
 * Server-side alias for src/lib/onlinePaymentFee.ts (used by esbuild reports Excel bundle).
 * Reads ONLINE_PAYMENT_FEE_RATE via api/_lib/online-payment-fee.cjs — never import.meta.env.
 */

const { getOnlinePaymentFeeRate, computeOnlinePaymentFees } = require('./online-payment-fee.cjs');

function computeOnlinePaymentFeesDisplay(subtotal) {
  return computeOnlinePaymentFees(subtotal);
}

module.exports = {
  getOnlinePaymentFeeRate,
  computeOnlinePaymentFeesDisplay,
};
