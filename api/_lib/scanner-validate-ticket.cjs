'use strict';

/**
 * Maps atomic RPC result to scanner validate-ticket HTTP response (matches legacy scan.js shape).
 */
async function buildValidateTicketHttpResponse(db, rpcResult) {
  const result = rpcResult?.result;
  const qt = rpcResult?.ticket || {};

  if (result === 'not_found') {
    return {
      status: 200,
      body: {
        success: false,
        result: 'invalid',
        message: rpcResult.message || 'Ticket not found',
      },
    };
  }

  if (result === 'wrong_event') {
    return {
      status: 200,
      body: {
        success: false,
        result: 'wrong_event',
        message: rpcResult.message || 'This ticket is for a different event',
        correct_event: rpcResult.correct_event || {
          event_id: qt.event_id || null,
          event_name: qt.event_name || null,
          event_date: qt.event_date || null,
        },
      },
    };
  }

  if (result === 'already_used') {
    const isInvDup = qt.source === 'official_invitation';
    let ticketDup;
    if (isInvDup) {
      ticketDup = await buildInvitationTicketFields(db, qt);
    }
    return {
      status: 200,
      body: {
        success: false,
        result: 'already_scanned',
        message: rpcResult.message || 'Ticket already scanned',
        previous_scan: rpcResult.previous_scan || { scanned_at: null, scanner_name: 'Unknown' },
        ...(ticketDup && { ticket: ticketDup }),
      },
    };
  }

  if (result === 'valid') {
    const isInv = qt.source === 'official_invitation';
    const scannedAt = rpcResult.scan_time || new Date().toISOString();
    let invFields = {};
    if (isInv) {
      invFields = await buildInvitationTicketFields(db, qt);
    }
    const ticket = {
      pass_type: qt.pass_type || null,
      buyer_name: qt.buyer_name || null,
      ambassador_name: isInv ? null : qt.ambassador_name || null,
      event_name: qt.event_name || null,
      event_date: qt.event_date || null,
      event_venue: qt.event_venue || null,
      is_invitation: isInv,
      source: qt.source || null,
      scanned_at: scannedAt,
      ...(isInv ? invFields : {}),
    };
    return {
      status: 200,
      body: {
        success: true,
        result: 'valid',
        message: 'Ticket validated',
        ticket,
      },
    };
  }

  return {
    status: 500,
    body: {
      success: false,
      result: 'error',
      message: rpcResult?.message || 'Validation failed',
    },
  };
}

async function buildInvitationTicketFields(db, qt) {
  let invData = null;
  if (qt.invitation_id) {
    const { data: inv } = await db
      .from('official_invitations')
      .select('invitation_number, recipient_name, recipient_phone, recipient_email')
      .eq('id', qt.invitation_id)
      .maybeSingle();
    invData = inv;
  }
  return {
    is_invitation: true,
    pass_type: qt.pass_type || null,
    invitation_number: invData?.invitation_number || null,
    recipient_name: invData?.recipient_name || qt.buyer_name || null,
    recipient_phone: invData?.recipient_phone || qt.buyer_phone || null,
    recipient_email: invData?.recipient_email || qt.buyer_email || null,
  };
}

async function validateScannerTicketAtomic(db, {
  secureToken,
  eventId,
  scannerId,
  scanLocation,
  deviceInfo,
}) {
  const { data, error } = await db.rpc('validate_scanner_ticket_atomic', {
    p_secure_token: secureToken,
    p_event_id: eventId,
    p_scanner_id: scannerId,
    p_scan_location: scanLocation,
    p_device_info: deviceInfo,
  });

  if (error) {
    console.error('validate_scanner_ticket_atomic RPC error:', error.message || error);
    return {
      status: 500,
      body: { success: false, result: 'error', message: 'Validation failed' },
    };
  }

  return buildValidateTicketHttpResponse(db, data);
}

module.exports = {
  validateScannerTicketAtomic,
  buildValidateTicketHttpResponse,
};
