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

export type AcademyComparisonCell =
  | { kind: 'text'; value: LocalizedText }
  | { kind: 'boolean'; value: boolean };

export interface AcademyComparisonRow {
  label: LocalizedText;
  essentielle: AcademyComparisonCell;
  pro: AcademyComparisonCell;
  premium: AcademyComparisonCell;
  /** Muted styling for the whole row (e.g. seats count) */
  muted?: boolean;
}

export interface AcademyFaqItem {
  id: string;
  question: LocalizedText;
  answer: LocalizedText;
}

export interface AcademyProgramModule {
  id: string;
  title: LocalizedText;
}

export interface AcademyTrainerProfile {
  sectionTitle: LocalizedText;
  jobTitle: LocalizedText;
  experienceLabel: LocalizedText;
  experience: LocalizedText;
  specialtiesLabel: LocalizedText;
  specialties: LocalizedText;
  approachLabel: LocalizedText;
  approach: LocalizedText;
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
