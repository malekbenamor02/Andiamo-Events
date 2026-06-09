/**
 * Post-build: generate static HTML shells for Academy routes so crawlers get
 * correct meta before React hydrates. Run via: npx vite-node scripts/prerender-academy-routes.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACADEMY_PRERENDER_ROUTES } from '../src/lib/seo/academySeo';
import { DEFAULT_OG_IMAGE, SITE_URL } from '../src/lib/seo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');
const indexPath = path.join(distDir, 'index.html');

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHeadTags(title: string, description: string, canonicalPath: string): string {
  const canonical = `${SITE_URL}${canonicalPath}`.replace(/\/$/, '') || SITE_URL;
  const fullTitle = title.includes('Andiamo') ? title : `${title} | Andiamo Events`;
  const escTitle = escapeHtml(fullTitle);
  const escDesc = escapeHtml(description);
  const escCanonical = escapeHtml(canonical);
  const escImage = escapeHtml(DEFAULT_OG_IMAGE);

  return `
    <title>${escTitle}</title>
    <meta name="description" content="${escDesc}" />
    <link rel="canonical" href="${escCanonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escCanonical}" />
    <meta property="og:title" content="${escTitle}" />
    <meta property="og:description" content="${escDesc}" />
    <meta property="og:image" content="${escImage}" />
    <meta property="og:image:secure_url" content="${escImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="Andiamo Events" />
    <meta property="og:locale" content="en_US" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${escCanonical}" />
    <meta name="twitter:title" content="${escTitle}" />
    <meta name="twitter:description" content="${escDesc}" />
    <meta name="twitter:image" content="${escImage}" />
    <meta name="twitter:site" content="@andiamo_events" />
    <meta name="twitter:creator" content="@andiamo_events" />`;
}

function buildJsonLdScripts(schemas: Record<string, unknown>[]): string {
  return schemas
    .map(
      (schema) =>
        `<script type="application/ld+json">${JSON.stringify(schema)}</script>`
    )
    .join('\n    ');
}

function injectRoute(
  baseHtml: string,
  opts: {
    title: string;
    description: string;
    path: string;
    snippet: string;
    jsonLd: Record<string, unknown>[];
  }
): string {
  let html = baseHtml;

  // Strip default homepage SEO tags (title, description, OG, Twitter)
  html = html.replace(/<title>[^<]*<\/title>\s*/g, '');
  html = html.replace(/<meta name="description" content="[^"]*"\s*\/?>\s*/g, '');
  html = html.replace(/<!-- Open Graph[^]*?-->\s*/g, '');
  html = html.replace(/<!-- Twitter Card[^]*?-->\s*/g, '');
  html = html.replace(/<meta property="og:[^"]*"[^>]*>\s*/g, '');
  html = html.replace(/<meta name="twitter:[^"]*"[^>]*>\s*/g, '');

  const headInjection = `${buildHeadTags(opts.title, opts.description, opts.path)}
    ${buildJsonLdScripts(opts.jsonLd)}`;

  html = html.replace('</head>', `${headInjection}\n  </head>`);
  html = html.replace('<div id="root"></div>', `<div id="root">${opts.snippet}</div>`);

  return html;
}

function main() {
  if (!fs.existsSync(indexPath)) {
    console.error('[prerender-academy] dist/index.html not found — run vite build first');
    process.exit(1);
  }

  const baseHtml = fs.readFileSync(indexPath, 'utf8');

  for (const route of ACADEMY_PRERENDER_ROUTES) {
    const html = injectRoute(baseHtml, {
      title: route.title,
      description: route.description,
      path: route.path,
      snippet: route.snippet(),
      jsonLd: route.jsonLd(),
    });

    const outPath = path.join(distDir, route.outFile);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, 'utf8');
    console.log(`[prerender-academy] wrote ${route.outFile}`);
  }

  console.log('[prerender-academy] done');
}

main();
