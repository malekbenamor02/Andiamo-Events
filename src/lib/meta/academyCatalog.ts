import type { AcademyFormulaId, AcademyPaymentMethod } from '@/types/academy';

export const ACADEMY_FORMULA_META: Record<
  AcademyFormulaId,
  { contentId: string; contentName: string; basePriceDt: number }
> = {
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

export function getAcademyFormulaMeta(formule: AcademyFormulaId) {
  return ACADEMY_FORMULA_META[formule] ?? null;
}

/** Meta payment_method values (card → online). */
export function mapAcademyPaymentMethodForMeta(
  paymentMethod: AcademyPaymentMethod
): 'online' | 'rib' | 'd17' | null {
  if (paymentMethod === 'card') return 'online';
  if (paymentMethod === 'rib' || paymentMethod === 'd17') return paymentMethod;
  return null;
}
