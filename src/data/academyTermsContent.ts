import type { AcademyLanguage, LocalizedText } from '@/types/academy';

export type AcademyTermsBlock =
  | { type: 'p'; text: LocalizedText }
  | { type: 'ul'; items: LocalizedText[] };

export interface AcademyTermsSection {
  title: LocalizedText;
  blocks: AcademyTermsBlock[];
}

export const ACADEMY_TERMS_UI = {
  metaTitle: { en: 'Training terms', fr: 'Règlement de la formation' },
  title: { en: 'Training terms & conditions', fr: 'Règlement de la formation' },
  subtitle: {
    en: 'Andiamo Academy — Event Management training',
    fr: 'Andiamo Academy — Formation Event Management',
  },
  lastUpdated: { en: 'May 2026', fr: 'Mai 2026' },
  summaryTitle: { en: 'Summary', fr: 'Résumé' },
  summary: {
    en: 'By registering, you agree to provide accurate information, respect the academy rules, and complete payment to confirm your place. Online card payments are confirmed automatically. D17 and bank transfer payments require proof of payment and manual validation by the Andiamo team. Photos and videos are strictly prohibited during the training.',
    fr: 'En vous inscrivant, vous acceptez de fournir des informations exactes, de respecter le règlement de l\'académie et de finaliser le paiement pour confirmer votre place. Les paiements par carte en ligne sont confirmés automatiquement. Les paiements D17 et virement bancaire nécessitent un justificatif et une validation manuelle par l\'équipe Andiamo. Les photos et vidéos sont strictement interdites pendant la formation.',
  },
  backAcademy: { en: 'Back to Academy', fr: 'Retour à l\'Académie' },
  backRegister: { en: 'Go to registration', fr: 'Aller à l\'inscription' },
  lastUpdatedLabel: { en: 'Last updated', fr: 'Dernière mise à jour' },
} as const;

export const ACADEMY_TERMS_SECTIONS: AcademyTermsSection[] = [
  {
    title: { en: '1. Registration', fr: '1. Inscription' },
    blocks: [
      {
        type: 'p',
        text: {
          en: 'Registration is completed online through the official training page. Participants must provide accurate personal information, including full name, email, phone number, selected formula, and payment method.',
          fr: 'L\'inscription s\'effectue en ligne via la page officielle de la formation. Les participants doivent fournir des informations personnelles exactes : nom complet, email, téléphone, formule choisie et mode de paiement.',
        },
      },
    ],
  },
  {
    title: { en: '2. Limited places', fr: '2. Places limitées' },
    blocks: [
      {
        type: 'p',
        text: {
          en: 'Places are limited to 36 participants, divided into 3 groups of 12 participants. Availability is limited and places are assigned based on confirmed payment.',
          fr: 'Les places sont limitées à 36 participants, répartis en 3 groupes de 12. Les disponibilités sont limitées et les places sont attribuées selon la confirmation du paiement.',
        },
      },
    ],
  },
  {
    title: { en: '3. Payment methods', fr: '3. Modes de paiement' },
    blocks: [
      {
        type: 'p',
        text: { en: 'The accepted payment methods are:', fr: 'Les modes de paiement acceptés sont :' },
      },
      {
        type: 'ul',
        items: [
          { en: 'Online payment by debit or credit card', fr: 'Paiement en ligne par carte bancaire' },
          { en: 'D17', fr: 'D17' },
          { en: 'Bank transfer', fr: 'Virement bancaire' },
        ],
      },
    ],
  },
  {
    title: { en: '4. Payment confirmation', fr: '4. Confirmation du paiement' },
    blocks: [
      {
        type: 'p',
        text: {
          en: 'For online payment by debit or credit card, confirmation is automatic once the payment is successfully completed.',
          fr: 'Pour le paiement en ligne par carte bancaire, la confirmation est automatique une fois le paiement effectué avec succès.',
        },
      },
      {
        type: 'p',
        text: {
          en: 'For D17 and bank transfer, confirmation is manual. The participant must upload proof of payment, and the Andiamo team will validate it.',
          fr: 'Pour D17 et le virement bancaire, la confirmation est manuelle. Le participant doit téléverser un justificatif de paiement, puis l\'équipe Andiamo le valide.',
        },
      },
    ],
  },
  {
    title: { en: '5. Place confirmation', fr: '5. Confirmation de la place' },
    blocks: [
      {
        type: 'p',
        text: {
          en: 'A participant\'s place is confirmed only after payment confirmation:',
          fr: 'La place d\'un participant n\'est confirmée qu\'après validation du paiement :',
        },
      },
      {
        type: 'ul',
        items: [
          { en: 'Online card payment: place confirmed automatically', fr: 'Carte en ligne : place confirmée automatiquement' },
          { en: 'D17: place confirmed after admin validation', fr: 'D17 : place confirmée après validation admin' },
          { en: 'Bank transfer: place confirmed after admin validation', fr: 'Virement bancaire : place confirmée après validation admin' },
        ],
      },
    ],
  },
  {
    title: { en: '6. Proof of payment', fr: '6. Justificatif de paiement' },
    blocks: [
      {
        type: 'p',
        text: {
          en: 'For D17 and bank transfer, participants must upload a valid proof of payment, such as a screenshot or transfer receipt.',
          fr: 'Pour D17 et le virement bancaire, les participants doivent téléverser un justificatif de paiement valide (capture d\'écran ou reçu de virement).',
        },
      },
    ],
  },
  {
    title: { en: '7. No photo or video recording', fr: '7. Interdiction photo et vidéo' },
    blocks: [
      {
        type: 'p',
        text: {
          en: 'Recording videos or taking photos during the training is strictly prohibited to protect participants, training content, and proprietary material.',
          fr: 'L\'enregistrement vidéo ou la prise de photos pendant la formation est strictement interdit afin de protéger les participants, le contenu pédagogique et le matériel propriétaire.',
        },
      },
    ],
  },
  {
    title: { en: '8. Cancellation and refund policy', fr: '8. Annulation et remboursement' },
    blocks: [
      {
        type: 'p',
        text: {
          en: 'Cancellations must be requested in writing. Refunds depend on the timing of the request, payment status, and the academy\'s refund policy.',
          fr: 'Les annulations doivent être demandées par écrit. Les remboursements dépendent du délai de la demande, du statut du paiement et de la politique de remboursement de l\'académie.',
        },
      },
    ],
  },
  {
    title: { en: '9. Promo codes', fr: '9. Codes promo' },
    blocks: [
      {
        type: 'p',
        text: {
          en: 'Promo or club codes may be available. If a valid code is used, the discount is applied according to the academy\'s conditions.',
          fr: 'Des codes promo ou club peuvent être disponibles. Si un code valide est utilisé, la réduction est appliquée selon les conditions de l\'académie.',
        },
      },
    ],
  },
  {
    title: { en: '10. Contact', fr: '10. Contact' },
    blocks: [
      {
        type: 'p',
        text: {
          en: 'For any questions, participants can contact the team through Instagram @andiamoevents, by email at contact@andiamoevents.com, or by phone at +216 24 508 245.',
          fr: 'Pour toute question, les participants peuvent contacter l\'équipe sur Instagram @andiamoevents, par email à contact@andiamoevents.com, ou par téléphone au +216 24 508 245.',
        },
      },
    ],
  },
];
