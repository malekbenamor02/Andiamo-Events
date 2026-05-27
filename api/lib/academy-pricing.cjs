'use strict';

const { computeOnlinePaymentFees } = require('./online-payment-fee.cjs');

/** Server-side formula prices (must match src/data/academyContent.ts) */
const FORMULA_PRICES_DT = {
  essentielle: 850,
  pro: 1100,
  premium: 2500,
};

const FORMULA_IDS = Object.keys(FORMULA_PRICES_DT);
const PAYMENT_METHODS = ['card', 'rib', 'd17'];

function getFormulaBasePrice(formule) {
  const price = FORMULA_PRICES_DT[formule];
  if (price == null) return null;
  return price;
}

/**
 * @param {{ formule: string, paymentMethod: string, discountAmountDt?: number }} params
 */
function computeRegistrationAmounts({ formule, paymentMethod, discountAmountDt = 0 }) {
  const base = getFormulaBasePrice(formule);
  if (base == null) return null;
  const discount = Math.min(Math.max(0, Number(discountAmountDt) || 0), base);
  const subtotal = Math.max(0, base - discount);
  let feeAmount = 0;
  let total = subtotal;
  if (paymentMethod === 'card') {
    const fees = computeOnlinePaymentFees(subtotal);
    feeAmount = Number(fees.feeAmount.toFixed(3));
    total = Number(fees.totalWithFees.toFixed(3));
  }
  return {
    base_amount_dt: base,
    discount_amount_dt: discount,
    fee_amount_dt: feeAmount,
    total_amount_dt: total,
  };
}

module.exports = {
  FORMULA_PRICES_DT,
  FORMULA_IDS,
  PAYMENT_METHODS,
  getFormulaBasePrice,
  computeRegistrationAmounts,
};
