'use strict';

/** Escape % and _ for Postgres ILIKE */
function escapeIlike(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function tokenPreview(secureToken) {
  if (!secureToken || typeof secureToken !== 'string' || secureToken.length <= 4) return null;
  return `…${secureToken.slice(-4)}`;
}

function paymentMethodLabel(pm) {
  if (!pm) return '—';
  const m = {
    online: 'Online',
    cod: 'Cash on delivery',
    external_app: 'External app',
    ambassador_cash: 'Ambassador cash',
    pos: 'POS',
  };
  return m[String(pm).toLowerCase()] || String(pm);
}

function ticketPublicFromRow(qt) {
  if (!qt) return null;
  const copy = { ...qt };
  delete copy.secure_token;
  const st = qt.secure_token;
  copy.secure_token_preview = tokenPreview(st);
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
 * Order + sibling passes for inspect UI (no full secure_token in output).
 */
async function enrichInspectOrderData(db, qt) {
  if (!qt.order_id) {
    return { inspect_panel: null, order_passes: null };
  }
  const { data: ord } = await db.from('orders').select('id, order_number').eq('id', qt.order_id).maybeSingle();
  const order_number = ord?.order_number != null ? String(ord.order_number) : null;

  const evMatch = qt.event_id;
  const { data: sibs } = await db
    .from('qr_tickets')
    .select('id, pass_type, ticket_status, secure_token, order_pass_id')
    .eq('order_id', qt.order_id)
    .eq('event_id', evMatch);

  const order_passes = (sibs || [])
    .map((row) => ({
      qr_ticket_id: row.id,
      pass_type: row.pass_type || null,
      ticket_status: row.ticket_status || null,
      token_preview: tokenPreview(row.secure_token),
      is_current: row.id === qt.id,
    }))
    .sort((a, b) => {
      const pa = (a.pass_type || '').localeCompare(b.pass_type || '');
      if (pa !== 0) return pa;
      return String(a.qr_ticket_id).localeCompare(String(b.qr_ticket_id));
    });

  const priceNum = qt.pass_price != null ? Number(qt.pass_price) : null;
  const inspect_panel = {
    qr_ticket_id: qt.id,
    pass_type: qt.pass_type || null,
    buyer_name: qt.buyer_name || null,
    buyer_email: qt.buyer_email || null,
    buyer_phone: qt.buyer_phone || null,
    event_name: qt.event_name || null,
    payment_method: qt.payment_method || null,
    payment_method_label: paymentMethodLabel(qt.payment_method),
    pass_price: priceNum != null && !Number.isNaN(priceNum) ? priceNum : null,
    pass_price_formatted:
      priceNum != null && !Number.isNaN(priceNum) ? priceNum.toFixed(2) : null,
    order_number,
  };
  return { inspect_panel, order_passes };
}

async function buildInspectExtras(db, qt) {
  let invitation = null;
  if (qt.invitation_id) {
    const { data: inv } = await db.from('official_invitations').select('*').eq('id', qt.invitation_id).single();
    invitation = inv || null;
  }
  const scan_history = await loadScanHistory(db, qt.id);

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

  const { inspect_panel, order_passes } = await enrichInspectOrderData(db, qt);
  const ticket = ticketPublicFromRow(qt);

  return {
    ticket,
    invitation,
    scan_history,
    previous_scan,
    ticket_status: qt.ticket_status || null,
    inspect_panel,
    order_passes,
  };
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

  const evId = qt.event_id ? String(qt.event_id) : null;
  const extras = await buildInspectExtras(db, qt);

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
        ...extras,
      },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      result: 'ok',
      ...extras,
    },
  };
}

/**
 * Same inspect payload as lookup, keyed by qr_ticket_id + event_id (supervisor).
 */
async function supervisorInspectDetail(db, { qr_ticket_id, event_id }) {
  const { data: cfg } = await db.from('scan_system_config').select('scan_enabled').limit(1).single();
  if (!cfg || !cfg.scan_enabled) {
    return {
      status: 503,
      body: { success: false, enabled: false, message: 'Scan system is not started', result: 'disabled' },
    };
  }
  const qid = typeof qr_ticket_id === 'string' ? qr_ticket_id.trim() : '';
  const ev = typeof event_id === 'string' ? event_id.trim() : '';
  if (!qid || !/^[0-9a-f-]{36}$/i.test(qid)) {
    return { status: 400, body: { success: false, error: 'qr_ticket_id required and must be UUID' } };
  }
  if (!ev || !/^[0-9a-f-]{36}$/i.test(ev)) {
    return { status: 400, body: { success: false, error: 'event_id required and must be UUID' } };
  }

  const { data: qt, error: qtErr } = await db.from('qr_tickets').select('*').eq('id', qid).single();
  if (qtErr || !qt) {
    return { status: 404, body: { success: false, error: 'Ticket not found' } };
  }
  if (String(qt.event_id || '') !== ev) {
    return { status: 403, body: { success: false, error: 'Ticket does not belong to this event' } };
  }

  const extras = await buildInspectExtras(db, qt);
  return {
    status: 200,
    body: {
      success: true,
      result: 'ok',
      ...extras,
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
  /** Exact order number (numeric, min 3 digits) for this event */
  if (/^\d{3,}$/.test(q)) {
    const num = Number(q);
    if (Number.isSafeInteger(num)) {
      const { data: orders } = await db.from('orders').select('id').eq('event_id', event_id).eq('order_number', num);
      const oids = (orders || []).map((o) => o.id).filter(Boolean);
      if (!oids.length) return [];
      const { data: qtRows } = await db.from('qr_tickets').select('id').eq('event_id', event_id).in('order_id', oids);
      return (qtRows || []).map((r) => r.id).slice(0, 200);
    }
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

  const { count: totalQrCount } = await db
    .from('qr_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', event_id);
  const total_qr_tickets = totalQrCount || 0;

  let checked_in_distinct = 0;
  const { data: validRows, error: validScanErr } = await db
    .from('scans')
    .select('qr_ticket_id')
    .eq('event_id', event_id)
    .eq('scan_result', 'valid')
    .not('qr_ticket_id', 'is', null);
  if (!validScanErr && validRows) {
    const usedSet = new Set((validRows || []).map((r) => r.qr_ticket_id).filter(Boolean));
    const usedIds = [...usedSet];
    if (usedIds.length) {
      const { data: inEvent } = await db
        .from('qr_tickets')
        .select('id')
        .eq('event_id', event_id)
        .in('id', usedIds);
      checked_in_distinct = (inEvent || []).length;
    }
  }

  let remaining_valid_passes = Math.max(0, total_qr_tickets - checked_in_distinct);
  if (validScanErr && /qr_ticket_id|does not exist/i.test(validScanErr.message || '')) {
    const { count: legacyRemaining } = await db
      .from('qr_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event_id)
      .eq('ticket_status', 'VALID');
    remaining_valid_passes = legacyRemaining || 0;
    checked_in_distinct = Math.max(0, total_qr_tickets - remaining_valid_passes);
  }

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
      total_qr_tickets,
      checked_in_distinct,
    },
  };
}

module.exports = {
  supervisorLookupTicket,
  supervisorInspectDetail,
  supervisorEventScans,
  supervisorEventStatistics,
  ticketPublicFromRow,
};
