'use strict';

/** Must match src/lib/meta/academyCatalog.ts */
const ACADEMY_FORMULA_META = {
  essentielle: {
    contentId: 'academy_essential',
    contentName: 'Andiamo Academy - Essential',
    basePriceDt: 850,
  },
  pro: {
    contentId: 'academy_pro',
    contentName: 'Andiamo Academy - Pro',
    basePriceDt: 1100,
  },
  premium: {
    contentId: 'academy_premium',
    contentName: 'Andiamo Academy - Premium',
    basePriceDt: 2500,
  },
};

const META_ACADEMY_CONTENT_CATEGORY = 'Academy Training';

function getAcademyFormulaMeta(formule) {
  return ACADEMY_FORMULA_META[formule] || null;
}

/** card → online for Meta custom_data.payment_method */
function mapAcademyPaymentMethodForMeta(paymentMethod) {
  if (paymentMethod === 'card') return 'online';
  if (paymentMethod === 'rib' || paymentMethod === 'd17') return paymentMethod;
  return null;
}

module.exports = {
  ACADEMY_FORMULA_META,
  META_ACADEMY_CONTENT_CATEGORY,
  getAcademyFormulaMeta,
  mapAcademyPaymentMethodForMeta,
};
