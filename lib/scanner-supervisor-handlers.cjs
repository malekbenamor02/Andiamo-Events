'use strict';

/** Escape % and _ for Postgres ILIKE */
function escapeIlike(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function ticketPublicFromRow(qt) {
  if (!qt) return null;
  const copy = { ...qt };
  delete copy.secure_token;
  const st = qt.secure_token;
  copy.secure_token_preview =
    st && typeof st === 'string' && st.length > 4 ? `…${st.slice(-4)}` : null;
  return copy;
}

async function loadScanHistory(db, qrTicketId) {
  const { data: rows } = await db
    .from('scans')
    .select('id, scan_time, scan_result, scan_location, notes, scanner_id, event_id, device_info')
    .eq('qr_ticket_id', qrTicketId)
    .order('scan_time', { ascending: false })
    .limit(100);
  const sids = [...new Set((rows || []).map((r) => r.scanner_id).filter(Boolean))];
  const names = {};
  if (sids.length) {
    const { data: sc } = await db.from('scanners').select('id, name').in('id', sids);
    (sc || []).forEach((s) => {
      names[s.id] = s.name;
    });
  }
  return (rows || []).map((r) => ({
    ...r,
    scanner_name: r.scanner_id ? names[r.scanner_id] || null : null,
  }));
}

/**
 * Read-only ticket inspect (no mutations).
 * @returns {{ status: number, body: object }}
 */
async function supervisorLookupTicket(db, { secure_token, event_id }) {
  const { data: cfg } = await db.from('scan_system_config').select('scan_enabled').limit(1).single();
  if (!cfg || !cfg.scan_enabled) {
    return {
      status: 503,
      body: { success: false, enabled: false, message: 'Scan system is not started', result: 'disabled' },
    };
  }
  const st = typeof secure_token === 'string' ? secure_token.trim() : '';
  const ev = typeof event_id === 'string' ? event_id.trim() : '';
  if (!st) {
    return { status: 400, body: { success: false, result: 'invalid', message: 'secure_token required' } };
  }
  if (!ev || !/^[0-9a-f-]{36}$/i.test(ev)) {
    return {
      status: 400,
      body: { success: false, result: 'invalid', message: 'event_id required and must be UUID' },
    };
  }

  const { data: qt, error: qtErr } = await db.from('qr_tickets').select('*').eq('secure_token', st).single();
  if (qtErr || !qt) {
    return { status: 200, body: { success: false, result: 'invalid', message: 'Ticket not found' } };
  }

  let invitation = null;
  if (qt.invitation_id) {
    const { data: inv } = await db.from('official_invitations').select('*').eq('id', qt.invitation_id).single();
    invitation = inv || null;
  }
  const scan_history = await loadScanHistory(db, qt.id);
  const ticket = ticketPublicFromRow(qt);
  const evId = qt.event_id ? String(qt.event_id) : null;

  if (evId && evId !== ev) {
    return {
      status: 200,
      body: {
        success: false,
        result: 'wrong_event',
        message: 'This ticket is for a different event',
        correct_event: {
          event_id: evId,
          event_name: qt.event_name || null,
          event_date: qt.event_date || null,
        },
        ticket,
        invitation,
        scan_history,
      },
    };
  }

  const { data: validScan } = await db
    .from('scans')
    .select('id, scan_time, scanner_id')
    .eq('qr_ticket_id', qt.id)
    .eq('scan_result', 'valid')
    .limit(1)
    .maybeSingle();

  let previous_scan = null;
  if (validScan && validScan.scanner_id) {
    const { data: sn } = await db.from('scanners').select('name').eq('id', validScan.scanner_id).single();
    previous_scan = { scanned_at: validScan.scan_time, scanner_name: sn?.name || null };
  }

  return {
    status: 200,
    body: {
      success: true,
      result: 'ok',
      ticket,
      invitation,
      scan_history,
      previous_scan,
      ticket_status: qt.ticket_status || null,
    },
  };
}

async function resolveQrTicketIdsForSearch(db, event_id, qRaw) {
  const q = typeof qRaw === 'string' ? qRaw.trim() : '';
  if (q.length < 3) return null;
  const compact = q.replace(/-/g, '');
  const looksLikeToken =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q) ||
    (compact.length === 32 && /^[0-9a-f]+$/i.test(compact));
  if (looksLikeToken) {
    let token = q.trim();
    if (!/^[0-9a-f-]{36}$/i.test(token)) {
      const c = token.replace(/-/g, '');
      if (c.length === 32 && /^[0-9a-f]+$/i.test(c)) {
        token = `${c.slice(0, 8)}-${c.slice(8, 12)}-${c.slice(12, 16)}-${c.slice(16, 20)}-${c.slice(20, 32)}`;
      }
    }
    const { data: rows } = await db
      .from('qr_tickets')
      .select('id')
      .eq('event_id', event_id)
      .eq('secure_token', token);
    return (rows || []).map((r) => r.id);
  }
  const esc = escapeIlike(q.replace(/,/g, ''));
  const like = `%${esc}%`;
  const [r1, r2, r3] = await Promise.all([
    db.from('qr_tickets').select('id').eq('event_id', event_id).ilike('buyer_name', like),
    db.from('qr_tickets').select('id').eq('event_id', event_id).ilike('buyer_email', like),
    db.from('qr_tickets').select('id').eq('event_id', event_id).ilike('buyer_phone', like),
  ]);
  const ids = new Set();
  [r1.data, r2.data, r3.data].forEach((arr) => (arr || []).forEach((row) => ids.add(row.id)));
  return [...ids].slice(0, 200);
}

/**
 * Event-wide scans for supervisors (same enrichment as admin scan-history).
 */
async function supervisorEventScans(db, { event_id, date_from, date_to, scan_result, q }) {
  if (!event_id || !/^[0-9a-f-]{36}$/i.test(event_id)) {
    return { status: 400, body: { error: 'event_id required and must be UUID' } };
  }
  let qrFilterIds = null;
  if (typeof q === 'string' && q.trim().length >= 3) {
    qrFilterIds = await resolveQrTicketIdsForSearch(db, event_id, q);
    if (Array.isArray(qrFilterIds) && qrFilterIds.length === 0) {
      return { status: 200, body: { scans: [], total: 0 } };
    }
  }

  const buildQuery = (cols) => {
    let query = db
      .from('scans')
      .select(cols, { count: 'exact' })
      .eq('event_id', event_id)
      .order('scan_time', { ascending: false })
      .range(0, 199);
    if (qrFilterIds && qrFilterIds.length) query = query.in('qr_ticket_id', qrFilterIds);
    if (date_from) query = query.gte('scan_time', date_from);
    if (date_to) query = query.lte('scan_time', date_to);
    if (['valid', 'invalid', 'already_scanned', 'wrong_event'].includes(scan_result)) {
      query = query.eq('scan_result', scan_result);
    }
    return query;
  };

  let cols = 'id, scan_time, scan_result, scan_location, event_id, qr_ticket_id, scanner_id';
  let { data: rows, error, count } = await buildQuery(cols);
  if (error && /qr_ticket_id|scanner_id|does not exist/i.test(error.message || '')) {
    cols = 'id, scan_time, scan_result, scan_location, event_id';
    const r2 = await buildQuery(cols);
    rows = r2.data;
    error = r2.error;
    count = r2.count;
  }
  if (error) {
    return { status: 500, body: { error: error.message } };
  }
  const hasScannerCols = rows && rows[0] && ('qr_ticket_id' in rows[0] || 'scanner_id' in rows[0]);
  const qids = hasScannerCols ? (rows || []).map((r) => r.qr_ticket_id).filter(Boolean) : [];
  const sids = hasScannerCols ? (rows || []).map((r) => r.scanner_id).filter(Boolean) : [];
  const qr = {};
  const sc = {};
  if (qids.length) {
    const { data: qrData } = await db
      .from('qr_tickets')
      .select('id, buyer_name, pass_type, ambassador_name, event_name')
      .in('id', qids);
    (qrData || []).forEach((x) => {
      qr[x.id] = x;
    });
  }
  if (sids.length) {
    const { data: scData } = await db.from('scanners').select('id, name').in('id', sids);
    (scData || []).forEach((s) => {
      sc[s.id] = s;
    });
  }
  const list = (rows || []).map((r) => ({
    ...r,
    buyer_name: r.qr_ticket_id && qr[r.qr_ticket_id] ? qr[r.qr_ticket_id].buyer_name : null,
    pass_type: r.qr_ticket_id && qr[r.qr_ticket_id] ? qr[r.qr_ticket_id].pass_type : null,
    ambassador_name: r.qr_ticket_id && qr[r.qr_ticket_id] ? qr[r.qr_ticket_id].ambassador_name : null,
    event_name: r.qr_ticket_id && qr[r.qr_ticket_id] ? qr[r.qr_ticket_id].event_name : null,
    scanner_name: r.scanner_id && sc[r.scanner_id] ? sc[r.scanner_id].name : null,
  }));
  return { status: 200, body: { scans: list, total: count != null ? count : list.length } };
}

async function supervisorEventStatistics(db, { event_id, date_from, date_to }) {
  if (!event_id || !/^[0-9a-f-]{36}$/i.test(event_id)) {
    return { status: 400, body: { error: 'event_id required and must be UUID' } };
  }
  const buildQuery = (cols) => {
    let query = db.from('scans').select(cols).eq('event_id', event_id);
    if (date_from) query = query.gte('scan_time', date_from);
    if (date_to) query = query.lte('scan_time', date_to);
    return query;
  };
  let cols = 'scan_result, qr_ticket_id, scanner_id';
  let { data: rows, error } = await buildQuery(cols);
  if (error && /qr_ticket_id|scanner_id|does not exist/i.test(error.message || '')) {
    const r2 = await buildQuery('scan_result');
    rows = r2.data;
    error = r2.error;
  }
  if (error) {
    return { status: 500, body: { error: error.message } };
  }
  const total = (rows || []).length;
  const byStatus = { valid: 0, invalid: 0, already_scanned: 0, wrong_event: 0 };
  const byScanner = {};
  const byScannerStatus = {};
  (rows || []).forEach((r) => {
    if (byStatus[r.scan_result] != null) byStatus[r.scan_result]++;
    if (r.scanner_id) {
      byScanner[r.scanner_id] = (byScanner[r.scanner_id] || 0) + 1;
      if (!byScannerStatus[r.scanner_id]) {
        byScannerStatus[r.scanner_id] = {
          total: 0,
          valid: 0,
          invalid: 0,
          already_scanned: 0,
          wrong_event: 0,
        };
      }
      byScannerStatus[r.scanner_id].total += 1;
      if (byScannerStatus[r.scanner_id][r.scan_result] != null) {
        byScannerStatus[r.scanner_id][r.scan_result] += 1;
      }
    }
  });
  const hasQrCol = rows && rows[0] && 'qr_ticket_id' in rows[0];
  const qids = hasQrCol ? (rows || []).map((r) => r.qr_ticket_id).filter(Boolean) : [];
  const byPass = {};
  if (qids.length) {
    const { data: qr } = await db.from('qr_tickets').select('id, pass_type').in('id', qids);
    (qr || []).forEach((x) => {
      byPass[x.pass_type] = (byPass[x.pass_type] || 0) + 1;
    });
  }
  const scannerIds = Object.keys(byScannerStatus);
  const scannerNames = {};
  if (scannerIds.length) {
    const { data: scannerRows } = await db.from('scanners').select('id, name').in('id', scannerIds);
    (scannerRows || []).forEach((s) => {
      scannerNames[s.id] = s.name;
    });
  }
  const { count: remainingCount } = await db
    .from('qr_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', event_id)
    .eq('ticket_status', 'VALID');
  const remaining_valid_passes = remainingCount || 0;
  return {
    status: 200,
    body: {
      total,
      byStatus,
      byPass,
      byScanner,
      byScannerStatus,
      scannerNames,
      remaining_valid_passes,
    },
  };
}

module.exports = {
  supervisorLookupTicket,
  supervisorEventScans,
  supervisorEventStatistics,
  ticketPublicFromRow,
};
