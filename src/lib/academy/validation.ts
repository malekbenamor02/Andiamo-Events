import { ACADEMY_UI } from '@/data/academyContent';
import { requiresAcademyPaymentProof } from '@/lib/academy/academyUtils';
import type { AcademyLanguage, AcademyRegistrationFormData } from '@/types/academy';

export const ACADEMY_PAYMENT_PROOF_MAX_MB = 5;

const PAYMENT_PROOF_MAX_BYTES = ACADEMY_PAYMENT_PROOF_MAX_MB * 1024 * 1024;

/** MIME types and extensions accepted by the payment proof file input */
export const ACADEMY_PAYMENT_PROOF_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,application/pdf,.pdf';

const PAYMENT_PROOF_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

const PAYMENT_PROOF_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif'];

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

export function isAcademyPaymentProofFile(file: File): boolean {
  const ext = fileExtension(file.name);

  if (file.type === 'application/pdf' || ext === '.pdf') return true;

  if (PAYMENT_PROOF_IMAGE_MIME_TYPES.has(file.type)) return true;

  if ((!file.type || file.type === 'application/octet-stream') && PAYMENT_PROOF_IMAGE_EXTENSIONS.includes(ext)) {
    return true;
  }

  return false;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_TN_REGEX = /^[2594]\d{7}$/;

function messages(language: AcademyLanguage) {
  return ACADEMY_UI.validation[language];
}

export function validateFullName(value: string, language: AcademyLanguage): string | undefined {
  if (value.trim().length < 3) return messages(language).fullName;
  return undefined;
}

export function validateEmail(value: string, language: AcademyLanguage): string | undefined {
  if (!EMAIL_REGEX.test(value.trim())) return messages(language).email;
  return undefined;
}

export function validatePhoneTn(value: string, language: AcademyLanguage): string | undefined {
  const digits = value.replace(/\D/g, '');
  if (!PHONE_TN_REGEX.test(digits)) return messages(language).phone;
  return undefined;
}

export function validatePaymentProof(
  file: File | null,
  paymentMethod: AcademyRegistrationFormData['paymentMethod'],
  language: AcademyLanguage
): string | undefined {
  if (!requiresAcademyPaymentProof(paymentMethod)) return undefined;
  if (!file) return messages(language).paymentProof;

  if (file.size > PAYMENT_PROOF_MAX_BYTES) return messages(language).paymentProofSize;

  if (!isAcademyPaymentProofFile(file)) return messages(language).paymentProofType;

  return undefined;
}

export function validateAcademyForm(
  data: AcademyRegistrationFormData,
  language: AcademyLanguage
): Partial<Record<keyof AcademyRegistrationFormData, string>> {
  const errors: Partial<Record<keyof AcademyRegistrationFormData, string>> = {};

  const fullName = validateFullName(data.fullName, language);
  if (fullName) errors.fullName = fullName;

  const email = validateEmail(data.email, language);
  if (email) errors.email = email;

  const phone = validatePhoneTn(data.phone, language);
  if (phone) errors.phone = phone;

  if (!data.formule) errors.formule = messages(language).formule;
  if (!data.paymentMethod) errors.paymentMethod = messages(language).paymentMethod;

  const paymentProof = validatePaymentProof(data.paymentProof, data.paymentMethod, language);
  if (paymentProof) errors.paymentProof = paymentProof;

  if (!data.acceptTerms) errors.acceptTerms = messages(language).acceptTerms;

  return errors;
}
