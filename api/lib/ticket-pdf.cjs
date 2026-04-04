'use strict';

/**
 * Multi-page PDF tickets (event poster background, guest + pass details, QR).
 * QR payload matches ticket generation: raw secure_token UUID string.
 */

const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

/** Overall ticket size in the PDF (1 = previous 900×320). Lower = smaller on screen/print. */
const TICKET_LAYOUT_SCALE = 0.72;
const FR_MONTHS = [
  'JANVIER',
  'FÉVRIER',
  'MARS',
  'AVRIL',
  'MAI',
  'JUIN',
  'JUILLET',
  'AOÛT',
  'SEPTEMBRE',
  'OCTOBRE',
  'NOVEMBRE',
  'DÉCEMBRE',
];

function streamToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

function fetchUrlBuffer(url, redirects = 0) {
  if (!url || typeof url !== 'string' || redirects > 5) return Promise.resolve(null);
  const u = url.trim();
  if (!/^https?:\/\//i.test(u)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const client = u.startsWith('https') ? https : http;
    const req = client.get(u, { timeout: 12000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = new URL(res.headers.location, u).href;
        res.resume();
        fetchUrlBuffer(next, redirects + 1).then(resolve);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        resolve(null);
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve(buf.length > 0 ? buf : null);
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

function loadLocalLogoBuffer() {
  try {
    const p = path.join(__dirname, '../../public/email-assets/logo-white.png');
    if (fs.existsSync(p)) return fs.readFileSync(p);
  } catch (_) {}
  return null;
}

function formatEventDateFr(iso) {
  if (!iso) return { dateLine: 'DATE À CONFIRMER', timeLine: '' };
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return { dateLine: 'DATE À CONFIRMER', timeLine: '' };
    const day = d.getDate();
    const mon = FR_MONTHS[d.getMonth()] || '';
    const y = d.getFullYear();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const end = new Date(d.getTime() + 4 * 60 * 60 * 1000);
    const eh = String(end.getHours()).padStart(2, '0');
    const em = String(end.getMinutes()).padStart(2, '0');
    return {
      dateLine: `${day} ${mon} ${y}`.toUpperCase(),
      timeLine: `${h}:${m} • ${eh}:${em}`,
    };
  } catch {
    return { dateLine: 'DATE À CONFIRMER', timeLine: '' };
  }
}

function venueLine(venue, city) {
  const parts = [venue, city].filter(Boolean).map((s) => String(s).trim()).filter(Boolean);
  return parts.join(', ').toUpperCase() || 'LIEU À CONFIRMER';
}

function sortTickets(tickets, passes) {
  const order = new Map();
  (passes || []).forEach((p, i) => order.set(p.id, i));
  return [...(tickets || [])].sort((a, b) => {
    const ai = order.get(a.order_pass_id) ?? 999;
    const bi = order.get(b.order_pass_id) ?? 999;
    if (ai !== bi) return ai - bi;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

function passTypeFor(ticket, passes) {
  const p = (passes || []).find((x) => x.id === ticket.order_pass_id);
  return p?.pass_type || ticket.pass_type || 'Standard';
}

/** Top-right band e.g. "NORMAL • FIRST RELEASE" (full line bold). */
function passTierHeaderLine(ticket, passes) {
  const p = (passes || []).find((x) => x.id === ticket.order_pass_id);
  const left = String(passTypeFor(ticket, passes) || 'STANDARD')
    .trim()
    .toUpperCase();
  const right = String(p?.pass_detail || p?.pass_name || p?.event_pass_name || 'ANDIAMO')
    .trim()
    .toUpperCase();
  return `${left} • ${right}`;
}

function drawDottedStubLine(doc, x, y1, y2) {
  doc.save();
  doc.strokeColor('#ffffff');
  doc.lineWidth(1);
  doc.dash(4, { space: 5 });
  doc.moveTo(x, y1).lineTo(x, y2).stroke();
  doc.undash();
  doc.restore();
}

/**
 * @param {object} opts
 * @param {string} opts.customerName
 * @param {string} opts.eventName
 * @param {string|null|undefined} opts.eventDateIso
 * @param {string|null|undefined} opts.venue
 * @param {string|null|undefined} opts.city
 * @param {string|null|undefined} opts.posterUrl
 * @param {Array<{ id?: string, order_pass_id?: string, secure_token: string }>} opts.tickets
 * @param {Array<{ id: string, pass_type?: string, pass_detail?: string, pass_name?: string }>} [opts.passes]
 */
async function buildTicketsPdfBuffer(opts) {
  const {
    customerName,
    eventName,
    eventDateIso,
    venue,
    city,
    posterUrl,
    tickets: rawTickets,
    passes,
  } = opts;

  const tickets = sortTickets(rawTickets, passes).filter((t) => t && String(t.secure_token || '').trim());
  if (!tickets.length) {
    throw new Error('buildTicketsPdfBuffer: no tickets');
  }

  const posterBuf = await fetchUrlBuffer(posterUrl || '');
  const logoBuf = loadLocalLogoBuffer();
  const { dateLine, timeLine } = formatEventDateFr(eventDateIso);
  const venueStr = venueLine(venue, city);
  const displayName = String(customerName || 'Invité').trim() || 'Invité';
  const evTitle = String(eventName || 'Événement').trim() || 'Événement';

  const S = TICKET_LAYOUT_SCALE;
  const u = (n) => Math.max(1, Math.round(Number(n) * S));
  const fsp = (pt) => Math.max(7, Math.round(Number(pt) * S));
  const PAGE_W = u(900);
  const PAGE_H = u(320);
  const STUB_X = u(702);

  const doc = new PDFDocument({ size: [PAGE_W, PAGE_H], margin: 0, autoFirstPage: false });

  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i];
    const token = String(t.secure_token || '').trim();
    if (!token) continue;

    const qrPx = Math.max(160, Math.round(260 * S));
    const qrPng = await QRCode.toBuffer(token, { type: 'png', width: qrPx, margin: 1, errorCorrectionLevel: 'M' });

    doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });

    if (posterBuf) {
      try {
        doc.image(posterBuf, 0, 0, { width: PAGE_W, height: PAGE_H });
      } catch (_) {
        doc.save();
        doc.rect(0, 0, PAGE_W, PAGE_H).fill('#1a0a0f');
        doc.restore();
      }
    } else {
      doc.save();
      doc.rect(0, 0, PAGE_W, PAGE_H).fill('#1a0a0f');
      doc.restore();
    }

    doc.save();
    doc.fillColor('#000000').opacity(0.58);
    doc.rect(0, 0, STUB_X, PAGE_H).fill();
    doc.restore();

    doc.save();
    doc.fillColor('#000000').opacity(0.45);
    doc.rect(STUB_X, 0, PAGE_W - STUB_X, PAGE_H).fill();
    doc.restore();

    doc.lineWidth(Math.max(1, u(2)));
    doc.strokeColor('#ffffff');
    const insetFrame = u(3);
    doc.rect(insetFrame, insetFrame, PAGE_W - insetFrame * 2, PAGE_H - insetFrame * 2).stroke();

    drawDottedStubLine(doc, STUB_X, u(14), PAGE_H - u(14));

    const idx = i + 1;
    const leftPad = u(26);
    const stubContentW = STUB_X - leftPad * 2;
    const guestColW = Math.max(u(210), Math.min(u(310), Math.floor(stubContentW * 0.44)));
    const heroGap = u(12);
    const heroX = leftPad + guestColW + heroGap;
    const heroW = Math.max(u(120), stubContentW - guestColW - heroGap);
    const logoW = Math.min(u(158), guestColW - u(24));
    const logoBoxH = u(58);

    const tierHeader = passTierHeaderLine(t, passes);

    // Left column: logo + index (taille actuelle), textes alignés à gauche comme avant
    const logoTop = u(14);
    let logoBottom = logoTop;
    if (logoBuf) {
      try {
        doc.image(logoBuf, leftPad, logoTop, { fit: [logoW, logoBoxH] });
        logoBottom = logoTop + logoBoxH;
      } catch (_) {
        logoBottom = logoTop + u(40);
      }
    } else {
      logoBottom = logoTop + u(32);
    }

    doc.font('Helvetica-Bold').fontSize(fsp(12));
    doc.fillColor('#ffffff').opacity(1);
    doc.text(String(idx), leftPad + logoW + u(10), logoTop + u(16), { width: u(40) });

    const afterLogo = logoBottom + u(10);

    doc.save();
    doc.strokeColor('#ffffff').opacity(0.65);
    doc.lineWidth(Math.max(0.5, u(0.75)));
    doc.dash(2, { space: 5 });
    doc.moveTo(leftPad, afterLogo).lineTo(leftPad + guestColW, afterLogo).stroke();
    doc.undash();
    doc.restore();

    let y = afterLogo + u(12);
    doc.font('Helvetica-Bold').fontSize(fsp(17));
    doc.fillColor('#ffffff').opacity(1);
    doc.text(displayName, leftPad, y, { width: guestColW, lineGap: u(6) });
    y = doc.y + u(14);

    doc.save();
    doc.strokeColor('#ffffff').opacity(0.65);
    doc.dash(2, { space: 5 });
    doc.moveTo(leftPad, y).lineTo(leftPad + guestColW, y).stroke();
    doc.undash();
    doc.restore();

    y += u(10);
    doc.font('Helvetica-Bold').fontSize(fsp(12));
    doc.text(dateLine, leftPad, y, { width: guestColW, lineGap: u(5) });
    y = doc.y + u(5);
    if (timeLine) {
      doc.font('Helvetica').fontSize(fsp(11));
      doc.fillColor('#ffffff').opacity(0.95);
      doc.text(timeLine, leftPad, y, { width: guestColW, lineGap: u(4) });
      y = doc.y + u(12);
    } else {
      y += u(12);
    }

    doc.save();
    doc.strokeColor('#ffffff').opacity(0.65);
    doc.dash(2, { space: 5 });
    doc.moveTo(leftPad, y).lineTo(leftPad + guestColW, y).stroke();
    doc.undash();
    doc.restore();

    y += u(10);
    doc.font('Helvetica').fontSize(fsp(10));
    doc.fillColor('#ffffff').opacity(0.96);
    doc.text(venueStr, leftPad, y, { width: guestColW, lineGap: u(5) });

    // Main hero zone: pass tier + title alignés à droite (comme avant)
    const tierY = u(14);
    doc.font('Helvetica-Bold').fontSize(fsp(8));
    doc.fillColor('#ffffff').opacity(0.98);
    doc.text(tierHeader, heroX, tierY, { width: heroW, align: 'right' });

    const evUpper = evTitle.toUpperCase();
    const heroLine1 = `${evUpper} — ORGANIZED BY`;
    const heroLine2 = 'ANDIAMO';
    const heroFont = fsp(20);
    const heroBody = `${heroLine1}\n${heroLine2}`;
    doc.font('Helvetica-Bold').fontSize(heroFont);
    doc.fillColor('#ffffff').opacity(1);
    const heroBlock = doc.heightOfString(heroBody, { width: heroW, lineGap: u(6) });
    const tierBottom = tierY + fsp(8) + u(8);
    let heroTextY = (PAGE_H - heroBlock) / 2;
    if (heroTextY < tierBottom) heroTextY = tierBottom;
    if (heroTextY + heroBlock > PAGE_H - u(14)) heroTextY = Math.max(tierBottom, PAGE_H - u(14) - heroBlock);

    doc.font('Helvetica-Bold').fontSize(heroFont);
    doc.text(heroBody, heroX, heroTextY, { width: heroW, align: 'right', lineGap: u(6) });

    const stubW = PAGE_W - STUB_X;
    const box = Math.min(u(168), stubW - u(28));
    const qx = STUB_X + (stubW - box) / 2;
    const qy = (PAGE_H - box) / 2;
    const qrRadius = u(4);
    doc.save();
    doc.fillColor('#ffffff').opacity(1);
    doc.roundedRect(qx, qy, box, box, qrRadius).fill();
    doc.restore();
    try {
      const inset = u(12);
      doc.image(qrPng, qx + inset, qy + inset, { width: box - inset * 2, height: box - inset * 2 });
    } catch (_) {}
  }

  return streamToBuffer(doc);
}

/**
 * Nodemailer attachments array (single PDF), or [] if generation fails.
 * @param {object} order — must include user_name, id, order_number?, events?: { name, date, venue, city?, poster_url? }
 * @param {Array} tickets — rows with secure_token, order_pass_id
 * @param {Array} orderPasses — order_passes rows with id, pass_type
 */
async function buildTicketEmailPdfAttachments(order, tickets, orderPasses) {
  try {
    const ev = order?.events || {};
    const buf = await buildTicketsPdfBuffer({
      customerName: order?.user_name,
      eventName: ev.name,
      eventDateIso: ev.date,
      venue: ev.venue,
      city: ev.city,
      posterUrl: ev.poster_url,
      tickets,
      passes: orderPasses || [],
    });
    const base =
      order?.order_number != null
        ? `Andiamo-Tickets-${order.order_number}`
        : `Andiamo-Tickets-${String(order?.id || 'order').slice(0, 8)}`;
    const safe = base.replace(/[^\w.-]+/g, '_');
    return [{ filename: `${safe}.pdf`, content: buf, contentType: 'application/pdf' }];
  } catch (e) {
    console.warn('[ticket-pdf] attachment skipped:', e?.message || e);
    return [];
  }
}

module.exports = {
  buildTicketsPdfBuffer,
  buildTicketEmailPdfAttachments,
};
