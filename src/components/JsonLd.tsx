import { Helmet } from "react-helmet-async";
import { SITE_URL } from "@/lib/seo";

/** WebSite schema – helps Google understand the site and can enable sitelinks */
export function JsonLdWebSite() {
  const json = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Andiamo Events",
    alternateName: "Andiamo Events Tunisia",
    url: SITE_URL,
    description:
      "Creating innovative and inspiring event experiences in Tunisia. We create memories.",
    inLanguage: ["en", "fr"],
    publisher: {
      "@type": "Organization",
      name: "Andiamo Events",
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.svg` },
    },
  };
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(json)}</script>
    </Helmet>
  );
}

/** Organization schema for site-wide use */
export function JsonLdOrganization() {
  const json = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Andiamo Events",
    url: SITE_URL,
    logo: `${SITE_URL}/logo.svg`,
    description:
      "Creating innovative and inspiring event experiences in Tunisia. We create memories.",
    sameAs: [
      "https://www.instagram.com/andiamoevents",
      "https://twitter.com/andiamo_events",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      url: `${SITE_URL}/contact`,
    },
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(json)}</script>
    </Helmet>
  );
}

export interface EventJsonLdProps {
  name: string;
  description: string;
  startDate: string;
  venue: string;
  city: string;
  image: string;
  eventUrl: string;
  status?: "scheduled" | "cancelled" | "completed";
}

/** Event schema for single event pages */
export function JsonLdEvent({
  name,
  description,
  startDate,
  venue,
  city,
  image,
  eventUrl,
  status = "scheduled",
}: EventJsonLdProps) {
  const statusMap = {
    scheduled: "https://schema.org/EventScheduled",
    cancelled: "https://schema.org/EventCancelled",
    completed: "https://schema.org/EventScheduled",
  };

  const json = {
    "@context": "https://schema.org",
    "@type": "Event",
    name,
    description: description || name,
    startDate,
    eventStatus: statusMap[status],
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: venue,
      address: {
        "@type": "PostalAddress",
        addressLocality: city,
        addressCountry: "TN",
      },
    },
    image: image.startsWith("http") ? image : `${SITE_URL}${image}`,
    organizer: {
      "@type": "Organization",
      name: "Andiamo Events",
      url: SITE_URL,
    },
    offers: {
      "@type": "Offer",
      url: eventUrl.startsWith("http") ? eventUrl : `${SITE_URL}${eventUrl}`,
      priceCurrency: "TND",
      availability:
        status === "scheduled"
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
    },
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(json)}</script>
    </Helmet>
  );
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

/** BreadcrumbList schema for inner pages – can show breadcrumbs in SERP */
export function JsonLdBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  if (!items?.length) return null;
  const json = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${SITE_URL}${item.url}`,
    })),
  };
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(json)}</script>
    </Helmet>
  );
}

export interface FAQItem {
  question: string;
  answer: string;
}

/** FAQPage schema – can enable FAQ rich results in Google */
export function JsonLdFAQ({ items }: { items: FAQItem[] }) {
  if (!items?.length) return null;
  const json = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: {
        "@type": "Answer",
        text: answer,
      },
    })),
  };
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(json)}</script>
    </Helmet>
  );
}

/** ItemList schema for events list page – helps Google understand the list */
export function JsonLdItemList({ items }: { items: { name: string; url: string }[] }) {
  if (!items?.length) return null;
  const json = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Upcoming Events - Andiamo Events",
    description: "List of upcoming concerts, parties and festivals in Tunisia.",
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: item.url.startsWith("http") ? item.url : `${SITE_URL}${item.url}`,
    })),
  };
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(json)}</script>
    </Helmet>
  );
}

/** WebPage schema for key pages – can help with sitelinks and rich results */
export function JsonLdWebPage({
  name,
  description,
  path,
}: {
  name: string;
  description: string;
  path: string;
}) {
  const url = path.startsWith("http") ? path : `${SITE_URL}${path}`.replace(/\/$/, "") || SITE_URL;
  const json = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name,
    description,
    url,
    isPartOf: { "@type": "WebSite", url: SITE_URL, name: "Andiamo Events" },
    about: { "@type": "Organization", name: "Andiamo Events", url: SITE_URL },
  };
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(json)}</script>
    </Helmet>
  );
}

/** LocalBusiness schema – helps local search (Tunisia). Optional address. */
export function JsonLdLocalBusiness(props?: {
  address?: { street?: string; city?: string; country?: string };
  phone?: string;
}) {
  const json = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Andiamo Events",
    url: SITE_URL,
    logo: `${SITE_URL}/logo.svg`,
    description:
      "Creating innovative and inspiring event experiences in Tunisia. We create memories.",
    sameAs: [
      "https://www.instagram.com/andiamoevents",
      "https://twitter.com/andiamo_events",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      url: `${SITE_URL}/contact`,
      ...(props?.phone && { telephone: props.phone }),
    },
    ...(props?.address &&
      props.address.city && {
        address: {
          "@type": "PostalAddress",
          addressCountry: props.address.country || "TN",
          addressLocality: props.address.city,
          ...(props.address.street && { streetAddress: props.address.street }),
        },
      }),
  };
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(json)}</script>
    </Helmet>
  );
}
