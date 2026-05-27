export type AcademyFormulaId = 'essentielle' | 'pro' | 'premium';

export type AcademyLanguage = 'en' | 'fr';

export type LocalizedText = { en: string; fr: string };

export interface AcademyHeroMetaItem {
  label: LocalizedText;
}

export type AcademyPaymentMethod = 'card' | 'rib' | 'd17';

export interface AcademyFormula {
  id: AcademyFormulaId;
  name: LocalizedText;
  priceDt: number;
  features: LocalizedText[];
  recommended?: boolean;
  seatsTotal: number;
  seatsRemainingMock: number;
}

export interface AcademyComparisonRow {
  label: LocalizedText;
  essentielle: boolean;
  pro: boolean;
  premium: boolean;
}

export interface AcademyChapter {
  number: number;
  title: LocalizedText;
  description: LocalizedText;
  tags: LocalizedText[];
  /** Optional cover; falls back to branded gradient panel */
  image?: string;
}

export interface AcademyFaqItem {
  id: string;
  question: LocalizedText;
  answer: LocalizedText;
}

export interface AcademyRegistrationFormData {
  fullName: string;
  email: string;
  phone: string;
  formule: AcademyFormulaId | '';
  paymentMethod: AcademyPaymentMethod | '';
  paymentProof: File | null;
  promoCode: string;
  acceptTerms: boolean;
}

export const EMPTY_ACADEMY_FORM: AcademyRegistrationFormData = {
  fullName: '',
  email: '',
  phone: '',
  formule: '',
  paymentMethod: '',
  paymentProof: null,
  promoCode: '',
  acceptTerms: false,
};
