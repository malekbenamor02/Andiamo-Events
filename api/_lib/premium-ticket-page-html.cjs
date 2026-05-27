'use strict';

const { formatEventTime } = require('./online-ticket-email-html.cjs');

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function splitEventHeadline(name) {
  const s = (name || 'Event').trim();
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { line1: 'Event', line2: '' };
  if (words.length === 1) return { line1: '', line2: words[0] };
  const mid = Math.ceil(words.length / 2);
  return {
    line1: words.slice(0, mid).join(' '),
    line2: words.slice(mid).join(' '),
  };
}

const SHIELD_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
  <path d="m9 12 2 2 4-4"/>
</svg>`.trim();

/**
 * One merged HTML document for all tickets (Chromium print: page-break between tickets).
 *
 * @param {object} opts
 * @param {string} opts.eventName
 * @param {string|null|undefined} opts.eventDateRaw - ISO or DB date string
 * @param {string|null|undefined} opts.venue
 * @param {string|null|undefined} opts.city
 * @param {string|null|undefined} opts.posterDataUrl - data URL or https URL for background
 * @param {string} opts.logoDataUrl - data URL or https URL (white logo)
 * @param {string} opts.guestName
 * @param {string} opts.orderNumberDisplay
 * @param {string} opts.channelLabel - purchase channel / ambassador (see purchase-channel-label.cjs)
 * @param {string|null|undefined} opts.organizerLine - small uppercase line next to logo
 * @param {{ passType: string, qrDataUrl: string }[]} opts.tickets
 * @returns {string}
 */
function buildPremiumTicketsPdfHtmlDocument(opts) {
  const {
    eventName,
    eventDateRaw,
    venue,
    city,
    posterDataUrl,
    logoDataUrl,
    guestName,
    orderNumberDisplay,
    channelLabel,
    organizerLine,
    tickets,
  } = opts;

  const dateDisplay = formatEventTime(eventDateRaw) || 'TBA';
  const venueSafe = escapeHtml(venue || 'Venue to be announced');
  const citySafe = escapeHtml(city || '');
  const guestSafe = escapeHtml(guestName || 'Guest');
  const orderSafe = escapeHtml(orderNumberDisplay || '');
  const channelSafe = escapeHtml(channelLabel || 'Online');
  const orgLine = escapeHtml(organizerLine || 'Event by Mouayed & Sirine');
  const { line1, line2 } = splitEventHeadline(eventName);
  const line1Safe = escapeHtml(line1);
  const line2Safe = escapeHtml(line2);

  const poster =
    posterDataUrl && String(posterDataUrl).trim()
      ? escapeHtml(String(posterDataUrl).trim())
      : '';

  const list = Array.isArray(tickets) ? tickets : [];
  const pages = list.map((t) => {
    const pass = escapeHtml(t.passType || 'Pass');
    const qr = escapeHtml(t.qrDataUrl || '');
    const headlineBlock =
      line1Safe.length > 0
        ? `<span class="hl-muted">${line1Safe}</span><br/><span class="hl-accent">${line2Safe}</span>`
        : `<span class="hl-accent">${line2Safe}</span>`;

    return `
<section class="ticket-page">
  <div class="bg-stack">
    ${poster ? `<img class="poster" src="${poster}" alt="" />` : '<div class="poster-fallback"></div>'}
    <div class="overlay"></div>
    <div class="stipple"></div>
  </div>
  <div class="content">
    <div class="left">
      <div class="row-top">
        <div class="logo-wrap"><img class="logo" src="${escapeHtml(logoDataUrl)}" alt="Andiamo Events" /></div>
        <div class="rule"></div>
        <div class="org">${orgLine}</div>
      </div>
      <div class="mid">
        <div class="pill-row"><span class="dot"></span><span class="pill">EVENT</span></div>
        <h1 class="hl font-display">${headlineBlock}</h1>
      </div>
      <div class="grid3">
        <div><p class="lab">DATE / TIME</p><p class="val">${escapeHtml(dateDisplay)}</p></div>
        <div><p class="lab">VENUE</p><p class="val">${venueSafe}</p></div>
        <div><p class="lab">CITY</p><p class="val">${citySafe}</p></div>
      </div>
    </div>
    <div class="right">
      <div class="notch"></div>
      <div class="perfs"><span></span><span></span><span></span><span></span><span></span></div>
      <div class="access-block">
        <span class="badge">ACCESS LEVEL</span>
        <h2 class="pass font-display">${pass}</h2>
      </div>
      <div class="qr-wrap"><div class="qr-card"><img class="qr" src="${qr}" alt="" /></div></div>
      <div class="meta">
        <div class="meta-block"><p class="meta-lab">ORDER NUMBER</p><p class="mono font-mono">${orderSafe}</p></div>
        <div class="hr"></div>
        <div class="meta-block"><p class="meta-lab">GUEST NAME</p><p class="guest">${guestSafe}</p></div>
      </div>
      <div class="foot">
        <span class="shield">${SHIELD_SVG}</span>
        <span class="chan">${channelSafe}</span>
      </div>
    </div>
  </div>
  <div class="deco-bottom"><span></span><span></span><span></span></div>
</section>`;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    @import url("https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800,900&f[]=satoshi@400,500,700&f[]=jet-brains-mono@500&display=swap");
    @page { margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #0d0d0d; }
    body {
      font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .font-display {
      font-family: 'Cabinet Grotesk', 'Arial Black', 'Segoe UI', Arial, sans-serif;
    }
    .font-mono {
      font-family: 'JetBrains Mono', ui-monospace, 'Cascadia Mono', 'Consolas', monospace;
    }
    .ticket-page {
      position: relative;
      width: 1440px;
      height: 820px;
      margin: 0 auto;
      background: #1a1a1a;
      border-radius: 40px;
      overflow: hidden;
      box-shadow: 0 0 80px -20px rgba(225, 25, 52, 0.35);
      border: 1px solid rgba(255,255,255,0.06);
      page-break-after: always;
      page-break-inside: avoid;
    }
    .ticket-page:last-of-type { page-break-after: auto; }
    .bg-stack { position: absolute; inset: 0; z-index: 0; }
    .poster { width: 100%; height: 100%; object-fit: cover; object-position: center; opacity: 0.55; }
    .poster-fallback { width: 100%; height: 100%; background: #252525; }
    .overlay {
      position: absolute; inset: 0;
      background: linear-gradient(90deg, #1a1a1a 18%, rgba(26,26,26,0.75) 48%, rgba(225,25,52,0.12) 100%);
    }
    .stipple {
      position: absolute; inset: 0;
      background-image: radial-gradient(#ffffff22 1px, transparent 1px);
      background-size: 20px 20px;
      opacity: 0.15;
      pointer-events: none;
    }
    .content {
      position: relative; z-index: 2;
      display: flex; width: 100%; height: 100%;
    }
    .left {
      flex: 0.7;
      display: flex; flex-direction: column; justify-content: space-between;
      padding: 4rem;
    }
    .row-top { display: flex; align-items: center; gap: 3rem; flex-wrap: wrap; }
    .logo-wrap img.logo { height: 56px; width: auto; display: block; }
    .rule { width: 96px; height: 1px; background: rgba(255,255,255,0.2); flex-shrink: 0; }
    .org { font-size: 12px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.6); max-width: 320px; }
    .mid { display: flex; flex-direction: column; gap: 1rem; }
    .pill-row { display: flex; align-items: center; gap: 1rem; color: #e11934; }
    .dot { width: 8px; height: 8px; border-radius: 9999px; background: #e11934; flex-shrink: 0; }
    .pill { font-size: 12px; font-weight: 700; letter-spacing: 0.3em; text-transform: uppercase; }
    .hl {
      margin: 0;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: -0.05em;
      line-height: 0.85;
      font-size: 100px;
      color: #fff;
    }
    .hl-muted {
      background: linear-gradient(90deg, #fff, rgba(255,255,255,0.38));
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .hl-accent { color: #e11934; }
    .grid3 {
      display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 2rem;
      border-top: 1px solid rgba(255,255,255,0.1); padding-top: 2rem;
    }
    .lab { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #e11934; }
    .val { margin: 6px 0 0; font-size: 1.75rem; font-weight: 500; color: #fff; line-height: 1.35; }
    .right {
      flex: 0.3;
      position: relative;
      display: flex; flex-direction: column; align-items: center; justify-content: space-between;
      padding: 3.25rem 2.5rem;
      border-left: 1px solid rgba(255,255,255,0.1);
      background: rgba(26,26,26,0.4);
      backdrop-filter: blur(24px);
    }
    .notch {
      position: absolute; left: -16px; top: 50%; transform: translateY(-50%);
      width: 32px; height: 32px; border-radius: 9999px; background: #0d0d0d; z-index: 5;
    }
    .perfs {
      position: absolute; left: -1px; top: 0; bottom: 0; width: 1px;
      display: flex; flex-direction: column; justify-content: space-around; padding: 1rem 0;
    }
    .perfs span { width: 4px; height: 8px; background: rgba(255,255,255,0.1); margin: 0 auto; }
    .access-block { text-align: center; }
    .badge {
      display: inline-block; padding: 8px 18px; border-radius: 9999px;
      background: #e11934; color: #fff; font-size: 12px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;
      margin-bottom: 0.85rem;
    }
    .pass {
      margin: 0;
      color: #fff;
      font-size: 2.25rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: -0.03em;
      line-height: 1.05;
    }
    .qr-wrap { position: relative; flex: 0 0 auto; }
    .qr-card { background: #fff; padding: 1.35rem; border-radius: 1.5rem; }
    .qr { width: 228px; height: 228px; display: block; }
    .meta { width: 100%; display: flex; flex-direction: column; gap: 1.1rem; }
    .meta-block { text-align: center; }
    .meta-lab { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.45); }
    .mono { margin: 6px 0 0; font-family: 'JetBrains Mono', ui-monospace, 'Cascadia Mono', monospace; font-size: 1.5rem; color: #fff; }
    .guest { margin: 6px 0 0; font-size: 1.5rem; font-weight: 700; color: #fff; letter-spacing: -0.02em; }
    .hr { height: 1px; background: rgba(255,255,255,0.1); margin: 0; flex-shrink: 0; }
    .foot { display: flex; align-items: center; gap: 8px; opacity: 0.28; }
    .foot .shield { display: flex; align-items: center; }
    .foot .chan { font-size: 10px; font-weight: 700; letter-spacing: 0.24em; text-transform: uppercase; color: #fff; }
    .deco-bottom {
      position: absolute; left: 4rem; bottom: 2rem; z-index: 3;
      display: flex; gap: 1rem; opacity: 0.1;
    }
    .deco-bottom span:nth-child(1) { width: 48px; height: 4px; background: #fff; }
    .deco-bottom span:nth-child(2) { width: 32px; height: 4px; background: #fff; }
    .deco-bottom span:nth-child(3) { width: 16px; height: 4px; background: #fff; }
  </style>
</head>
<body>
${pages.join('\n')}
</body>
</html>`;
}

module.exports = { buildPremiumTicketsPdfHtmlDocument, escapeHtml, splitEventHeadline };
