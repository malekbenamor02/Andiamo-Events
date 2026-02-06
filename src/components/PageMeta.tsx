import { Helmet } from "react-helmet-async";
import { SITE_URL, DEFAULT_OG_IMAGE } from "@/lib/seo";

export interface PageMetaProps {
  /** Page title (e.g. "Events | Andiamo Events") */
  title: string;
  /** Meta description, 150–160 chars recommended */
  description: string;
  /** Path for canonical and og:url (e.g. "/events"). No leading slash is ok. */
  path?: string;
  /** Optional OG/Twitter image URL (absolute). Defaults to site OG image. */
  image?: string;
  /** If true, set robots noindex,nofollow */
  noIndex?: boolean;
}

export function PageMeta({
  title,
  description,
  path = "",
  image = DEFAULT_OG_IMAGE,
  noIndex = false,
}: PageMetaProps) {
  const canonicalPath = path.startsWith("/") ? path : `/${path}`;
  const canonical = `${SITE_URL}${canonicalPath}`.replace(/\/$/, "") || SITE_URL;

  const fullTitle = title.includes("Andiamo") ? title : `${title} | Andiamo Events`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {noIndex && <meta name="robots" content="noindex,nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="Andiamo Events" />
      <meta property="og:locale" content="en_US" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonical} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:site" content="@andiamo_events" />
      <meta name="twitter:creator" content="@andiamo_events" />
    </Helmet>
  );
}
