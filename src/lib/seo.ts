/**
 * SEO constants – single source for canonical base URL and default OG image.
 * Performing brand queries (from Search Console) are reinforced in index.html keywords
 * and JsonLd alternateName for WebSite/Organization.
 */
export const SITE_URL = "https://www.andiamoevents.com";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

/** Brand/search query variations (including typo "indiamo") – used in structured data alternateName */
export const BRAND_ALTERNATE_NAMES = [
  "Andiamo Events Tunisia",
  "Andiamo",
  "Andiamo Event",
  "Andiamo Experience",
  "Andiamoevent",
  "Indiamo",
] as const;

/** Default site description – index.html, manifest, and site-wide JsonLd only */
export const DEFAULT_SITE_DESCRIPTION =
  "Andiamo Events – Tunisia's youth-driven event label by Born To Lead. Innovative, inspiring concerts, festivals and cultural events in Tunis, Sousse and beyond. We create memories.";

/** Per-page meta descriptions (SEO only). 150–160 chars recommended. */
export const PAGE_DESCRIPTIONS = {
  home: {
    en: DEFAULT_SITE_DESCRIPTION,
    fr: "Andiamo Events – label événementiel porté par la jeunesse (Born To Lead). Concerts, festivals et événements culturels à Tunis, Sousse et en Tunisie. We create memories.",
  },
  events: {
    en: "Upcoming concerts, festivals and events in Tunis, Sousse and across Tunisia. Browse dates, venues and secure your tickets with Andiamo Events.",
    fr: "Concerts, festivals et événements à venir à Tunis, Sousse et en Tunisie. Consultez dates, lieux et réservez vos billets avec Andiamo Events.",
  },
  about: {
    en: "Andiamo Events by Born To Lead — Tunisia's youth-driven event label. Modern production, cultural events and inspiring experiences nationwide. We create memories.",
    fr: "Andiamo Events par Born To Lead — label événementiel porté par la jeunesse. Production moderne et expériences culturelles à travers la Tunisie. We create memories.",
  },
  contact: {
    en: "Contact Andiamo Events for tickets, partnerships and customer support. Our team in Tunisia is ready to help with your inquiries.",
    fr: "Contactez Andiamo Events pour billets, partenariats et assistance. Notre équipe en Tunisie répond à vos demandes.",
  },
  terms: {
    en: "Andiamo Events terms and conditions of sale. Tickets, payment, QR code access and event rules for purchases in Tunisia.",
    fr: "Conditions générales de vente Andiamo Events. Billets, paiement, accès QR et règles d'événements pour vos achats en Tunisie.",
  },
  ambassador: {
    en: "Join the Andiamo Events ambassador program. Represent a youth-driven label, earn commissions and be part of Tunisia's event community.",
    fr: "Rejoignez le programme ambassadeur Andiamo Events. Représentez un label jeune, gagnez des commissions et intégrez la communauté événementielle.",
  },
  careers: {
    en: "Build your career with Andiamo Events and Born To Lead. Open roles in events, production and marketing across Tunisia.",
    fr: "Construisez votre carrière avec Andiamo Events et Born To Lead. Postes ouverts en événementiel, production et marketing en Tunisie.",
  },
  suggestions: {
    en: "Suggest artists, venues or event ideas to Andiamo Events. Share your vision — our team reviews every submission in Tunisia.",
    fr: "Proposez artistes, lieux ou idées d'événements à Andiamo Events. Partagez votre vision — nous lisons chaque suggestion.",
  },
  academy: {
    en: "Andiamo Academy — certified in-person Event Management training in Tunis, Tunisia. 20 hours, 3 formulas, limited seats. Register now.",
    fr: "Andiamo Academy — formation certifiée Event Management en présentiel à Tunis. 20 heures, 3 formules, places limitées. Inscrivez-vous.",
  },
  academyRegister: {
    en: "Register for Andiamo Academy — choose Essential, Pro or Premium and complete your Event Management training enrollment in Tunis, Tunisia.",
    fr: "Inscrivez-vous à Andiamo Academy — choisissez Essentielle, Pro ou Premium et finalisez votre inscription à la formation Event Management à Tunis.",
  },
  academyTerms: {
    en: "Andiamo Academy training terms — registration, payment, place confirmation, refunds, and participant rules for Event Management training in Tunis.",
    fr: "Règlement Andiamo Academy — inscription, paiement, confirmation de place, remboursements et règles pour la formation Event Management à Tunis.",
  },
} as const;

export { ACADEMY_PAGE_DESCRIPTIONS, ACADEMY_PAGE_TITLES } from '@/lib/seo/academySeo';
