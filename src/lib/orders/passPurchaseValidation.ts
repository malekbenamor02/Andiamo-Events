/**
 * Shared validation for pass purchase wizard and order submit.
 */

import { CustomerInfo } from '@/types/orders';
import { PaymentMethod } from '@/lib/constants/orderStatuses';

export const PASS_PURCHASE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASS_PURCHASE_PHONE_REGEX = /^[2594][0-9]{7}$/;

export interface PassPurchaseValidationCopy {
  required: string;
  invalidName: string;
  invalidEmail: string;
  invalidPhone: string;
  villeRequired: string;
  emailMismatch: string;
  confirmEmailRequired: string;
  selectAtLeastOnePass: string;
  selectPaymentMethod: string;
  selectAmbassador: string;
}

export function passPurchaseValidationCopy(language: 'en' | 'fr'): PassPurchaseValidationCopy {
  return language === 'en'
    ? {
        required: 'This field is required',
        invalidName: 'Please enter a valid name',
        invalidEmail: 'Please enter a valid email',
        invalidPhone: 'Invalid phone number format',
        villeRequired: 'Please select your neighborhood',
        emailMismatch: 'Emails do not match',
        confirmEmailRequired: 'Please confirm your email',
        selectAtLeastOnePass: 'Please select at least one pass',
        selectPaymentMethod: 'Please select a payment method',
        selectAmbassador: 'Please select an ambassador',
      }
    : {
        required: 'Ce champ est requis',
        invalidName: 'Veuillez entrer un nom valide',
        invalidEmail: 'Veuillez entrer un email valide',
        invalidPhone: 'Format de numéro invalide',
        villeRequired: 'Veuillez sélectionner votre quartier',
        emailMismatch: 'Les emails ne correspondent pas',
        confirmEmailRequired: 'Veuillez confirmer votre email',
        selectAtLeastOnePass: 'Veuillez sélectionner au moins un pass',
        selectPaymentMethod: 'Veuillez sélectionner une méthode de paiement',
        selectAmbassador: 'Veuillez sélectionner un ambassadeur',
      };
}

function needsVille(city: string): boolean {
  return city === 'Sousse' || city === 'Tunis';
}

export function validatePassPurchasePasses(
  selectedPasses: Record<string, number>,
  message: string
): Record<string, string> {
  const hasSelectedPass = Object.values(selectedPasses).some((qty) => qty > 0);
  if (!hasSelectedPass) {
    return { passes: message };
  }
  return {};
}

export function validatePassPurchaseIdentity(
  customerInfo: CustomerInfo,
  copy: PassPurchaseValidationCopy
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!customerInfo.full_name.trim() || customerInfo.full_name.trim().length < 2) {
    errors.full_name = copy.invalidName;
  }
  if (!customerInfo.phone.trim() || !PASS_PURCHASE_PHONE_REGEX.test(customerInfo.phone.trim())) {
    errors.phone = copy.invalidPhone;
  }
  return errors;
}

export function validatePassPurchaseEmailStep(
  email: string,
  emailConfirm: string,
  copy: PassPurchaseValidationCopy
): Record<string, string> {
  const errors: Record<string, string> = {};
  const em = email.trim();
  if (!em || !PASS_PURCHASE_EMAIL_REGEX.test(em)) {
    errors.email = copy.invalidEmail;
  }
  const c = emailConfirm.trim();
  if (!c) {
    errors.email_confirm = copy.confirmEmailRequired;
  } else if (em && PASS_PURCHASE_EMAIL_REGEX.test(em) && em.toLowerCase() !== c.toLowerCase()) {
    errors.email_confirm = copy.emailMismatch;
  }
  return errors;
}

export function validatePassPurchaseLocation(
  customerInfo: CustomerInfo,
  copy: PassPurchaseValidationCopy
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!customerInfo.city.trim()) {
    errors.city = copy.required;
  }
  if (needsVille(customerInfo.city) && !customerInfo.ville) {
    errors.ville = copy.villeRequired;
  }
  return errors;
}

export function validatePassPurchaseCustomer(
  customerInfo: CustomerInfo,
  emailConfirm: string,
  copy: PassPurchaseValidationCopy
): Record<string, string> {
  return {
    ...validatePassPurchaseIdentity(customerInfo, copy),
    ...validatePassPurchaseEmailStep(customerInfo.email, emailConfirm, copy),
    ...validatePassPurchaseLocation(customerInfo, copy),
  };
}

export function validatePassPurchasePaymentStep(
  paymentMethod: PaymentMethod | null,
  selectedAmbassadorId: string | null,
  copy: PassPurchaseValidationCopy
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!paymentMethod) {
    errors.paymentMethod = copy.selectPaymentMethod;
  }
  if (paymentMethod === PaymentMethod.AMBASSADOR_CASH && !selectedAmbassadorId) {
    errors.ambassador = copy.selectAmbassador;
  }
  return errors;
}

export function validatePassPurchaseFull(args: {
  selectedPasses: Record<string, number>;
  customerInfo: CustomerInfo;
  emailConfirm: string;
  paymentMethod: PaymentMethod | null;
  selectedAmbassadorId: string | null;
  copy: PassPurchaseValidationCopy;
}): Record<string, string> {
  return {
    ...validatePassPurchasePasses(args.selectedPasses, args.copy.selectAtLeastOnePass),
    ...validatePassPurchaseCustomer(args.customerInfo, args.emailConfirm, args.copy),
    ...validatePassPurchasePaymentStep(args.paymentMethod, args.selectedAmbassadorId, args.copy),
  };
}

const PASS_PURCHASE_ERROR_FIELD_ORDER = [
  'passes',
  'full_name',
  'phone',
  'email',
  'email_confirm',
  'city',
  'ville',
  'paymentMethod',
  'ambassador',
] as const;

export function firstPassPurchaseErrorField(
  errors: Record<string, string>
): string | undefined {
  for (const k of PASS_PURCHASE_ERROR_FIELD_ORDER) {
    if (errors[k]) return k;
  }
  const keys = Object.keys(errors);
  return keys[0];
}

export function firstPassPurchaseErrorMessage(errors: Record<string, string>): string | undefined {
  const k = firstPassPurchaseErrorField(errors);
  return k ? errors[k] : undefined;
}
