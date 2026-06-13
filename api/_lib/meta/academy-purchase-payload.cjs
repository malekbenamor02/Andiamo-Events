'use strict';

const {
  getAcademyFormulaMeta,
  mapAcademyPaymentMethodForMeta,
  META_ACADEMY_CONTENT_CATEGORY,
} = require('./academy-catalog.cjs');

/**
 * @param {Record<string, unknown>} reg
 * @param {{ promoCode?: string|null }} [options]
 */
function buildAcademyPurchaseCustomData(reg, options = {}) {
  const formula = getAcademyFormulaMeta(reg.formule);
  const paymentMethod = mapAcademyPaymentMethodForMeta(reg.payment_method);
  const value = Number(reg.total_amount_dt);

  if (!formula || !paymentMethod || !(value > 0)) {
    return null;
  }

  /** @type {Record<string, unknown>} */
  const customData = {
    value,
    currency: 'TND',
    content_name: formula.contentName,
    content_category: META_ACADEMY_CONTENT_CATEGORY,
    content_type: 'product',
    content_ids: [formula.contentId],
    contents: [
      {
        id: formula.contentId,
        quantity: 1,
        item_price: formula.basePriceDt,
      },
    ],
    num_items: 1,
    order_id: reg.id != null ? String(reg.id) : undefined,
    payment_method: paymentMethod,
  };

  const promoCode =
    options.promoCode != null
      ? String(options.promoCode).trim()
      : reg.promo_code != null
        ? String(reg.promo_code).trim()
        : '';
  if (promoCode) {
    customData.promo_code = promoCode;
  }

  return customData;
}

/**
 * @param {Record<string, unknown>} reg
 */
function buildCustomerFromRegistration(reg) {
  return {
    email: reg.email != null ? String(reg.email) : null,
    phone: reg.phone != null ? String(reg.phone) : null,
    fullName: reg.full_name != null ? String(reg.full_name) : null,
    city: null,
  };
}

/**
 * @param {Record<string, unknown>} reg
 */
function isAcademyRegistrationTrackable(reg) {
  if (!reg?.id || !reg.email || !reg.phone || !reg.full_name) return false;
  if (!getAcademyFormulaMeta(reg.formule)) return false;
  if (!mapAcademyPaymentMethodForMeta(reg.payment_method)) return false;
  return Number(reg.total_amount_dt) > 0;
}

module.exports = {
  META_ACADEMY_CONTENT_CATEGORY,
  buildAcademyPurchaseCustomData,
  buildCustomerFromRegistration,
  isAcademyRegistrationTrackable,
};
