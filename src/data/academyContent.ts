import type {
  AcademyComparisonCell,
  AcademyComparisonRow,
  AcademyFaqItem,
  AcademyFormula,
  AcademyFormulaId,
  AcademyLanguage,
  AcademyProgramModule,
  AcademyTrainerProfile,
  LocalizedText,
} from '@/types/academy';

/** UI-only cohort label (not used in SEO meta — keep evergreen in academySeo.ts) */
export const ACADEMY_COHORT_LABEL = {
  en: 'In-person — Tunis',
  fr: 'En présentiel — Tunis',
} as const;

const comparisonText = (en: string, fr: string): AcademyComparisonCell => ({
  kind: 'text',
  value: { en, fr },
});

const comparisonYes = (): AcademyComparisonCell => ({ kind: 'boolean', value: true });
const comparisonNo = (): AcademyComparisonCell => ({ kind: 'boolean', value: false });

export const ACADEMY_FORMULAS: AcademyFormula[] = [
  {
    id: 'essentielle',
    name: { en: 'Essential', fr: 'Essentielle' },
    priceDt: 850,
    seatsTotal: 12,
    seatsRemainingMock: 8,
    features: [
      { en: '20 hours of certified in-person training', fr: '20 heures de formation certifiée en présentiel' },
      { en: 'Full event management program — +7 chapters', fr: 'Programme complet Event Management — +7 chapitres' },
      { en: 'Official certificate', fr: 'Certificat officiel' },
      { en: 'Andiamo training materials & bloc-note', fr: 'Supports de formation Andiamo & bloc-note' },
      { en: 'Buffet + water every day', fr: 'Buffet + eau chaque jour' },
    ],
  },
  {
    id: 'pro',
    name: { en: 'Pro', fr: 'Pro' },
    priceDt: 1100,
    recommended: true,
    seatsTotal: 12,
    seatsRemainingMock: 5,
    features: [
      { en: 'Everything in Essential', fr: 'Tout le contenu de la formule Essentielle' },
      { en: '3-month event internship', fr: 'Stage événementiel de 3 mois' },
      { en: 'Real event rotation with Andiamo Event', fr: 'Rotation sur événements réels avec Andiamo Event' },
    ],
  },
  {
    id: 'premium',
    name: { en: 'Premium', fr: 'Premium' },
    priceDt: 2500,
    seatsTotal: 12,
    seatsRemainingMock: 3,
    features: [
      { en: 'Everything in Pro', fr: 'Tout le contenu de la formule Pro' },
      { en: 'Consulting on first event', fr: 'Conseil pour votre premier événement' },
      { en: 'Personal guidance for first event launch', fr: 'Accompagnement personnel pour le lancement de votre premier événement' },
    ],
  },
];

export const ACADEMY_COMPARISON_ROWS: AcademyComparisonRow[] = [
  {
    label: { en: 'Seats', fr: 'Places' },
    essentielle: comparisonText('12', '12'),
    pro: comparisonText('12', '12'),
    premium: comparisonText('12', '12'),
    muted: true,
  },
  {
    label: { en: '20h certified in-person training', fr: '20h formation certifiée en présentiel' },
    essentielle: comparisonYes(),
    pro: comparisonYes(),
    premium: comparisonYes(),
  },
  {
    label: { en: 'Official certificate', fr: 'Certificat officiel' },
    essentielle: comparisonYes(),
    pro: comparisonYes(),
    premium: comparisonYes(),
  },
  {
    label: { en: 'Andiamo materials', fr: 'Supports Andiamo' },
    essentielle: comparisonYes(),
    pro: comparisonYes(),
    premium: comparisonYes(),
  },
  {
    label: { en: 'Buffet + water', fr: 'Buffet + eau' },
    essentielle: comparisonYes(),
    pro: comparisonYes(),
    premium: comparisonYes(),
  },
  {
    label: { en: '3-month event internship', fr: 'Stage événementiel 3 mois' },
    essentielle: comparisonNo(),
    pro: comparisonYes(),
    premium: comparisonYes(),
  },
  {
    label: { en: 'Consulting on first event', fr: 'Conseil premier événement' },
    essentielle: comparisonNo(),
    pro: comparisonNo(),
    premium: comparisonYes(),
  },
];

export const ACADEMY_FAQ: AcademyFaqItem[] = [
  {
    id: 'recording',
    question: {
      en: 'Can I record or photograph the training?',
      fr: 'Puis-je enregistrer ou photographier la formation ?',
    },
    answer: {
      en: 'No. Recording videos or taking photos during the training is strictly prohibited to protect participants and training content.',
      fr: 'Non. L\'enregistrement vidéo et la prise de photos pendant la formation sont strictement interdits afin de protéger les participants et le contenu de la formation.',
    },
  },
  {
    id: 'format',
    question: {
      en: 'Is the training online or in person?',
      fr: 'La formation est-elle en ligne ou en présentiel ?',
    },
    answer: {
      en: 'The training is in person and will take place in Tunis.',
      fr: 'La formation se déroule en présentiel à Tunis.',
    },
  },
  {
    id: 'places',
    question: {
      en: 'How many places are available?',
      fr: 'Combien de places sont disponibles ?',
    },
    answer: {
      en: 'There are 36 places in total, divided into 3 groups of 12 participants.',
      fr: '36 places au total, réparties en 3 groupes de 12 participants.',
    },
  },
  {
    id: 'formulas',
    question: {
      en: 'What formulas are available and how much do they cost?',
      fr: 'Quelles formules sont disponibles et à quel prix ?',
    },
    answer: {
      en: 'There are 3 formulas: Essential at 850 DT, Pro at 1,100 DT, and Premium at 2,500 DT.',
      fr: '3 formules : Essentielle à 850 DT, Pro à 1 100 DT et Premium à 2 500 DT.',
    },
  },
  {
    id: 'payment',
    question: {
      en: 'How can I pay for the training?',
      fr: 'Comment puis-je payer la formation ?',
    },
    answer: {
      en: 'You can pay by D17 or by bank transfer using RIB. After payment, you must upload proof of payment.',
      fr: 'Paiement par D17 ou virement bancaire (RIB). Après paiement, vous devez téléverser une preuve de paiement.',
    },
  },
  {
    id: 'confirmation',
    question: {
      en: 'When is my place confirmed?',
      fr: 'Quand ma place est-elle confirmée ?',
    },
    answer: {
      en: 'Your place is confirmed only after the admin validates your payment proof.',
      fr: 'Votre place est confirmée uniquement après validation de votre preuve de paiement par l\'administration.',
    },
  },
  {
    id: 'cancellation',
    question: {
      en: 'What is the cancellation and refund policy?',
      fr: 'Quelle est la politique d\'annulation et de remboursement ?',
    },
    answer: {
      en: 'Cancellations must be requested in writing. Refunds depend on the timing of your request and payment status. Full policy details will be shared upon registration confirmation.',
      fr: 'Les annulations doivent être demandées par écrit. Les remboursements dépendent du délai de votre demande et du statut de paiement. Les détails complets seront communiqués lors de la confirmation d\'inscription.',
    },
  },
  {
    id: 'contact',
    question: {
      en: 'How can I contact the team?',
      fr: 'Comment contacter l\'équipe ?',
    },
    answer: {
      en: 'Reach us on Instagram @andiamoevents, by email at contact@andiamoevents.com, or by phone at +216 28 070 128.',
      fr: 'Contactez-nous sur Instagram @andiamoevents, par email à contact@andiamoevents.com, ou par téléphone au +216 28 070 128.',
    },
  },
];

export const ACADEMY_PROGRAM: {
  title: LocalizedText;
  curriculumTitle: LocalizedText;
  modules: AcademyProgramModule[];
  trainer: AcademyTrainerProfile;
} = {
  title: { en: 'Program & curriculum', fr: 'Programme & contenu' },
  curriculumTitle: { en: 'What you will learn', fr: 'Ce que vous apprenez' },
  modules: [
    {
      id: 'legal',
      title: { en: 'Legal authorizations', fr: 'Autorisations légales' },
    },
    {
      id: 'artist',
      title: { en: 'Artistic Contact', fr: 'Contact artistique' },
    },
    {
      id: 'technical',
      title: { en: 'Technical equipment', fr: 'Matériel technique' },
    },
    {
      id: 'sponsoring',
      title: { en: 'Sponsorship', fr: 'Sponsoring' },
    },
    {
      id: 'marketing',
      title: { en: 'Event marketing', fr: 'Marketing événementiel' },
    },
    {
      id: 'team',
      title: { en: 'Team management & protocol', fr: 'Gestion et protocole d\'équipe' },
    },
    {
      id: 'd-day',
      title: { en: 'D-day operations', fr: 'Organisation du Jour J' },
    },
  ],
  trainer: {
    sectionTitle: { en: 'Your trainer', fr: 'Votre formateur' },
    jobTitle: {
      en: 'CEO & Founder — Andiamo Event & Wkayet Event',
      fr: 'CEO & Fondateur — Andiamo Event & Wkayet Event',
    },
    experienceLabel: { en: 'Experience', fr: 'Expérience' },
    experience: {
      en: '+20 events managed in commercial management • 4 years in event management and marketing.',
      fr: '+20 événements gérés en management commercial • 4 ans d\'expérience en event management et marketing.',
    },
    specialtiesLabel: { en: 'Specialties', fr: 'Spécialités' },
    specialties: {
      en: 'Concerts • Festivals • Corporate events • Team management • Event marketing',
      fr: 'Concerts • Festivals • Événements corporate • Gestion d\'équipes • Marketing événementiel',
    },
    approachLabel: { en: 'Approach', fr: 'Approche' },
    approach: {
      en: 'Hands-on training + real case studies • Personalized mentoring • Post-training coaching',
      fr: 'Formation terrain + cas pratiques réels • Mentoring personnalisé • Coaching post-formation',
    },
  },
};

export const ACADEMY_UI = {
  assets: {
    trainerPhoto: '/assets/trainer.png',
    logoLight: '/assets/andiamo-academy-cropped-black.svg',
    logoDark: '/assets/andiamo-academy-cropped.svg',
    heroBackground: '/assets/background.webp',
  },
  hero: {
    titleLine1: {
      en: 'Event Management Training',
      fr: 'Formation Event Management',
    },
    titleLine2: {
      en: 'Certified & In-Person',
      fr: 'Certifiée & Présentielle',
    },
    meta: [
      { label: ACADEMY_COHORT_LABEL },
      { label: { en: '20 Hours', fr: '20 Heures' } },
      { label: { en: '36 Limited Seats', fr: '36 places limitées' } },
    ],
    cta: { en: 'Register now', fr: 'Je m\'inscris maintenant' },
    instructorName: 'Mouayed Chakir',
    instructorRole: {
      en: 'CEO & Founder — Andiamo Event & Wkayet Event',
      fr: 'CEO & Fondateur — Andiamo Event & Wkayet Event',
    },
    instructorNote: {
      en: '+20 events managed in commercial management',
      fr: '+20 événements gérés en management commercial',
    },
    academyBrand: { en: 'Andiamo Academy', fr: 'Andiamo Academy' },
  },
  pricing: {
    title: { en: 'Choose your formula', fr: 'Choisissez votre formule' },
    recommended: { en: 'Recommended', fr: 'Recommandée' },
    chooseCta: { en: 'Choose this formula', fr: 'Choisir cette formule' },
    compareTitle: { en: 'Compare formulas', fr: 'Comparer les formules' },
  },
  faq: {
    title: { en: 'FAQ & Important notices', fr: 'FAQ & Mentions importantes' },
  },
  form: {
    title: { en: 'Registration', fr: 'Inscription' },
    subtitle: {
      en: 'Complete the form below.',
      fr: 'Complétez le formulaire ci-dessous.',
    },
    fullName: { en: 'Full name', fr: 'Nom complet' },
    fullNamePlaceholder: { en: 'Your full name', fr: 'Votre nom complet' },
    email: { en: 'Email', fr: 'Email' },
    emailPlaceholder: { en: 'you@example.com', fr: 'vous@exemple.com' },
    phone: { en: 'Phone', fr: 'Téléphone' },
    formule: { en: 'Formula', fr: 'Formule' },
    formulePlaceholder: { en: 'Select a formula', fr: 'Sélectionnez une formule' },
    paymentMethod: { en: 'Payment method', fr: 'Mode de paiement' },
    paymentCard: {
      en: 'Online — credit or debit card',
      fr: 'En ligne — carte bancaire',
    },
    paymentRib: { en: 'Bank transfer (RIB)', fr: 'Virement bancaire (RIB)' },
    paymentD17: { en: 'D17', fr: 'D17' },
    paymentManualContactCallout: {
      en: 'To complete your payment, please contact Andiamo Events at +216 28 070 128. Our team will provide you with the RIB or D17 details.',
      fr: 'Pour finaliser votre paiement, veuillez contacter Andiamo Events au +216 28 070 128. Notre équipe vous communiquera le RIB ou le numéro D17.',
    },
    paymentProof: { en: 'Payment proof', fr: 'Justificatif de paiement' },
    paymentProofHint: {
      en: 'JPG, PNG, WebP, GIF, or PDF only (max 5 MB)',
      fr: 'JPG, PNG, WebP, GIF ou PDF uniquement (max 5 Mo)',
    },
    paymentProofDrop: {
      en: 'Drop your file here or click to browse',
      fr: 'Déposez votre fichier ici ou cliquez pour parcourir',
    },
    paymentProofRemove: { en: 'Remove', fr: 'Retirer' },
    promoCode: { en: 'Promo / club code (optional)', fr: 'Code promo / club (optionnel)' },
    acceptTerms: {
      en: 'I accept the training terms and conditions',
      fr: 'J\'accepte le règlement de la formation',
    },
    submit: { en: 'Submit registration', fr: 'Envoyer l\'inscription' },
    summaryTitle: { en: 'Your selection', fr: 'Votre sélection' },
    amountLabel: { en: 'Total amount (100% deposit)', fr: 'Montant total (acompte 100%)' },
    noFormula: { en: 'No formula selected', fr: 'Aucune formule sélectionnée' },
    mockSubmitTitle: { en: 'Coming soon', fr: 'Bientôt disponible' },
    mockSubmitDescription: {
      en: 'Online registration will be available shortly. Thank you for your interest!',
      fr: 'L\'inscription en ligne sera bientôt disponible. Merci pour votre intérêt !',
    },
  },
  validation: {
    en: {
      fullName: 'Full name must be at least 3 characters',
      email: 'Please enter a valid email address',
      phone: 'Please enter a valid phone number',
      formule: 'Please select a formula',
      paymentMethod: 'Please select a payment method',
      paymentProof: 'Please upload your payment proof',
      paymentProofSize: 'Payment proof must be 5 MB or smaller',
      paymentProofType: 'Please upload an image (JPG, PNG) or PDF',
      acceptTerms: 'You must accept the terms and conditions',
    },
    fr: {
      fullName: 'Le nom complet doit contenir au moins 3 caractères',
      email: 'Veuillez entrer une adresse email valide',
      phone: 'Veuillez entrer un numéro de téléphone valide',
      formule: 'Veuillez sélectionner une formule',
      paymentMethod: 'Veuillez sélectionner un mode de paiement',
      paymentProof: 'Veuillez téléverser votre justificatif de paiement',
      paymentProofSize: 'Le justificatif doit faire 5 Mo ou moins',
      paymentProofType: 'Veuillez téléverser une image (JPG, PNG) ou un PDF',
      acceptTerms: 'Vous devez accepter le règlement',
    },
  },
} as const;

export function getFormulaById(id: AcademyFormulaId): AcademyFormula | undefined {
  return ACADEMY_FORMULAS.find((f) => f.id === id);
}

export function getFormulaPrice(id: AcademyFormulaId): number {
  return getFormulaById(id)?.priceDt ?? 0;
}

export type AcademyValidationMessages = (typeof ACADEMY_UI.validation)[AcademyLanguage];
