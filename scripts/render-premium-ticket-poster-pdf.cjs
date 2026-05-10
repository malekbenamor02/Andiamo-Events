'use strict';

/**
 * Renders email-templates/previews/13-premium-desktop-ticket-poster.html to PDF.
 * By default uses the poster `src` already set in the HTML (remote Unsplash; override below).
 * Override with a remote URL or absolute path to another image:
 *
 *   npm run email:ticket-poster-pdf
 *   npm run email:ticket-poster-pdf -- "https://....poster.jpg"
 *   npm run email:ticket-poster-pdf -- "C:\\path\\to\\poster.webp"
 *   set EVENT_POSTER_URL=https://... && npm run email:ticket-poster-pdf
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'email-templates', 'previews', '13-premium-desktop-ticket-poster.html');
const PDF = path.join(ROOT, 'email-templates', 'previews', '13-premium-desktop-ticket-poster.pdf');

/**
 * @returns {string|null} URL to set on #ticket-poster-bg, or null to keep HTML as-is
 */
function posterOverrideFromArgs() {
  const fromEnv = (process.env.EVENT_POSTER_URL || '').trim();
  const raw = fromEnv || (process.argv[2] || '').trim();
  if (!raw || raw.startsWith('-')) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const abs = path.isAbsolute(raw) ? raw : path.join(ROOT, raw);
  if (fs.existsSync(abs)) return pathToFileURL(abs).href;
  return raw;
}

async function main() {
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch {
    console.error('Missing dependency: puppeteer. Run: npm install');
    process.exit(1);
  }

  const override = posterOverrideFromArgs();
  const fileUrl = pathToFileURL(HTML).href;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 820, deviceScaleFactor: 2 });
    await page.goto(fileUrl, { waitUntil: 'load', timeout: 120000 });

    if (override) {
      await page.evaluate((url) => {
        const el = document.getElementById('ticket-poster-bg');
        if (el && url) el.setAttribute('src', url);
      }, override);
    }

    await page
      .waitForNetworkIdle({ idleTime: 500, timeout: 60000 })
      .catch(() => {});
    await new Promise((r) => setTimeout(r, 2500));

    await page.pdf({
      path: PDF,
      printBackground: true,
      width: '1440px',
      height: '820px',
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    console.log(override ? `Poster override: ${override}` : 'Poster: from HTML (default src)');
    console.log('Wrote', PDF);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
