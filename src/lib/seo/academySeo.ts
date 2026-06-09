/**
 * Academy SEO — titles, descriptions, structured data, and prerender route config.
 *
 * Nav CMS (Supabase `site_content`, key `navigation`): add
 * `{ "name": "Academy", "href": "/academy" }` (en) / `{ "name": "Académie", "href": "/academy" }` (fr)
 * to the navigation array for each language.
 */
import { ACADEMY_FAQ, ACADEMY_FORMULAS, ACADEMY_UI } from '@/data/academyContent';
import { pickLocalized } from '@/lib/academy/academyUtils';
import { SITE_URL } from '@/lib/seo';
import type { AcademyLanguage } from '@/types/academy';

export const ACADEMY_PATH = '/academy';
export const ACADEMY_REGISTER_PATH = '/academy/register';
export const ACADEMY_TERMS_PATH = '/academy/terms';

/** Page titles (before " | Andiamo Events" suffix in PageMeta when title lacks "Andiamo") */
export const ACADEMY_PAGE_TITLES = {
  main: {
    en: 'Event Management Training Tunis | Andiamo Academy',
    fr: 'Formation Event Management Tunis | Andiamo Academy',
  },
  register: {
    en: 'Register — Event Management Training | Andiamo Academy',
    fr: 'Inscription — Formation Event Management | Andiamo Academy',
  },
  terms: {
    en: 'Training Terms | Andiamo Academy',
    fr: 'Règlement de la formation | Andiamo Academy',
  },
} as const;

/** Evergreen meta descriptions (~150–160 chars, no cohort dates) */
export const ACADEMY_PAGE_DESCRIPTIONS = {
  main: {
    en: 'Andiamo Academy — certified in-person Event Management training in Tunis, Tunisia. 20 hours, 3 formulas, limited seats. Register now.',
    fr: 'Andiamo Academy — formation certifiée Event Management en présentiel à Tunis. 20 heures, 3 formules, places limitées. Inscrivez-vous.',
  },
  register: {
    en: 'Register for Andiamo Academy — choose Essential, Pro or Premium and complete your Event Management training enrollment in Tunis, Tunisia.',
    fr: 'Inscrivez-vous à Andiamo Academy — choisissez Essentielle, Pro ou Premium et finalisez votre inscription à la formation Event Management à Tunis.',
  },
  terms: {
    en: 'Andiamo Academy training terms — registration, payment, place confirmation, refunds, and participant rules for Event Management training in Tunis.',
    fr: 'Règlement Andiamo Academy — inscription, paiement, confirmation de place, remboursements et règles pour la formation Event Management à Tunis.',
  },
} as const;

export interface AcademyFaqSchemaItem {
  question: string;
  answer: string;
}

export function buildAcademyFaqSchema(language: AcademyLanguage): AcademyFaqSchemaItem[] {
  return ACADEMY_FAQ.map((item) => ({
    question: pickLocalized(item.question, language),
    answer: pickLocalized(item.answer, language),
  }));
}

export function buildAcademyCourseSchema(language: AcademyLanguage): Record<string, unknown> {
  const hero = ACADEMY_UI.hero;
  const courseName =
    language === 'en'
      ? 'Event Management Training — Andiamo Academy'
      : 'Formation Event Management — Andiamo Academy';
  const description = ACADEMY_PAGE_DESCRIPTIONS.main[language];
  const prices = ACADEMY_FORMULAS.map((f) => f.priceDt);
  const lowPrice = Math.min(...prices);
  const highPrice = Math.max(...prices);

  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: courseName,
    description,
    inLanguage: language === 'fr' ? 'fr-TN' : 'en',
    url: `${SITE_URL}${ACADEMY_PATH}`,
    provider: {
      '@type': 'Organization',
      name: 'Andiamo Events',
      url: SITE_URL,
    },
    instructor: {
      '@type': 'Person',
      name: hero.instructorName,
      jobTitle: pickLocalized(hero.instructorRole, language),
    },
    educationalCredentialAwarded: {
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: language === 'en' ? 'Certificate of completion' : 'Attestation de fin de formation',
    },
    timeRequired: 'PT20H',
    courseMode: 'onsite',
    locationCreated: {
      '@type': 'Place',
      name: 'Tunis',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Tunis',
        addressCountry: 'TN',
      },
    },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'onsite',
      courseWorkload: 'PT20H',
      location: {
        '@type': 'Place',
        name: 'Tunis',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Tunis',
          addressCountry: 'TN',
        },
      },
    },
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: lowPrice,
      highPrice: highPrice,
      priceCurrency: 'TND',
      offerCount: ACADEMY_FORMULAS.length,
      url: `${SITE_URL}${ACADEMY_REGISTER_PATH}`,
      availability: 'https://schema.org/InStock',
    },
  };
}

export function buildAcademyFaqPageSchema(language: AcademyLanguage): Record<string, unknown> {
  const items = buildAcademyFaqSchema(language);
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    })),
  };
}

export function buildAcademyWebPageSchema(
  language: AcademyLanguage,
  page: 'main' | 'register' | 'terms'
): Record<string, unknown> {
  const paths = {
    main: ACADEMY_PATH,
    register: ACADEMY_REGISTER_PATH,
    terms: ACADEMY_TERMS_PATH,
  };
  const path = paths[page];
  const url = `${SITE_URL}${path}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: ACADEMY_PAGE_TITLES[page][language],
    description: ACADEMY_PAGE_DESCRIPTIONS[page][language],
    url,
    inLanguage: language === 'fr' ? 'fr-TN' : 'en',
    isPartOf: { '@type': 'WebSite', url: SITE_URL, name: 'Andiamo Events' },
    about: { '@type': 'Organization', name: 'Andiamo Events', url: SITE_URL },
  };
}

/** Routes config for build-time prerender (English shell — primary crawl default) */
export const ACADEMY_PRERENDER_ROUTES = [
  {
    path: ACADEMY_PATH,
    outFile: 'academy/index.html',
    title: ACADEMY_PAGE_TITLES.main.en,
    description: ACADEMY_PAGE_DESCRIPTIONS.main.en,
    jsonLd: () => [
      buildAcademyWebPageSchema('en', 'main'),
      buildAcademyCourseSchema('en'),
      buildAcademyFaqPageSchema('en'),
    ],
  },
  {
    path: ACADEMY_REGISTER_PATH,
    outFile: 'academy/register/index.html',
    title: ACADEMY_PAGE_TITLES.register.en,
    description: ACADEMY_PAGE_DESCRIPTIONS.register.en,
    jsonLd: () => [buildAcademyWebPageSchema('en', 'register')],
  },
  {
    path: ACADEMY_TERMS_PATH,
    outFile: 'academy/terms/index.html',
    title: ACADEMY_PAGE_TITLES.terms.en,
    description: ACADEMY_PAGE_DESCRIPTIONS.terms.en,
    jsonLd: () => [buildAcademyWebPageSchema('en', 'terms')],
  },
] as const;
