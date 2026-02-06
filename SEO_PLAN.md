# Andiamo Events – Strong SEO Plan

This document is a full SEO plan for **andiamoevents.com** (React SPA, Vite, Vercel). It covers technical SEO, on-page SEO, structured data, performance, content, and local SEO.

---

## 1. Current State Summary

| Area | Status | Notes |
|------|--------|--------|
| **Meta tags** | Partial | Single set in `index.html`; no per-route titles/descriptions |
| **Description** | Weak | "We Create Memories" is too short and not keyword-rich |
| **Open Graph / Twitter** | Present | OG/Twitter in place; same weak description |
| **robots.txt** | OK | Allows crawlers; no Sitemap reference |
| **Sitemap** | Missing | No `sitemap.xml` |
| **Structured data** | Missing | No JSON-LD (Organization, Event, etc.) |
| **Per-route SEO** | Missing | All routes share same `<title>` and meta (SPA) |
| **Canonical / hreflang** | Missing | No canonical URLs; EN/FR not declared |
| **Semantic HTML** | Unknown | Need to verify `<main>`, heading hierarchy, landmarks |

---

## 2. Technical SEO

### 2.1 Per-route meta (title, description, OG)

**Problem:** React Router changes URL but crawlers and social previews only see `index.html` — one title and one description for the whole site.

**Solution:** Use **react-helmet-async** (or similar) so each route can set its own:

- `<title>`
- `<meta name="description">`
- `og:title`, `og:description`, `og:url`, `og:image` (and optional `og:type`)
- `twitter:title`, `twitter:description`, `twitter:image`

**Routes to configure:**

- `/` – Home
- `/events` – Events list
- `/event/:eventSlug` – Single event (dynamic title/description from event name + date + venue)
- `/gallery/:eventSlug` – Event gallery
- `/about` – About
- `/contact` – Contact
- `/terms` – Terms
- `/ambassador` – Ambassador program
- `/pass-purchase`, `/:eventSlug` – Pass purchase (can reuse event or generic title)
- 404 – “Page not found” style title

**Implementation steps:**

1. Install: `npm install react-helmet-async`
2. Wrap app with `<HelmetProvider>` in `App.tsx`.
3. Create a small `PageMeta` (or `SEO`) component that accepts `title`, `description`, `image`, `path` and renders `<Helmet>` with meta and OG tags.
4. Use `PageMeta` (or pass props into a layout) on every public page; for `/event/:eventSlug` and `/gallery/:eventSlug`, use event data (name, date, venue, poster) for title, description, and image.

**Canonical URL:**  
Set `<link rel="canonical" href="https://www.andiamoevents.com/current-path" />` per page (same base URL + current path). Avoid duplicate content from query params or trailing slashes by normalizing the path.

---

### 2.2 Sitemap (sitemap.xml)

**Purpose:** Help search engines discover all important URLs (home, events, about, contact, each event, each gallery).

**Options:**

- **A) Static sitemap (good first step)**  
  - Add `public/sitemap.xml` with:
    - Static URLs: `/`, `/events`, `/about`, `/contact`, `/terms`, `/ambassador`.
  - Update this file manually when you add new fixed pages.

- **B) Dynamic sitemap (recommended long-term)**  
  - Vercel serverless function or API route that:
    - Reads events from Supabase (same source as frontend).
    - Outputs XML with:
      - Static URLs above.
      - `/event/{slug}` for each upcoming event.
      - `/gallery/{slug}` for each gallery event.
    - Set `lastmod` to event update date if you have it; otherwise use a sensible default.
  - Serve at `https://www.andiamoevents.com/sitemap.xml`.

**Sitemap rules:**

- Use absolute URLs.
- Only include indexable pages (no `/admin`, `/scanner`, `/pos`, `/ambassador/dashboard`, etc.).
- Reference sitemap in `robots.txt` (see below).

---

### 2.3 robots.txt

**Current:** Allows crawlers; no Sitemap.

**Improvements:**

- Add: `Sitemap: https://www.andiamoevents.com/sitemap.xml`
- Explicitly disallow admin/scanner/pos and auth routes so crawlers don’t waste budget:
  - `Disallow: /admin`
  - `Disallow: /scanner`
  - `Disallow: /pos`
  - `Disallow: /ambassador/dashboard`
  - `Disallow: /ambassador/auth`
  - `Disallow: /payment-processing`
  - `Disallow: /cod-order` (or allow if you want these indexed; usually not needed)

Keep: `Allow: /` for main site.

---

### 2.4 Language (EN/FR) and hreflang

**Current:** Site supports EN/FR; no `hreflang` or `lang` switching in `<html>`.

**Recommendations:**

- If the same URL serves both languages (e.g. via a toggle):  
  - Keep `<html lang="en">` or set it dynamically to `en` or `fr` based on current language (so at least one language is declared).
  - Optional: use `hreflang` with two URLs if you later add language-specific URLs (e.g. `/en/events`, `/fr/events`).
- If you add separate paths per language later, add:
  - `<link rel="alternate" hreflang="en" href="https://www.andiamoevents.com/..." />`
  - `<link rel="alternate" hreflang="fr" href="https://www.andiamoevents.com/..." />`
  - `<link rel="alternate" hreflang="x-default" href="..." />` (default language URL).

---

## 3. On-page SEO

### 3.1 Title and meta description guidelines

- **Home:**  
  - Title: e.g. `Andiamo Events | Nightlife & Events in Tunisia – We Create Memories`  
  - Description: 150–160 chars, include “Tunisia”, “events”, “nightlife”, “tickets”, and a CTA (e.g. “Discover upcoming events and buy tickets.”).

- **Events list:**  
  - Title: `Upcoming Events | Andiamo Events – Tunisia`  
  - Description: Summarize what the page shows (upcoming events, venues, cities) and a CTA.

- **Single event:**  
  - Title: `{Event name} | {Date} | {Venue} – Andiamo Events`  
  - Description: Event name + date + venue + city + short hook (e.g. “Get tickets”).

- **About / Contact / Terms / Ambassador:**  
  - Unique, descriptive titles and 150–160 character descriptions that match the page content and keywords.

**Rules:**

- One H1 per page (e.g. event name on event page, “Upcoming Events” on `/events`).
- H2/H3 for sections; don’t skip levels.
- Keep titles under ~60 characters where possible so they don’t truncate in SERPs.

---

### 3.2 Semantic HTML and accessibility

- Use `<main>` for main content; one per page.
- Use `<nav>` for navigation.
- Use `<header>` / `<footer>` where appropriate.
- For event cards and event detail, use `<article>` and clear headings.
- Use `<section>` with `aria-label` where it helps (e.g. “Upcoming events”, “Contact form”).
- Ensure all images have descriptive `alt` text (event name, venue, CTA where relevant).
- Ensure form inputs have `<label>` and buttons are descriptive for screen readers.

This helps both SEO and Core Web Vitals (accessibility is a ranking factor).

---

### 3.3 Images

- **OG image:** You have `og-image.png`; keep 1200×630 and ensure it looks good on social (logo + tagline or key visual).
- **Event posters:** Use `poster_url` in OG for event pages (`og:image` per event).
- **Alt text:** Every image: event name, or “Andiamo Events – [context]”. Avoid “image” or “photo” alone.
- **Format/size:** Prefer WebP with fallback; lazy-load below-the-fold images; reasonable dimensions to avoid huge payloads.

---

## 4. Structured data (JSON-LD)

Add JSON-LD in `<head>` (or at top of `<body>`) so Google can show rich results.

### 4.1 Organization (site-wide)

On every page (e.g. in a layout or single component that always renders):

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Andiamo Events",
  "url": "https://www.andiamoevents.com",
  "logo": "https://www.andiamoevents.com/logo.svg",
  "description": "Premier nightlife and events in Tunisia. We create memories.",
  "sameAs": [
    "https://www.instagram.com/andiamoevents",
    "https://twitter.com/andiamo_events"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer service",
    "url": "https://www.andiamoevents.com/contact"
  }
}
```

Adjust `sameAs` and `description` to match your real profiles and messaging.

### 4.2 Event (per event page)

On `/event/:eventSlug` and optionally on `/events` as an `ItemList` of events:

```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "Event name",
  "description": "Event description",
  "startDate": "2025-03-15T21:00:00",
  "eventStatus": "https://schema.org/EventScheduled",
  "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
  "location": {
    "@type": "Place",
    "name": "Venue name",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "City",
      "addressCountry": "TN"
    }
  },
  "image": "absolute URL to poster",
  "organizer": {
    "@type": "Organization",
    "name": "Andiamo Events",
    "url": "https://www.andiamoevents.com"
  },
  "offers": {
    "@type": "Offer",
    "url": "https://www.andiamoevents.com/event/slug",
    "priceCurrency": "TND",
    "availability": "https://schema.org/InStock"
  }
}
```

Use real `startDate` (ISO), venue name, city, and image URL. If you have multiple ticket tiers, you can use multiple `offers` or an `AggregateOffer`.

### 4.3 LocalBusiness (optional)

If you have a physical office or primary venue:

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Andiamo Events",
  "url": "https://www.andiamoevents.com",
  "address": { ... },
  "geo": { ... }
}
```

Implement by injecting a `<script type="application/ld+json">` with the JSON (no extra newlines inside the string to avoid breaking parsing). Add Organization on a global layout; add Event only on event pages; LocalBusiness only if relevant.

---

## 5. Performance (Core Web Vitals)

- **LCP:** Preload hero image or video; optimize poster images; avoid blocking render with large JS.
- **INP/CLS:** Avoid layout shifts (e.g. reserve space for images, ads, embeds); debounce/throttle heavy input handlers.
- **TTFB:** Vercel + edge is usually good; ensure API routes and Supabase are fast; use caching where possible.
- **Assets:** Lazy-load images below the fold; use `loading="lazy"`; consider responsive images (`srcset`). Minimize main bundle (code-split by route if not already).
- **Fonts:** You use Google Fonts; keep `display=swap` and preconnect (you already have preconnect); consider self-hosting if you want to reduce third-party requests.

Use **Vercel Speed Insights** and **Google Search Console (Core Web Vitals)** to monitor after changes.

---

## 6. Content and keywords

- **Primary keywords:** Andiamo Events, events Tunisia, nightlife Tunisia, [city] events, event tickets Tunisia, etc.
- **Secondary:** concert Tunisia, party [city], event venue [city], buy tickets online Tunisia.
- **On site:** Use these naturally in:
  - Home hero and intro
  - Events list headings and short intros
  - Event titles and descriptions
  - About and Contact copy
  - Footer or “Why Andiamo” type sections
- **Blog/FAQs (optional):** A small “News” or “FAQ” section with articles like “Best events in Tunis 2025”, “How to buy event tickets in Tunisia” can capture long-tail search. Only add if you can maintain quality.

---

## 7. Local SEO (Tunisia / cities)

- Use “Tunisia” and city names (e.g. Tunis, Sousse) in titles and descriptions where relevant.
- In structured data, use `addressCountry: "TN"` and `addressLocality` for events and LocalBusiness.
- If you have a Google Business Profile, link to the site and keep NAP (name, address, phone) consistent with the website.
- Encourage reviews and link to your site from social profiles (Instagram, etc.).

---

## 8. Security and crawlability

- Keep security headers (you already have good ones in `vercel.json`). Don’t block crawlers via CSP unless necessary.
- Don’t block `Googlebot` or `Bingbot` in `robots.txt` for public pages.
- Ensure `/event/:slug` and `/events` are reachable by links from the home page so crawlers can discover them even before sitemap.

---

## 9. Implementation priority

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| P0 | Richer meta description and title on `index.html` | Low | High |
| P0 | Add `react-helmet-async` + per-route meta (title, description, OG) for main public pages | Medium | High |
| P0 | Add `sitemap.xml` (static first) and reference it in `robots.txt` | Low | High |
| P0 | Tighten `robots.txt` (Sitemap + Disallow for admin/scanner/pos) | Low | Medium |
| P1 | Canonical URL per page | Low | Medium |
| P1 | JSON-LD Organization site-wide | Low | Medium |
| P1 | JSON-LD Event on event pages | Medium | High |
| P2 | Dynamic sitemap (events + galleries) | Medium | Medium |
| P2 | Semantic HTML and H1 audit | Medium | Medium |
| P2 | Image alt text and lazy-loading audit | Low–Medium | Medium |
| P3 | hreflang if you add language-specific URLs | Low | Medium (if you target EN/FR separately) |
| P3 | LocalBusiness schema if applicable | Low | Low–Medium |
| P3 | Blog/FAQ content for long-tail | High | Long-term |

---

## 10. Quick wins (do first)

1. **Replace the default meta description** in `index.html` with a 150–160 character description that includes “Tunisia”, “events”, “nightlife”, “tickets”, and a CTA.
2. **Create `public/sitemap.xml`** with at least: `/`, `/events`, `/about`, `/contact`, `/terms`, `/ambassador`.
3. **Add to `robots.txt`:**  
   `Sitemap: https://www.andiamoevents.com/sitemap.xml`  
   and the `Disallow` lines for `/admin`, `/scanner`, `/pos`, and dashboard/auth paths.
4. **Install and use `react-helmet-async`** for `/`, `/events`, `/about`, `/contact` with unique titles and descriptions; then add event and gallery pages using dynamic data.

After that, add canonical URLs, JSON-LD (Organization then Event), and then the rest of the plan as you have time.

---

## 11. Maintenance

- **Search Console:** Verify property for `https://www.andiamoevents.com` (and optional `https://andiamoevents.com` with redirect to www). Submit sitemap; monitor indexing, Core Web Vitals, and manual actions.
- **Sitemap:** Regenerate when you add new static pages; if you use a dynamic sitemap, run it on deploy or on a schedule.
- **Structured data:** Test with [Google Rich Results Test](https://search.google.com/test/rich-results) and fix any errors.
- **Meta:** When adding new public routes, always add a title and description (and OG if the page is shareable).

This plan gives you a strong, structured path to improve SEO for Andiamo Events from technical setup to content and local search.

---

## 12. Next improvements (after baseline)

**Already done in codebase:** Per-route meta, canonical, sitemap (static + dynamic), robots.txt, JSON-LD Organization + Event, BreadcrumbList (event, gallery, about, contact, terms), **FAQPage** (About FAQ + schema), **LocalBusiness** (site-wide), dynamic `<html lang="en|fr">`, redirect `/refund-policy` → `/terms`, **semantic HTML** (`<main>` on all public pages, `<nav>` in Navigation), **image alt audit** (hero, gallery, event posters), **LCP preload** (event poster on UpcomingEvent and GalleryEvent), **og:locale + og:locale:alternate** for EN/FR.

**Optional / ongoing:**

| Priority | Improvement | Why |
|----------|-------------|-----|
| **Low** | **Blog or news section** | Articles like “Best events in Tunis 2025” or “How to buy tickets” capture long-tail search. Only if you can maintain quality. |
| **Ongoing** | **Search Console + Core Web Vitals** | Monitor indexing, fix coverage issues, and improve LCP/INP/CLS from the CWV report. |

---

## 13. Full SEO checklist (maximize rankings)

Everything below is implemented in code. To rank strong in Google you must also complete the steps in **"What you must do"**.

**Technical:** Per-route meta, canonical, sitemap (dynamic), robots.txt, redirect refund-policy→terms, html lang + og:locale/alternate, theme-color, geo.region, keywords meta, font preload, semantic main/nav, image alt + lazy loading + LCP preload.

**Structured data:** WebSite, Organization, LocalBusiness, WebPage (home, events), Event (per event/gallery), BreadcrumbList, FAQPage, ItemList (events list).

**Content & links:** Keyword-rich intro on home and events page; footer links (Events, About, Ambassador, Contact, Terms); event cards link to event and tickets.

**What you must do:** (1) Google Search Console – add property, verify (HTML tag in index.html), submit sitemap `https://www.andiamoevents.com/sitemap.xml`, request indexing for key URLs. (2) Bing Webmaster Tools – add site and sitemap. (3) Monitor Coverage and Core Web Vitals; test with Rich Results Test. Ranking first also depends on competition, backlinks and user signals.
