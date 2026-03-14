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

/** Default site description (About-style, no nightlife) – used in index.html and JsonLd */
export const DEFAULT_SITE_DESCRIPTION =
  "Andiamo Events – find local events in Tunis, Sousse and across Tunisia. Concerts, parties, festivals. A youth-driven event label. We create memories.";

/** Per-page meta descriptions (About-style, no nightlife). 150–160 chars recommended for SEO. */
export const PAGE_DESCRIPTIONS = {
  home: {
    en: "Andiamo Events – find local events in Tunis, Sousse and across Tunisia. Concerts, parties, festivals. A youth-driven event label. We create memories.",
    fr: "Andiamo Events – événements à Tunis, Sousse et en Tunisie. Concerts, fêtes, festivals. Un label événementiel porté par la jeunesse. We create memories.",
  },
  events: {
    en: "Upcoming events in Tunis, Sousse and Tunisia. Concerts, parties, festivals. Innovative, youth-focused experiences by Andiamo Events.",
    fr: "Prochains événements à Tunis, Sousse et en Tunisie. Concerts, fêtes, festivals. Expériences innovantes par Andiamo Events.",
  },
  about: {
    en: "Andiamo Events is a youth-driven event label by Born To Lead. Creating innovative and inspiring event experiences across Tunisia. We create memories.",
    fr: "Andiamo Events, label événementiel porté par la jeunesse (Born To Lead). Créer des expériences innovantes et inspirantes en Tunisie. We create memories.",
  },
  contact: {
    en: "Get in touch with Andiamo Events – customer service, inquiries and support. Events and ticketing in Tunisia.",
    fr: "Contactez Andiamo Events – service client, demandes et support. Événements et billetterie en Tunisie.",
  },
  terms: {
    en: "Andiamo Events terms and conditions of sale. Tickets, payment, QR code access and event rules. Tunisia.",
    fr: "Conditions générales de vente Andiamo Events. Billets, paiement, accès QR et règles d'événements. Tunisie.",
  },
  ambassador: {
    en: "Become an Andiamo Events ambassador. Join a youth-driven team creating innovative events and inspiring experiences across Tunisia.",
    fr: "Devenez ambassadeur Andiamo Events. Rejoignez une équipe jeune qui crée des événements innovants et des expériences inspirantes en Tunisie.",
  },
  careers: {
    en: "Join the Andiamo Events team. Careers at a youth-driven event label. Innovative, inspiring experiences across Tunisia. Born To Lead.",
    fr: "Rejoignez l'équipe Andiamo Events. Carrières dans un label événementiel porté par la jeunesse. Expériences innovantes en Tunisie. Born To Lead.",
  },
  suggestions: {
    en: "Suggest events, artists or venues to Andiamo Events. Share your ideas – we read every suggestion. Tunisia.",
    fr: "Suggérez des événements, artistes ou lieux à Andiamo Events. Partagez vos idées – nous lisons chaque suggestion. Tunisie.",
  },
} as const;
