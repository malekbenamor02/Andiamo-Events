// TODO: Replace feature bullets and ACADEMY_COMPARISON_ROWS with Section 4 comparative table from formation doc.

import type {
  AcademyChapter,
  AcademyComparisonRow,
  AcademyFaqItem,
  AcademyFormula,
  AcademyFormulaId,
  AcademyLanguage,
  LocalizedText,
} from '@/types/academy';

export const ACADEMY_FORMULAS: AcademyFormula[] = [
  {
    id: 'essentielle',
    name: { en: 'Essential', fr: 'Essentielle' },
    priceDt: 850,
    seatsTotal: 12,
    seatsRemainingMock: 8,
    features: [
      { en: '20 hours of certified in-person training', fr: '20 heures de formation certifiée en présentiel' },
      { en: 'Full event management program (7 chapters)', fr: 'Programme complet Event Management (7 chapitres)' },
      { en: 'Training materials and workbook', fr: 'Supports de cours et workbook' },
      { en: 'Certificate of completion', fr: 'Attestation de fin de formation' },
      { en: 'Access to class group (12 participants max)', fr: 'Accès au groupe classe (12 participants max)' },
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
      { en: 'Practical case studies with real event scenarios', fr: 'Études de cas pratiques sur des événements réels' },
      { en: '1-on-1 feedback session with the trainer', fr: 'Session de feedback individuelle avec le formateur' },
      { en: 'Event planning templates (budget, timeline, checklist)', fr: 'Templates de planification (budget, planning, checklist)' },
      { en: 'Priority support during training days', fr: 'Support prioritaire pendant les jours de formation' },
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
      { en: 'VIP small-group coaching (max 12)', fr: 'Coaching VIP en petit groupe (max 12)' },
      { en: 'Post-training mentorship follow-up (30 days)', fr: 'Suivi mentorat post-formation (30 jours)' },
      { en: 'Andiamo Event network introduction', fr: 'Introduction au réseau Andiamo Event' },
      { en: 'Certificate of excellence + LinkedIn recommendation', fr: 'Certificat d\'excellence + recommandation LinkedIn' },
    ],
  },
];

export const ACADEMY_COMPARISON_ROWS: AcademyComparisonRow[] = [
  {
    label: { en: '20h certified in-person training', fr: '20h formation certifiée présentiel' },
    essentielle: true,
    pro: true,
    premium: true,
  },
  {
    label: { en: '7-chapter full program', fr: 'Programme complet 7 chapitres' },
    essentielle: true,
    pro: true,
    premium: true,
  },
  {
    label: { en: 'Certificate of completion', fr: 'Attestation de fin de formation' },
    essentielle: true,
    pro: true,
    premium: true,
  },
  {
    label: { en: 'Practical case studies', fr: 'Études de cas pratiques' },
    essentielle: false,
    pro: true,
    premium: true,
  },
  {
    label: { en: '1-on-1 trainer feedback', fr: 'Feedback individuel formateur' },
    essentielle: false,
    pro: true,
    premium: true,
  },
  {
    label: { en: 'Event planning templates', fr: 'Templates de planification' },
    essentielle: false,
    pro: true,
    premium: true,
  },
  {
    label: { en: '30-day post-training mentorship', fr: 'Mentorat post-formation 30 jours' },
    essentielle: false,
    pro: false,
    premium: true,
  },
  {
    label: { en: 'Andiamo network introduction', fr: 'Introduction réseau Andiamo' },
    essentielle: false,
    pro: false,
    premium: true,
  },
  {
    label: { en: 'Certificate of excellence', fr: 'Certificat d\'excellence' },
    essentielle: false,
    pro: false,
    premium: true,
  },
];

export const ACADEMY_CHAPTERS: AcademyChapter[] = [
  {
    number: 1,
    title: { en: 'Introduction to Event Management', fr: 'Introduction à l\'Event Management' },
    description: {
      en: 'Industry landscape, roles, and the event lifecycle from concept to closure.',
      fr: 'Panorama du secteur, rôles et cycle de vie d\'un événement de la conception à la clôture.',
    },
    tags: [
      { en: 'Industry', fr: 'Secteur' },
      { en: 'Roles', fr: 'Rôles' },
      { en: 'Lifecycle', fr: 'Cycle de vie' },
    ],
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=900&q=80',
  },
  {
    number: 2,
    title: { en: 'Concept & Creative Direction', fr: 'Concept & Direction créative' },
    description: {
      en: 'Building a strong event identity, theme, and guest experience vision.',
      fr: 'Construire une identité forte, un thème et une vision d\'expérience invité.',
    },
    tags: [
      { en: 'Identity', fr: 'Identité' },
      { en: 'Theme', fr: 'Thème' },
      { en: 'Experience', fr: 'Expérience' },
    ],
    image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=900&q=80',
  },
  {
    number: 3,
    title: { en: 'Planning & Operations', fr: 'Planification & Opérations' },
    description: {
      en: 'Timelines, logistics, vendors, and on-site operational readiness.',
      fr: 'Planning, logistique, prestataires et préparation opérationnelle sur site.',
    },
    tags: [
      { en: 'Logistics', fr: 'Logistique' },
      { en: 'Vendors', fr: 'Prestataires' },
      { en: 'Operations', fr: 'Opérations' },
    ],
    image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=900&q=80',
  },
  {
    number: 4,
    title: { en: 'Budget & Financial Management', fr: 'Budget & Gestion financière' },
    description: {
      en: 'Cost structure, sponsorship, ticketing economics, and margin control.',
      fr: 'Structure des coûts, sponsoring, économie billetterie et maîtrise des marges.',
    },
    tags: [
      { en: 'Budget', fr: 'Budget' },
      { en: 'Sponsoring', fr: 'Sponsoring' },
      { en: 'Ticketing', fr: 'Billetterie' },
    ],
    image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=900&q=80',
  },
  {
    number: 5,
    title: { en: 'Marketing & Promotion', fr: 'Marketing & Promotion' },
    description: {
      en: 'Digital strategy, community building, and conversion for event launches.',
      fr: 'Stratégie digitale, communauté et conversion pour le lancement d\'événements.',
    },
    tags: [
      { en: 'Digital', fr: 'Digital' },
      { en: 'Community', fr: 'Communauté' },
      { en: 'Launch', fr: 'Lancement' },
    ],
    image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=900&q=80',
  },
  {
    number: 6,
    title: { en: 'Production & On-Site Execution', fr: 'Production & Exécution sur site' },
    description: {
      en: 'Technical production, team coordination, and live event problem-solving.',
      fr: 'Production technique, coordination d\'équipe et résolution de problèmes en live.',
    },
    tags: [
      { en: 'Production', fr: 'Production' },
      { en: 'Team', fr: 'Équipe' },
      { en: 'On-site', fr: 'Sur site' },
    ],
    image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=900&q=80',
  },
  {
    number: 7,
    title: { en: 'Post-Event & Growth', fr: 'Post-événement & Croissance' },
    description: {
      en: 'Debrief, reporting, retention, and scaling your event brand.',
      fr: 'Debrief, reporting, fidélisation et développement de votre marque événementielle.',
    },
    tags: [
      { en: 'Debrief', fr: 'Debrief' },
      { en: 'Reporting', fr: 'Reporting' },
      { en: 'Growth', fr: 'Croissance' },
    ],
    image: 'https://images.unsplash.com/photo-1515169069816-ef7c2a9f792b?w=900&q=80',
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
      en: 'There are 3 formulas: Essentielle at 850 DT, Pro at 1,100 DT, and Premium at 2,500 DT.',
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
      en: 'Reach us on Instagram @andiamoevents, by email at contact@andiamoevents.com, or by phone at +216 24 508 245.',
      fr: 'Contactez-nous sur Instagram @andiamoevents, par email à contact@andiamoevents.com, ou par téléphone au +216 24 508 245.',
    },
  },
];

export const ACADEMY_UI = {
  assets: {
    instructorPhoto: '/assets/trainer-image.jpg',
    logoLight: '/assets/andiamo-academy-cropped-black.svg',
    logoDark: '/assets/andiamo-academy-cropped.svg',
    heroBackground: '/assets/background.png',
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
      { label: { en: 'July 2025', fr: 'Juillet 2025' } },
      { label: { en: '20 Hours', fr: '20 Heures' } },
      { label: { en: '36 Limited Seats', fr: '36 places limitées' } },
    ],
    cta: { en: 'Register now', fr: 'Je m\'inscris maintenant' },
    instructorName: 'Mouayed Chakir',
    instructorRole: {
      en: 'Founder Andiamo Event & Wkayet Event',
      fr: 'Fondateur Andiamo Event & Wkayet Event',
    },
    instructorNote: {
      en: '+20 events organized',
      fr: '+20 événements organisés',
    },
    academyBrand: { en: 'Andiamo Academy', fr: 'Andiamo Academy' },
  },
  pricing: {
    title: { en: 'Choose your formula', fr: 'Choisissez votre formule' },
    recommended: { en: 'Recommended', fr: 'Recommandée' },
    chooseCta: { en: 'Choose this formula', fr: 'Choisir cette formule' },
    compareTitle: { en: 'Compare formulas', fr: 'Comparer les formules' },
  },
  program: {
    title: { en: 'Program & Chapters', fr: 'Programme & Chapitres' },
    chapterBadge: { en: 'Chapter', fr: 'Chapitre' },
    scrollHint: {
      en: 'Scroll to explore each chapter',
      fr: 'Faites défiler pour explorer chaque chapitre',
    },
    instructorTitle: { en: 'Your trainer', fr: 'Votre formateur' },
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
