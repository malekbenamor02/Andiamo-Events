'use strict';

const { generateTicketQrPngBuffer } = require('./ticket-qr-generate.cjs');
const { isValidSecureToken, maskTokenForLogs } = require('./ticket-qr-url.cjs');

function ticketQrCidForId(ticketId, fallbackIndex = 0) {
  const raw = ticketId != null && String(ticketId).trim() !== '' ? String(ticketId) : `idx-${fallbackIndex}`;
  const safe = raw.replace(/[^a-zA-Z0-9-]/gi, '').slice(0, 48) || `idx-${fallbackIndex}`;
  return `ticket-qr-${safe}`;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build nodemailer-compatible inline CID attachments from tickets (requires secure_token).
 * @param {{ id?: string, secure_token?: string }[]} tickets
 */
async function buildTicketQrInlineAttachments(tickets) {
  const attachments = [];
  const enriched = [];
  let idx = 0;
  for (const t of tickets || []) {
    idx += 1;
    if (!t || !isValidSecureToken(t.secure_token)) {
      enriched.push({ ...t, qr_image_cid: null });
      continue;
    }
    try {
      const buffer = await generateTicketQrPngBuffer(t.secure_token);
      const cid = ticketQrCidForId(t.id, idx);
      attachments.push({
        filename: `${cid}.png`,
        content: buffer,
        cid,
        contentType: 'image/png',
        contentDisposition: 'inline',
      });
      enriched.push({ ...t, qr_image_cid: cid });
    } catch (e) {
      console.error('[ticket-qr-email] QR generation failed', maskTokenForLogs(t.secure_token), e.message);
      enriched.push({ ...t, qr_image_cid: null });
    }
  }
  return { attachments, enrichedTickets: enriched };
}

/**
 * Enrich tickets grouped by pass type with qr_image_cid + collect CID attachments.
 * @param {Map<string, object[]>|Array<[string, object[]]>} ticketsByPassType
 */
async function prepareTicketsByPassTypeForEmail(ticketsByPassType) {
  const entries =
    ticketsByPassType instanceof Map
      ? Array.from(ticketsByPassType.entries())
      : Array.isArray(ticketsByPassType)
        ? ticketsByPassType
        : [];

  const flat = [];
  for (const [, list] of entries) {
    for (const t of list || []) flat.push(t);
  }

  const { attachments, enrichedTickets } = await buildTicketQrInlineAttachments(flat);
  const byId = new Map();
  enrichedTickets.forEach((t, i) => {
    if (t.id != null) byId.set(t.id, t);
    else byId.set(`__idx_${i}`, t);
  });

  const newMap = new Map();
  let flatIdx = 0;
  for (const [passType, list] of entries) {
    newMap.set(
      passType,
      (list || []).map((t) => {
        const key = t.id != null ? t.id : `__idx_${flatIdx}`;
        flatIdx += 1;
        return byId.get(key) || t;
      })
    );
  }

  return { ticketsByPassType: newMap, qrAttachments: attachments };
}

/**
 * Invitation / qr_tickets rows (may lack tickets.id).
 * @param {{ id?: string, secure_token?: string }[]} qrCodes
 */
async function prepareQrCodesForInvitationEmail(qrCodes) {
  const withIds = (qrCodes || []).map((q, i) => ({
    ...q,
    id: q.id || `inv-${i}`,
  }));
  const { attachments, enrichedTickets } = await buildTicketQrInlineAttachments(withIds);
  return {
    qrCodes: enrichedTickets.map(({ qr_image_cid, secure_token, id }) => ({
      secure_token,
      qr_image_cid,
      id,
    })),
    qrAttachments: attachments,
  };
}

function mergeEmailAttachments(qrAttachments, otherAttachments) {
  const out = [...(qrAttachments || [])];
  if (Array.isArray(otherAttachments)) out.push(...otherAttachments);
  else if (otherAttachments) out.push(otherAttachments);
  return out.length ? out : undefined;
}

module.exports = {
  ticketQrCidForId,
  buildTicketQrInlineAttachments,
  prepareTicketsByPassTypeForEmail,
  prepareQrCodesForInvitationEmail,
  mergeEmailAttachments,
  escapeHtml,
};
