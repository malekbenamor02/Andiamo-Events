'use strict';

const { maskTokenForLogs } = require('./ticket-qr-url.cjs');

/** Safe ticket id for logs — never log secure_token values. */
function ticketLogId(ticket) {
  if (!ticket || typeof ticket !== 'object') return 'unknown';
  if (ticket.id != null && String(ticket.id).trim()) return String(ticket.id);
  if (ticket.order_pass_id != null) return `pass:${ticket.order_pass_id}`;
  return 'unknown';
}

function logQrRegistryPopulated(ticket) {
  console.log(`✅ QR Registry populated for ticket ${ticketLogId(ticket)}`);
}

function logQrRegistryInsertError(ticket, registryInsertError, extra = {}) {
  console.error(`❌ QR Registry Insert Error for ticket ${ticketLogId(ticket)}:`, {
    error: registryInsertError?.message,
    code: registryInsertError?.code,
    details: registryInsertError?.details,
    hint: registryInsertError?.hint,
    hasSecureToken: !!(ticket && ticket.secure_token),
    ...extra,
  });
}

function logQrRegistryFailure(ticket, registryError, extra = {}) {
  console.error(`⚠️ Failed to populate QR registry for ticket ${ticketLogId(ticket)}:`, {
    error: registryError?.message,
    hasSecureToken: !!(ticket && ticket.secure_token),
    ...extra,
  });
}

module.exports = {
  maskTokenForLogs,
  ticketLogId,
  logQrRegistryPopulated,
  logQrRegistryInsertError,
  logQrRegistryFailure,
};
