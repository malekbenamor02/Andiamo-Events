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
