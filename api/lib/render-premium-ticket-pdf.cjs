'use strict';

const { getPurchaseChannelLabel } = require('./purchase-channel-label.cjs');
const { buildPremiumTicketsPdfHtmlDocument } = require('./premium-ticket-page-html.cjs');
const { getEmailLogoUrl, getPublicSiteOrigin } = require('./email-branding.cjs');

/**
 * Fetch a remote image and return a data URL (for reliable PDF rendering).
 * @param {string|null|undefined} url
 * @param {number} [maxBytes]
 * @returns {Promise<string|null>}
 */
/** Last-resort wordmark if hosted logo is missing (404) or unreachable from serverless. */
const FALLBACK_LOGO_SVG_DATA_URL =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="64" viewBox="0 0 320 64"><text x="4" y="44" fill="#ffffff" font-family="system-ui,-apple-system,sans-serif" font-size="26" font-weight="700">Andiamo Events</text></svg>'
  );

/**
 * Prefer inlined logo bytes; otherwise let Chromium load an https URL at PDF render time;
 * if there is no usable URL, use an inline SVG so ticket PDFs still attach (channel-agnostic).
 * @param {string|null|undefined} logoUrl
 * @param {string|null|undefined} logoDataUrl
 * @returns {{ src: string, kind: 'inline' | 'remote' | 'fallback' }}
 */
function resolveLogoSrcForPdf(logoUrl, logoDataUrl) {
  if (logoDataUrl && typeof logoDataUrl === 'string') return { src: logoDataUrl.trim(), kind: 'inline' };
  const u = logoUrl && String(logoUrl).trim();
  if (u && /^https?:\/\//i.test(u)) return { src: u, kind: 'remote' };
  return { src: FALLBACK_LOGO_SVG_DATA_URL, kind: 'fallback' };
}

async function fetchUrlAsDataUrl(url, maxBytes = 6 * 1024 * 1024) {
  if (!url || typeof url !== 'string') return null;
  const u = url.trim();
  if (u.startsWith('data:')) return u;
  if (!/^https?:\/\//i.test(u)) return null;
  try {
    const res = await fetch(u, { signal: AbortSignal.timeout(25000) });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    if (ab.byteLength > maxBytes) return null;
    const buf = Buffer.from(ab);
    let ct = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    if (!ct.startsWith('image/')) ct = 'image/jpeg';
    return `data:${ct};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

async function resolveLaunchConfig() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROMIUM_PATH) {
    return {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROMIUM_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=medium'],
      headless: true,
    };
  }
  if (process.env.VERCEL) {
    const chromium = require('@sparticuz/chromium');
    // Removed in @sparticuz/chromium ≥ ~147; calling it throws and skips PDF generation.
    if (typeof chromium.setGraphicsMode === 'function') {
      try {
        chromium.setGraphicsMode(false);
      } catch (_) {
        /* ignore */
      }
    }
    return {
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      headless: chromium.headless,
    };
  }
  try {
    const puppeteer = require('puppeteer');
    return {
      executablePath: puppeteer.executablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=medium'],
      headless: true,
    };
  } catch {
    return null;
  }
}

/**
 * Merge multiple single-page PDF buffers into one PDF.
 * @param {Buffer[]} buffers
 * @returns {Promise<Buffer>}
 */
async function mergePdfBuffers(buffers) {
  const { PDFDocument } = require('pdf-lib');
  const out = await PDFDocument.create();
  for (const b of buffers) {
    if (!b || !Buffer.isBuffer(b) || b.length === 0) continue;
    const src = await PDFDocument.load(b);
    const idx = src.getPageIndices();
    const copied = await out.copyPages(src, idx);
    copied.forEach((p) => out.addPage(p));
  }
  return Buffer.from(await out.save());
}

/**
 * @param {string} htmlDocument - full HTML document (single ticket page)
 * @returns {Promise<Buffer>}
 */
async function renderSinglePagePdf(htmlDocument) {
  const puppeteer = require('puppeteer-core');
  const cfg = await resolveLaunchConfig();
  if (!cfg || !cfg.executablePath) {
    throw new Error('No Chromium executable: set PUPPETEER_EXECUTABLE_PATH, or deploy on Vercel, or install puppeteer.');
  }
  const browser = await puppeteer.launch({
    headless: cfg.headless !== undefined ? cfg.headless : true,
    executablePath: cfg.executablePath,
    args: cfg.args || [],
    defaultViewport: cfg.defaultViewport || { width: 1440, height: 820, deviceScaleFactor: 2 },
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 820, deviceScaleFactor: 2 });
    await page.setContent(htmlDocument, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page
      .evaluate(async () => {
        try {
          if (document.fonts && document.fonts.ready) await document.fonts.ready;
        } catch (_) {
          /* ignore */
        }
      })
      .catch(() => {});
    await new Promise((r) => setTimeout(r, 1000));
    const buf = await page.pdf({
      printBackground: true,
      width: '1440px',
      height: '820px',
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    await page.close();
    return Buffer.from(buf);
  } finally {
    await browser.close();
  }
}

/** PostgREST may return a joined row as `events` or `events: [{ ... }]` depending on relationship hints. */
function normalizeEmbeddedRow(embed) {
  if (!embed) return null;
  if (Array.isArray(embed)) {
    const first = embed[0];
    return first && typeof first === 'object' ? first : null;
  }
  if (typeof embed === 'object') return embed;
  return null;
}

/**
 * PostgREST embed `events` is sometimes null; callers may omit `event` when only `order.event_id` exists.
 * @param {object|null|undefined} order
 * @param {object|null|undefined} event
 */
function resolveEventForPdf(order, event) {
  const fromOrder = normalizeEmbeddedRow(order?.events);
  const explicit = normalizeEmbeddedRow(event);
  const primary = explicit || fromOrder;
  if (primary && (primary.name != null || primary.date != null || primary.id != null)) {
    return primary;
  }
  return {
    name: order?.event_name || fromOrder?.name || 'Event',
    date: order?.event_date ?? fromOrder?.date ?? null,
    venue: order?.event_venue ?? fromOrder?.venue ?? null,
    city: order?.city ?? fromOrder?.city ?? null,
    poster_url: order?.poster_url ?? fromOrder?.poster_url ?? null,
  };
}

/** Puppeteer needs absolute https URLs for QR images (relative paths fail on file:// / blank origin). */
function toAbsolutePublicUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const u = url.trim();
  if (!u) return null;
  if (u.startsWith('data:')) return u;
  if (/^https?:\/\//i.test(u)) return u;
  // Supabase Storage paths stored relative to project URL (server-side fetch + Chromium)
  if (u.startsWith('/storage/') || u.startsWith('/rest/')) {
    const supabaseBase = String(process.env.SUPABASE_URL || '')
      .trim()
      .replace(/\/$/, '');
    if (supabaseBase) return `${supabaseBase}${u.startsWith('/') ? u : `/${u}`}`;
  }
  try {
    const assetsBase = String(process.env.PUBLIC_ASSETS_BASE_URL || '')
      .trim()
      .replace(/\/$/, '');
    if (assetsBase && !u.startsWith('/')) {
      return `${assetsBase}/${u.replace(/^\//, '')}`;
    }
    const origin = getPublicSiteOrigin().replace(/\/$/, '');
    if (u.startsWith('/')) return `${origin}${u}`;
    return `${origin}/${u}`;
  } catch {
    return u;
  }
}

async function renderMergedPremiumTicketsPdfOnce(htmlDocuments) {
  const list = (htmlDocuments || []).filter((h) => h && typeof h === 'string');
  if (list.length === 0) return null;

  const cfg = await resolveLaunchConfig();
  if (!cfg || !cfg.executablePath) {
    throw new Error('No Chromium executable: set PUPPETEER_EXECUTABLE_PATH, or deploy on Vercel, or install puppeteer.');
  }
  const puppeteer = require('puppeteer-core');
  const browser = await puppeteer.launch({
    headless: cfg.headless !== undefined ? cfg.headless : true,
    executablePath: cfg.executablePath,
    args: cfg.args || [],
    defaultViewport: cfg.defaultViewport || { width: 1440, height: 820, deviceScaleFactor: 2 },
  });
  try {
    const parts = [];
    for (const html of list) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 820, deviceScaleFactor: 2 });
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page
        .evaluate(async () => {
          try {
            if (document.fonts && document.fonts.ready) await document.fonts.ready;
          } catch (_) {
            /* ignore */
          }
        })
        .catch(() => {});
      await new Promise((r) => setTimeout(r, 1000));
      const buf = await page.pdf({
        printBackground: true,
        width: '1440px',
        height: '820px',
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
      await page.close();
      parts.push(Buffer.from(buf));
    }
    if (parts.length === 1) return parts[0];
    return mergePdfBuffers(parts);
  } finally {
    await browser.close();
  }
}

/**
 * Render one merged PDF for all ticket pages (single browser session, merged with pdf-lib).
 * Retries once on transient Chromium / page failures (common on cold serverless).
 * @param {string[]} htmlDocuments
 */
async function renderMergedPremiumTicketsPdf(htmlDocuments) {
  const list = (htmlDocuments || []).filter((h) => h && typeof h === 'string');
  if (list.length === 0) return null;

  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await renderMergedPremiumTicketsPdfOnce(list);
    } catch (e) {
      lastErr = e;
      if (attempt === 0) {
        console.warn('[premium-ticket-pdf] PDF render failed, retrying once:', e && e.message);
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }
  throw lastErr;
}

/**
 * Build optional PDF attachment for an order ticket email.
 * @param {object} params
 * @param {object} params.order
 * @param {object} [params.event] - joined events row (optional if order.events or flat order fields exist)
 * @param {{ id?: string, qr_code_url?: string|null, order_pass_id?: string|null }[]} params.tickets
 * @param {{ id?: string, pass_type?: string|null }[]} params.orderPasses
 * @param {{ invitationMode?: boolean }} [params.opts]
 * @returns {Promise<{ filename: string, content: Buffer, contentType: string } | null>}
 */
async function tryBuildPremiumTicketsPdfAttachment(params) {
  const { order, event, tickets, orderPasses, opts } = params || {};
  if (!order || !Array.isArray(tickets) || tickets.length === 0) return null;

  const eventResolved = resolveEventForPdf(order, event);

  const invitationMode = !!(opts && opts.invitationMode);
  const channelLabel = getPurchaseChannelLabel(order, invitationMode ? { mode: 'invitation' } : undefined);

  const logoUrl = getEmailLogoUrl();
  const posterUrl = eventResolved.poster_url || null;

  const [logoFetched, posterDataUrl] = await Promise.all([
    fetchUrlAsDataUrl(logoUrl),
    posterUrl ? fetchUrlAsDataUrl(posterUrl) : Promise.resolve(null),
  ]);
  const logoResolved = resolveLogoSrcForPdf(logoUrl, logoFetched);
  if (logoResolved.kind === 'fallback') {
    console.warn('[premium-ticket-pdf] No usable logo URL; using placeholder wordmark in PDF', {
      logoUrl: logoUrl || null,
    });
  }

  const passById = new Map();
  (orderPasses || []).forEach((p) => {
    if (p && p.id) passById.set(p.id, p);
  });

  const ticketRows = [];
  for (const t of tickets) {
    if (!t || !t.qr_code_url) continue;
    const qrResolved = toAbsolutePublicUrl(t.qr_code_url) || t.qr_code_url;
    const qrData = (await fetchUrlAsDataUrl(qrResolved)) || qrResolved;
    const pass = t.order_pass_id ? passById.get(t.order_pass_id) : null;
    const passType = (pass && pass.pass_type) || 'Pass';
    ticketRows.push({ passType, qrDataUrl: qrData });
  }
  if (ticketRows.length === 0) return null;

  const orderNum =
    order.order_number !== null && order.order_number !== undefined
      ? `#${order.order_number}`
      : String(order.id || '').slice(0, 8).toUpperCase();

  const base = {
    eventName: eventResolved.name || 'Event',
    eventDateRaw: eventResolved.date,
    venue: eventResolved.venue,
    city: eventResolved.city,
    posterDataUrl: posterDataUrl || null,
    logoDataUrl: logoResolved.src,
    guestName: order.user_name || order.guest_name || 'Guest',
    orderNumberDisplay: orderNum,
    channelLabel,
    organizerLine: null,
    tickets: ticketRows,
  };

  const htmlDocs = ticketRows.map((row) =>
    buildPremiumTicketsPdfHtmlDocument({
      ...base,
      tickets: [row],
    })
  );

  const pdfBuf = await renderMergedPremiumTicketsPdf(htmlDocs);
  if (!pdfBuf || pdfBuf.length === 0) return null;

  const safeNum = String(order.order_number != null ? order.order_number : order.id || 'tickets').replace(
    /[^\w.-]+/g,
    '-'
  );
  return {
    filename: `Andiamo-Tickets-${safeNum}.pdf`,
    content: pdfBuf,
    contentType: 'application/pdf',
  };
}

/**
 * Official invitation emails (no orders row): one merged PDF for all QR rows.
 */
async function tryBuildPremiumTicketsPdfAttachmentInvitation(params) {
  const { event, guestName, invitationNumber, passTypeName, qrCodes } = params || {};
  if (!event || !guestName || !Array.isArray(qrCodes) || qrCodes.length === 0) return null;
  return tryBuildPremiumTicketsPdfAttachment({
    order: {
      id: 'invitation',
      user_name: guestName,
      source: 'official_invitation',
      payment_method: 'external_app',
      order_number: invitationNumber,
    },
    event,
    tickets: qrCodes.map((q) => ({
      qr_code_url: q.qr_code_url,
      order_pass_id: '__inv_pdf__',
    })),
    orderPasses: [{ id: '__inv_pdf__', pass_type: passTypeName || 'Invitation' }],
    opts: { invitationMode: true },
  });
}

module.exports = {
  fetchUrlAsDataUrl,
  tryBuildPremiumTicketsPdfAttachment,
  tryBuildPremiumTicketsPdfAttachmentInvitation,
  renderMergedPremiumTicketsPdf,
  renderSinglePagePdf,
  mergePdfBuffers,
};
