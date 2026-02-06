/**
 * GET /api/sitemap – Dynamic sitemap.xml for SEO.
 * Serve at /sitemap.xml via Vercel rewrite.
 */

import { createClient } from '@supabase/supabase-js';

const SITE_URL = 'https://www.andiamoevents.com';

const STATIC_URLS = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  { loc: '/events', changefreq: 'daily', priority: '0.9' },
  { loc: '/about', changefreq: 'monthly', priority: '0.7' },
  { loc: '/contact', changefreq: 'monthly', priority: '0.7' },
  { loc: '/terms', changefreq: 'yearly', priority: '0.4' },
  { loc: '/ambassador', changefreq: 'monthly', priority: '0.6' },
];

function escapeXml(s) {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlNode({ loc, lastmod, changefreq, priority }) {
  const lastmodTag = lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : '';
  const changefreqTag = changefreq ? `\n    <changefreq>${escapeXml(changefreq)}</changefreq>` : '';
  const priorityTag = priority != null ? `\n    <priority>${escapeXml(priority)}</priority>` : '';
  return `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmodTag}${changefreqTag}${priorityTag}\n  </url>`;
}

export default async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }

  try {
    const urls = [...STATIC_URLS.map((u) => ({ ...u, loc: SITE_URL + u.loc }))];

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );

      const { data: events, error } = await supabase
        .from('events')
        .select('id, date, event_type, updated_at, is_test')
        .order('date', { ascending: false });

      if (!error && events && events.length > 0) {
        const isProduction =
          process.env.VERCEL_ENV === 'production' ||
          !process.env.VERCEL_ENV;
        const filtered = isProduction
          ? events.filter((e) => !e.is_test)
          : events;

        for (const e of filtered) {
          const slug = `event-${e.id}`;
          const lastmod =
            e.updated_at &&
            new Date(e.updated_at).toISOString().split('T')[0];
          if (e.event_type === 'gallery') {
            urls.push({
              loc: `${SITE_URL}/gallery/${slug}`,
              lastmod,
              changefreq: 'monthly',
              priority: '0.6',
            });
          } else {
            urls.push({
              loc: `${SITE_URL}/event/${slug}`,
              lastmod,
              changefreq: 'weekly',
              priority: '0.8',
            });
          }
        }
      }
    }

    const urlNodes = urls.map((u) => urlNode(u)).join('\n');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlNodes}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate');
    return res.status(200).send(xml);
  } catch (err) {
    console.error('Sitemap error:', err);
    res.setHeader('Content-Type', 'application/xml');
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${STATIC_URLS.map((u) => urlNode({ ...u, loc: SITE_URL + u.loc })).join('\n')}
</urlset>`;
    return res.status(200).send(fallback);
  }
};
