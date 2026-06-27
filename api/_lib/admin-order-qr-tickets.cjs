'use strict';

const { generateTicketQrDataUrl } = require('./ticket-qr-generate.cjs');
const { isValidSecureToken } = require('./ticket-qr-url.cjs');

/** Cap previews per request to avoid oversized payloads and CPU spikes. */
const MAX_PREVIEW_TICKETS = 48;

function buildTicketLabel(passType, passSequence, index) {
  const base = passType || 'Ticket';
  if (typeof passSequence === 'number' && Number.isFinite(passSequence)) {
    return `${base} #${passSequence + 1}`;
  }
  return `${base} #${index + 1}`;
}

/**
 * Build one admin-safe ticket preview row. secure_token never leaves this function.
 * @param {object} row
 * @param {{ passType?: string|null, index: number, passSequence?: number|null }} meta
 */
async function mapAdminQrPreviewRow(row, { passType, index, passSequence }) {
  let qr_preview_data_url = null;
  const token = row.secure_token;
  if (token && isValidSecureToken(token)) {
    try {
      qr_preview_data_url = await generateTicketQrDataUrl(token);
    } catch {
      console.warn('[admin-order-qr-tickets] preview generation failed for ticket', row.id);
    }
  }

  return {
    id: row.id,
    label: buildTicketLabel(passType, passSequence, index),
    pass_type: passType || null,
    scan_status: row.scan_status ?? null,
    generation_status: row.generation_status ?? null,
    generated_at: row.generated_at || null,
    qr_preview_data_url,
    qr_preview_available: Boolean(qr_preview_data_url),
  };
}

function resolvePassTypeFromJoin(orderPasses) {
  if (orderPasses == null) return null;
  if (Array.isArray(orderPasses)) return orderPasses[0]?.pass_type || null;
  return orderPasses.pass_type || null;
}

/**
 * Read-only: loads tickets for an order and returns server-generated QR previews.
 * @param {import('@supabase/supabase-js').SupabaseClient} dbClient
 * @param {string} orderId
 */
async function loadAdminOrderQrTicketPreviews(dbClient, orderId) {
  const { data: qrRows, error: qrErr } = await dbClient
    .from('qr_tickets')
    .select('id, secure_token, pass_type, ticket_status, generated_at')
    .eq('order_id', orderId)
    .order('generated_at', { ascending: true });

  if (qrErr) {
    console.error('[admin-order-qr-tickets] qr_tickets query failed');
    return { error: 'Failed to load QR tickets' };
  }

  let sourceRows = [];
  if (qrRows && qrRows.length > 0) {
    sourceRows = qrRows.map((r) => ({
      id: r.id,
      secure_token: r.secure_token,
      generated_at: r.generated_at,
      scan_status: r.ticket_status || null,
      generation_status: null,
      pass_type: r.pass_type || null,
      pass_sequence: null,
    }));
  } else {
    const { data: ticketRows, error: tErr } = await dbClient
      .from('tickets')
      .select('id, secure_token, status, generated_at, pass_sequence, order_passes(pass_type)')
      .eq('order_id', orderId)
      .order('generated_at', { ascending: true });

    if (tErr) {
      console.error('[admin-order-qr-tickets] tickets query failed');
      return { error: 'Failed to load tickets' };
    }

    sourceRows = (ticketRows || []).map((t) => ({
      id: t.id,
      secure_token: t.secure_token,
      generated_at: t.generated_at,
      scan_status: null,
      generation_status: t.status || null,
      pass_type: resolvePassTypeFromJoin(t.order_passes),
      pass_sequence: typeof t.pass_sequence === 'number' ? t.pass_sequence : null,
    }));
  }

  const total_count = sourceRows.length;
  const truncated = total_count > MAX_PREVIEW_TICKETS;
  const slice = truncated ? sourceRows.slice(0, MAX_PREVIEW_TICKETS) : sourceRows;

  const tickets = await Promise.all(
    slice.map((row, index) =>
      mapAdminQrPreviewRow(row, {
        passType: row.pass_type,
        index,
        passSequence: row.pass_sequence,
      })
    )
  );

  return {
    tickets,
    total_count,
    truncated,
    preview_limit: MAX_PREVIEW_TICKETS,
  };
}

module.exports = {
  MAX_PREVIEW_TICKETS,
  buildTicketLabel,
  mapAdminQrPreviewRow,
  loadAdminOrderQrTicketPreviews,
};
