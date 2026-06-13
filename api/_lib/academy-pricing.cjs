'use strict';

const { parseAcademyOnlineFeeRate } = require('./academy-fee-rate.cjs');

/** Server-side formula prices (must match src/data/academyContent.ts) */
const FORMULA_PRICES_DT = {
  essentielle: 900,
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
 * @param {{ formule: string, paymentMethod: string, discountAmountDt?: number, feeRate?: number }} params
 */
function computeRegistrationAmounts({
  formule,
  paymentMethod,
  discountAmountDt = 0,
  feeRate,
}) {
  const base = getFormulaBasePrice(formule);
  if (base == null) return null;
  const discount = Math.min(Math.max(0, Number(discountAmountDt) || 0), base);
  const subtotal = Math.max(0, base - discount);
  let feeAmount = 0;
  let total = subtotal;
  if (paymentMethod === 'card') {
    const rate = parseAcademyOnlineFeeRate(feeRate);
    feeAmount = Number((subtotal * rate).toFixed(3));
    total = Number((subtotal + feeAmount).toFixed(3));
  }
  return {
    base_amount_dt: base,
    discount_amount_dt: discount,
    fee_amount_dt: feeAmount,
    total_amount_dt: total,
  };
}

/** Recompute expected amounts for a stored registration (anti-tamper before charging). */
function registrationAmountsAreValid(reg, feeRate) {
  if (!reg || typeof reg !== 'object') return false;
  const expected = computeRegistrationAmounts({
    formule: reg.formule,
    paymentMethod: reg.payment_method,
    discountAmountDt: reg.discount_amount_dt,
    feeRate,
  });
  if (!expected) return false;
  const same = (a, b) => Number(a) === Number(b);
  return (
    same(reg.base_amount_dt, expected.base_amount_dt) &&
    same(reg.discount_amount_dt, expected.discount_amount_dt) &&
    same(reg.fee_amount_dt, expected.fee_amount_dt) &&
    same(reg.total_amount_dt, expected.total_amount_dt)
  );
}

module.exports = {
  FORMULA_PRICES_DT,
  FORMULA_IDS,
  PAYMENT_METHODS,
  getFormulaBasePrice,
  computeRegistrationAmounts,
  registrationAmountsAreValid,
};
