import type { AcademyFormulaId, AcademyLanguage, AcademyPaymentMethod, LocalizedText } from '@/types/academy';

const ACADEMY_FORMULA_IDS: AcademyFormulaId[] = ['essentielle', 'pro', 'premium'];

export function pickLocalized(text: LocalizedText, language: AcademyLanguage): string {
  return text[language];
}

export function formatPriceDt(price: number): string {
  return new Intl.NumberFormat('fr-TN', { maximumFractionDigits: 0 }).format(price);
}

export const ACADEMY_REGISTER_PATH = '/academy/register';

export const ACADEMY_TERMS_PATH = '/academy/terms';

export const ACADEMY_INSCRIPTION_ID = 'academy-inscription';

export function isAcademyFormulaId(value: string): value is AcademyFormulaId {
  return ACADEMY_FORMULA_IDS.includes(value as AcademyFormulaId);
}

export function buildAcademyRegisterPath(formula?: AcademyFormulaId): string {
  if (!formula) return ACADEMY_REGISTER_PATH;
  return `${ACADEMY_REGISTER_PATH}?formula=${formula}`;
}

export function parseAcademyFormulaParam(value: string | null): AcademyFormulaId | null {
  if (!value || !isAcademyFormulaId(value)) return null;
  return value;
}

export function requiresAcademyPaymentProof(
  method: AcademyPaymentMethod | ''
): method is 'rib' | 'd17' {
  return method === 'rib' || method === 'd17';
}
