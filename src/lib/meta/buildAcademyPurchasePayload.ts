import {
  getAcademyFormulaMeta,
  mapAcademyPaymentMethodForMeta,
} from './academyCatalog';
import type { MetaAttributionContext, MetaCustomerData, MetaPurchasePayload } from './types';
import { META_ACADEMY_CONTENT_CATEGORY } from './types';
import type { AcademyFormulaId, AcademyPaymentMethod } from '@/types/academy';

export function buildAcademyPurchasePayload(input: {
  eventId: string;
  registrationId: string;
  formule: AcademyFormulaId;
  paymentMethod: AcademyPaymentMethod;
  customer: Pick<MetaCustomerData, 'fullName' | 'email' | 'phone'>;
  attribution: MetaAttributionContext;
  totalAmountDt: number;
  promoCode?: string;
}): MetaPurchasePayload | null {
  const formula = getAcademyFormulaMeta(input.formule);
  const metaPaymentMethod = mapAcademyPaymentMethodForMeta(input.paymentMethod);
  const value = Number(input.totalAmountDt);
  const email = input.customer.email?.trim();
  const phone = input.customer.phone?.trim();
  const fullName = input.customer.fullName?.trim();

  if (!formula || !metaPaymentMethod || !(value > 0) || !email || !phone || !fullName) {
    return null;
  }

  return {
    eventId: input.eventId,
    orderId: input.registrationId,
    value,
    currency: 'TND',
    contentCategory: META_ACADEMY_CONTENT_CATEGORY,
    contentIds: [formula.contentId],
    contentName: formula.contentName,
    numItems: 1,
    paymentMethod: metaPaymentMethod,
    customer: {
      email,
      phone,
      fullName,
    },
    attribution: input.attribution,
    contents: [
      {
        id: formula.contentId,
        quantity: 1,
        item_price: formula.basePriceDt,
      },
    ],
    ...(input.promoCode?.trim() ? { promoCode: input.promoCode.trim() } : {}),
  };
}

export function isValidAcademyPurchasePayload(
  payload: MetaPurchasePayload | null | undefined
): payload is MetaPurchasePayload {
  if (!payload) return false;
  return Boolean(
    payload.eventId &&
      payload.orderId &&
      payload.value > 0 &&
      payload.customer.email?.trim() &&
      payload.customer.phone?.trim() &&
      payload.customer.fullName?.trim() &&
      payload.contentIds.length > 0 &&
      payload.paymentMethod &&
      payload.contentCategory === META_ACADEMY_CONTENT_CATEGORY
  );
}
