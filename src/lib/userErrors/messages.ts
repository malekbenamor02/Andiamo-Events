import { PUBLIC_ERROR_CODES, type PublicErrorCode } from './publicErrorCodes';

export type UserLanguage = 'en' | 'fr';

export interface PublicErrorCopy {
  title: string;
  description: string;
}

type CopyMap = Record<PublicErrorCode, PublicErrorCopy>;

const EN: CopyMap = {
  [PUBLIC_ERROR_CODES.PASSES_UNAVAILABLE]: {
    title: "Couldn't load tickets",
    description:
      "We couldn't load passes for this event. Please refresh the page or try again later.",
  },
  [PUBLIC_ERROR_CODES.EVENT_NOT_FOUND]: {
    title: 'Event unavailable',
    description: 'This event is no longer available.',
  },
  [PUBLIC_ERROR_CODES.SERVICE_UNAVAILABLE]: {
    title: 'Something went wrong',
    description:
      'Something went wrong on our side. Please try again in a few minutes. If the problem continues, contact us.',
  },
  [PUBLIC_ERROR_CODES.INVALID_PROMO_CODE]: {
    title: 'Invalid promo code',
    description: "This promo code isn't valid for your order.",
  },
  [PUBLIC_ERROR_CODES.INSUFFICIENT_STOCK]: {
    title: 'Not enough passes left',
    description: 'Not enough passes are left for your selection. Please adjust your order.',
  },
  [PUBLIC_ERROR_CODES.PAYMENT_UNAVAILABLE]: {
    title: 'Payment unavailable',
    description: "Online payment isn't available right now. Please try again or contact us.",
  },
  [PUBLIC_ERROR_CODES.PRESALE_CODE_INVALID]: {
    title: 'Invalid presale code',
    description: "That presale code isn't valid. Check it and try again.",
  },
  [PUBLIC_ERROR_CODES.PRESALE_UNAVAILABLE]: {
    title: 'Presale unavailable',
    description: "Presale access isn't available right now. Please try again later.",
  },
  [PUBLIC_ERROR_CODES.PRESALE_ACCESS_REQUIRED]: {
    title: 'Presale code required',
    description: 'Enter your presale code to unlock ticket selection.',
  },
  [PUBLIC_ERROR_CODES.RATE_LIMITED]: {
    title: 'Too many attempts',
    description: 'Please wait a moment and try again.',
  },
  [PUBLIC_ERROR_CODES.VALIDATION_FAILED]: {
    title: 'Check your details',
    description: 'Please check the form and try again.',
  },
  [PUBLIC_ERROR_CODES.RECAPTCHA_FAILED]: {
    title: 'Verification failed',
    description: 'Security verification failed. Please try again.',
  },
  [PUBLIC_ERROR_CODES.ORDER_NOT_FOUND]: {
    title: 'Order not found',
    description: 'We could not find this order.',
  },
  [PUBLIC_ERROR_CODES.PAYMENT_FAILED]: {
    title: 'Payment failed',
    description:
      'Your payment could not be completed. Please try again or choose another payment method.',
  },
  [PUBLIC_ERROR_CODES.PAYMENT_UNKNOWN]: {
    title: "Couldn't confirm payment",
    description:
      'We could not confirm your payment. If you were charged, please wait for confirmation or contact us.',
  },
  [PUBLIC_ERROR_CODES.INVALID_REQUEST]: {
    title: 'Invalid request',
    description: 'This request could not be processed.',
  },
  [PUBLIC_ERROR_CODES.EVENT_NOT_AVAILABLE]: {
    title: 'Sales closed',
    description: 'Pass sales are closed for this event.',
  },
  [PUBLIC_ERROR_CODES.PASS_NOT_AVAILABLE]: {
    title: 'Pass unavailable',
    description: 'One or more selected passes are no longer available.',
  },
  [PUBLIC_ERROR_CODES.PAYMENT_METHOD_NOT_ALLOWED]: {
    title: 'Payment method not allowed',
    description: 'The selected payment method is not available for one of your passes.',
  },
  [PUBLIC_ERROR_CODES.AMBASSADOR_NOT_FOUND]: {
    title: 'Ambassador unavailable',
    description: 'The selected ambassador is no longer available.',
  },
  [PUBLIC_ERROR_CODES.AMBASSADOR_UNAVAILABLE]: {
    title: 'Ambassador unavailable',
    description: 'The selected ambassador cannot receive new orders right now.',
  },
  [PUBLIC_ERROR_CODES.TOO_MANY_ORDERS]: {
    title: 'Too many attempts',
    description: 'Too many orders. Please try again later.',
  },
  [PUBLIC_ERROR_CODES.INVALID_ACCESS]: {
    title: 'Access denied',
    description: 'You do not have access to complete this action.',
  },
  [PUBLIC_ERROR_CODES.ACADEMY_SOLD_OUT]: {
    title: 'Academy full',
    description: 'Academy registration is full.',
  },
  [PUBLIC_ERROR_CODES.ACADEMY_CLOSED]: {
    title: 'Registrations closed',
    description: 'Academy registrations are currently closed.',
  },
  [PUBLIC_ERROR_CODES.REGISTRATION_EXPIRED]: {
    title: 'Registration expired',
    description: 'Your registration was not completed in time. Please register again.',
  },
  [PUBLIC_ERROR_CODES.REGISTRATION_NOT_FOUND]: {
    title: 'Registration not found',
    description: 'We could not find this registration.',
  },
  [PUBLIC_ERROR_CODES.SUBMISSION_FAILED]: {
    title: 'Submission failed',
    description: 'Your submission could not be sent. Please try again.',
  },
  [PUBLIC_ERROR_CODES.DUPLICATE_APPLICATION]: {
    title: 'Already applied',
    description: 'An application with these details already exists for this position.',
  },
  [PUBLIC_ERROR_CODES.FORM_UNAVAILABLE]: {
    title: 'Form unavailable',
    description: 'This form is not available right now.',
  },
  [PUBLIC_ERROR_CODES.GENERIC]: {
    title: 'Something went wrong',
    description: 'An unexpected error occurred. Please try again.',
  },
  [PUBLIC_ERROR_CODES.NETWORK]: {
    title: 'Unable to load this page',
    description:
      "We're having trouble reaching our servers. Please check your internet connection and reload the page. If the issue continues, try again in a few minutes.",
  },
};

const FR: CopyMap = {
  [PUBLIC_ERROR_CODES.PASSES_UNAVAILABLE]: {
    title: 'Passes indisponibles',
    description:
      "Impossible de charger les passes pour cet événement. Actualisez la page ou réessayez plus tard.",
  },
  [PUBLIC_ERROR_CODES.EVENT_NOT_FOUND]: {
    title: 'Événement indisponible',
    description: "Cet événement n'est plus disponible.",
  },
  [PUBLIC_ERROR_CODES.SERVICE_UNAVAILABLE]: {
    title: 'Une erreur est survenue',
    description:
      'Une erreur est survenue de notre côté. Réessayez dans quelques minutes. Si le problème persiste, contactez-nous.',
  },
  [PUBLIC_ERROR_CODES.INVALID_PROMO_CODE]: {
    title: 'Code promo invalide',
    description: "Ce code promo n'est pas valide pour votre commande.",
  },
  [PUBLIC_ERROR_CODES.INSUFFICIENT_STOCK]: {
    title: 'Stock insuffisant',
    description: 'Il ne reste pas assez de passes pour votre sélection. Modifiez votre commande.',
  },
  [PUBLIC_ERROR_CODES.PAYMENT_UNAVAILABLE]: {
    title: 'Paiement indisponible',
    description:
      "Le paiement en ligne n'est pas disponible pour le moment. Réessayez ou contactez-nous.",
  },
  [PUBLIC_ERROR_CODES.PRESALE_CODE_INVALID]: {
    title: 'Code prévente invalide',
    description: "Ce code prévente n'est pas valide. Vérifiez-le et réessayez.",
  },
  [PUBLIC_ERROR_CODES.PRESALE_UNAVAILABLE]: {
    title: 'Prévente indisponible',
    description: "L'accès prévente n'est pas disponible pour le moment. Réessayez plus tard.",
  },
  [PUBLIC_ERROR_CODES.PRESALE_ACCESS_REQUIRED]: {
    title: 'Code prévente requis',
    description: 'Entrez votre code prévente pour débloquer la sélection des passes.',
  },
  [PUBLIC_ERROR_CODES.RATE_LIMITED]: {
    title: 'Trop de tentatives',
    description: 'Veuillez patienter un moment et réessayer.',
  },
  [PUBLIC_ERROR_CODES.VALIDATION_FAILED]: {
    title: 'Vérifiez vos informations',
    description: 'Veuillez vérifier le formulaire et réessayer.',
  },
  [PUBLIC_ERROR_CODES.RECAPTCHA_FAILED]: {
    title: 'Vérification échouée',
    description: 'La vérification de sécurité a échoué. Veuillez réessayer.',
  },
  [PUBLIC_ERROR_CODES.ORDER_NOT_FOUND]: {
    title: 'Commande introuvable',
    description: 'Nous n\'avons pas trouvé cette commande.',
  },
  [PUBLIC_ERROR_CODES.PAYMENT_FAILED]: {
    title: 'Paiement échoué',
    description:
      'Votre paiement n\'a pas pu être traité. Réessayez ou choisissez un autre mode de paiement.',
  },
  [PUBLIC_ERROR_CODES.PAYMENT_UNKNOWN]: {
    title: 'Paiement non confirmé',
    description:
      'Nous n\'avons pas pu confirmer votre paiement. Si vous avez été débité, attendez la confirmation ou contactez-nous.',
  },
  [PUBLIC_ERROR_CODES.INVALID_REQUEST]: {
    title: 'Requête invalide',
    description: 'Cette requête n\'a pas pu être traitée.',
  },
  [PUBLIC_ERROR_CODES.EVENT_NOT_AVAILABLE]: {
    title: 'Ventes fermées',
    description: 'La vente des passes est fermée pour cet événement.',
  },
  [PUBLIC_ERROR_CODES.PASS_NOT_AVAILABLE]: {
    title: 'Pass indisponible',
    description: 'Un ou plusieurs passes sélectionnés ne sont plus disponibles.',
  },
  [PUBLIC_ERROR_CODES.PAYMENT_METHOD_NOT_ALLOWED]: {
    title: 'Mode de paiement non autorisé',
    description: 'Le mode de paiement sélectionné n\'est pas disponible pour l\'un de vos passes.',
  },
  [PUBLIC_ERROR_CODES.AMBASSADOR_NOT_FOUND]: {
    title: 'Ambassadeur indisponible',
    description: "L'ambassadeur sélectionné n'est plus disponible.",
  },
  [PUBLIC_ERROR_CODES.AMBASSADOR_UNAVAILABLE]: {
    title: 'Ambassadeur indisponible',
    description: "L'ambassadeur sélectionné ne peut pas recevoir de nouvelles commandes pour le moment.",
  },
  [PUBLIC_ERROR_CODES.TOO_MANY_ORDERS]: {
    title: 'Trop de tentatives',
    description: 'Trop de commandes. Veuillez réessayer plus tard.',
  },
  [PUBLIC_ERROR_CODES.INVALID_ACCESS]: {
    title: 'Accès refusé',
    description: 'Vous n\'avez pas accès à cette action.',
  },
  [PUBLIC_ERROR_CODES.ACADEMY_SOLD_OUT]: {
    title: 'Academy complet',
    description: 'Les inscriptions à l\'Academy sont complètes.',
  },
  [PUBLIC_ERROR_CODES.ACADEMY_CLOSED]: {
    title: 'Inscriptions fermées',
    description: 'Les inscriptions à l\'Academy sont actuellement fermées.',
  },
  [PUBLIC_ERROR_CODES.REGISTRATION_EXPIRED]: {
    title: 'Inscription expirée',
    description: 'Votre inscription n\'a pas été finalisée à temps. Veuillez vous réinscrire.',
  },
  [PUBLIC_ERROR_CODES.REGISTRATION_NOT_FOUND]: {
    title: 'Inscription introuvable',
    description: 'Nous n\'avons pas trouvé cette inscription.',
  },
  [PUBLIC_ERROR_CODES.SUBMISSION_FAILED]: {
    title: 'Échec de l\'envoi',
    description: 'Votre envoi n\'a pas pu être transmis. Veuillez réessayer.',
  },
  [PUBLIC_ERROR_CODES.DUPLICATE_APPLICATION]: {
    title: 'Candidature existante',
    description: 'Une candidature avec ces informations existe déjà pour ce poste.',
  },
  [PUBLIC_ERROR_CODES.FORM_UNAVAILABLE]: {
    title: 'Formulaire indisponible',
    description: 'Ce formulaire n\'est pas disponible pour le moment.',
  },
  [PUBLIC_ERROR_CODES.GENERIC]: {
    title: 'Une erreur est survenue',
    description: 'Une erreur inattendue s\'est produite. Veuillez réessayer.',
  },
  [PUBLIC_ERROR_CODES.NETWORK]: {
    title: 'Impossible de charger cette page',
    description:
      "Nous n'arrivons pas à joindre nos serveurs. Vérifiez votre connexion Internet et rechargez la page. Si le problème persiste, réessayez dans quelques minutes.",
  },
};

export function getPublicErrorCopy(code: PublicErrorCode, language: UserLanguage): PublicErrorCopy {
  const map = language === 'fr' ? FR : EN;
  return map[code] ?? map[PUBLIC_ERROR_CODES.GENERIC];
}

/** Presale API `reason` → public error code */
export const PRESALE_REASON_TO_CODE: Record<string, PublicErrorCode> = {
  missing_service_role: PUBLIC_ERROR_CODES.PRESALE_UNAVAILABLE,
  captcha_failed: PUBLIC_ERROR_CODES.RECAPTCHA_FAILED,
  presale_off: PUBLIC_ERROR_CODES.PRESALE_UNAVAILABLE,
  event_not_found: PUBLIC_ERROR_CODES.EVENT_NOT_FOUND,
  presale_dates_missing: PUBLIC_ERROR_CODES.PRESALE_UNAVAILABLE,
  presale_not_started: PUBLIC_ERROR_CODES.PRESALE_UNAVAILABLE,
  presale_ended: PUBLIC_ERROR_CODES.PRESALE_UNAVAILABLE,
  code_not_found: PUBLIC_ERROR_CODES.PRESALE_CODE_INVALID,
  code_not_active_yet: PUBLIC_ERROR_CODES.PRESALE_CODE_INVALID,
  code_expired: PUBLIC_ERROR_CODES.PRESALE_CODE_INVALID,
  code_exhausted: PUBLIC_ERROR_CODES.PRESALE_CODE_INVALID,
  session_create_failed: PUBLIC_ERROR_CODES.SERVICE_UNAVAILABLE,
  server_error: PUBLIC_ERROR_CODES.SERVICE_UNAVAILABLE,
  rate_limited: PUBLIC_ERROR_CODES.RATE_LIMITED,
  server_misconfigured: PUBLIC_ERROR_CODES.PRESALE_UNAVAILABLE,
};
