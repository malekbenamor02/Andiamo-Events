/**
 * Scan system API — standalone Vercel serverless (no server.cjs).
 * Handles: scan-system-status, scanner-login, scanner-logout, admin/scan-system-config,
 * admin/scanners, admin/scanners/:id, admin/scanners/:id/scans, admin/scanners/:id/statistics,
 * admin/scan-history, admin/scan-statistics, scanner/validate-ticket, scanner/events,
 * scanner/scans, scanner/statistics.
 */

import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

function getDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let b = '';
  try {
    for await (const c of req) b += c.toString();
  } catch (_) {}
  try {
    return JSON.parse(b || '{}');
  } catch {
    return {};
  }
}

function getCookie(req, name) {
  const s = req.headers?.cookie || '';
  const m = s.match(new RegExp(name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1].trim()) : null;
}

function setCORS(res, req) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function requireAdminAuth(req) {
  const token = getCookie(req, 'adminToken');
  if (!token) return { err: { statusCode: 401, body: { error: 'Not authenticated', reason: 'No token provided', valid: false } } };
  const secret = process.env.JWT_SECRET || 'fallback-secret-dev-only';
  if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') return { err: { statusCode: 500, body: { error: 'Server configuration error', valid: false } } };
  try {
    const d = jwt.verify(token, secret);
    if (!d?.id || !d?.email || !d?.role) return { err: { statusCode: 401, body: { error: 'Invalid token', reason: 'Token payload is invalid', valid: false } } };
    return { admin: d };
  } catch (e) {
    return { err: { statusCode: 401, body: { error: 'Invalid or expired token', reason: e.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token', valid: false } } };
  }
}

async function requireScannerAuth(req) {
  const token = getCookie(req, 'scannerToken');
  if (!token) return { err: { statusCode: 401, body: { error: 'Not authenticated', reason: 'No token' } } };
  const secret = process.env.JWT_SECRET || 'fallback-secret-dev-only';
  try {
    const d = jwt.verify(token, secret);
    if (d?.type !== 'scanner' || !d?.scannerId) return { err: { statusCode: 401, body: { error: 'Invalid scanner token' } } };
    return { scanner: { scannerId: d.scannerId, email: d.email } };
  } catch {
    return { err: { statusCode: 401, body: { error: 'Invalid or expired scanner token' } } };
  }
}

export default async function handler(req, res) {
  let path = (req.url || req.path || '/').split('?')[0];
  if (!path.startsWith('/api/')) path = '/api' + (path.startsWith('/') ? path : '/' + path);
  const method = req.method || 'GET';

  setCORS(res, req);
  if (method === 'OPTIONS') return res.status(200).end();

  const db = getDb();

  try {
    // ——— GET /api/scan-system-status (public)
    if (path === '/api/scan-system-status' && method === 'GET') {
      if (!db) return res.status(200).json({ enabled: false });
      const { data: row, error } = await db.from('scan_system_config').select('scan_enabled').limit(1).single();
      return res.status(200).json({ enabled: !!(row && row.scan_enabled) });
    }

    // ——— POST /api/scanner-login
    if (path === '/api/scanner-login' && method === 'POST') {
      const body = await parseBody(req);
      if (!db) return res.status(500).json({ error: 'Service unavailable' });
      const em = (typeof body.email === 'string' ? body.email.trim().toLowerCase() : '') || '';
      const pw = typeof body.password === 'string' ? body.password : '';
      if (!em || !pw) return res.status(400).json({ error: 'Email and password required' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return res.status(400).json({ error: 'Invalid email' });
      if (pw.length < 6) return res.status(401).json({ error: 'Invalid credentials' });
      const { data: sc, error: e } = await db.from('scanners').select('id, email, name, password_hash, is_active').eq('email', em).single();
      if (e || !sc || !sc.is_active) return res.status(401).json({ error: 'Invalid credentials' });
      const ok = await bcrypt.compare(pw, sc.password_hash || '');
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
      const secret = process.env.JWT_SECRET || 'fallback-secret-dev-only';
      const token = jwt.sign({ scannerId: sc.id, email: sc.email, type: 'scanner' }, secret, { expiresIn: '8h' });
      const isProd = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
      res.setHeader('Set-Cookie', `scannerToken=${token}; HttpOnly; Path=/; Max-Age=28800; SameSite=Lax${isProd ? '; Secure' : ''}`);
      return res.status(200).json({ success: true, scanner: { id: sc.id, email: sc.email, name: sc.name } });
    }

    // ——— POST /api/scanner-logout
    if (path === '/api/scanner-logout' && method === 'POST') {
      res.setHeader('Set-Cookie', 'scannerToken=; HttpOnly; Path=/; Max-Age=0');
      return res.status(200).json({ success: true });
    }

    // ——— GET /api/admin/scan-system-config (super_admin)
    if (path === '/api/admin/scan-system-config' && method === 'GET') {
      const auth = await requireAdminAuth(req);
      if (auth.err) return res.status(auth.err.statusCode).json(auth.err.body);
      if (auth.admin.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
      if (!db) return res.status(500).json({ error: 'Supabase not configured' });
      const { data: r, error } = await db.from('scan_system_config').select('scan_enabled, updated_at, updated_by').limit(1).single();
      if (error || !r) return res.status(200).json({ enabled: false, updated_at: null, updated_by: null, updated_by_name: null });
      let name = null;
      if (r.updated_by) {
        const { data: a } = await db.from('admins').select('name').eq('id', r.updated_by).single();
        if (a) name = a.name;
      }
      return res.status(200).json({ enabled: !!r.scan_enabled, updated_at: r.updated_at, updated_by: r.updated_by, updated_by_name: name });
    }

    // ——— PATCH /api/admin/scan-system-config (super_admin)
    if (path === '/api/admin/scan-system-config' && method === 'PATCH') {
      const auth = await requireAdminAuth(req);
      if (auth.err) return res.status(auth.err.statusCode).json(auth.err.body);
      if (auth.admin.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
      if (!db) return res.status(500).json({ error: 'Supabase not configured' });
      const body = await parseBody(req);
      const v = body && body.scan_enabled;
      const scan_enabled = v === true || v === 'true';
      const { data: cfg } = await db.from('scan_system_config').select('id').limit(1).single();
      if (!cfg) return res.status(500).json({ error: 'Config not found' });
      const { error } = await db.from('scan_system_config').update({ scan_enabled, updated_by: auth.admin.id, updated_at: new Date().toISOString() }).eq('id', cfg.id);
      if (error) return res.status(500).json({ error: 'Update failed' });
      return res.status(200).json({ success: true, enabled: scan_enabled });
    }

    // ——— GET /api/admin/scanners (super_admin)
    if (path === '/api/admin/scanners' && method === 'GET') {
      const auth = await requireAdminAuth(req);
      if (auth.err) return res.status(auth.err.statusCode).json(auth.err.body);
      if (auth.admin.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
      if (!db) return res.status(500).json({ error: 'Supabase not configured' });
      const { data: rows, error } = await db.from('scanners').select('id, name, email, is_active, created_by, created_at').order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      const adminIds = [...new Set((rows || []).map((r) => r.created_by).filter(Boolean))];
      let names = {};
      if (adminIds.length) {
        const { data: adm } = await db.from('admins').select('id, name').in('id', adminIds);
        (adm || []).forEach((a) => { names[a.id] = a.name; });
      }
      const list = (rows || []).map((r) => ({ ...r, created_by_name: names[r.created_by] || null }));
      return res.status(200).json({ scanners: list });
    }

    // ——— POST /api/admin/scanners (super_admin)
    if (path === '/api/admin/scanners' && method === 'POST') {
      const auth = await requireAdminAuth(req);
      if (auth.err) return res.status(auth.err.statusCode).json(auth.err.body);
      if (auth.admin.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
      if (!db) return res.status(500).json({ error: 'Supabase not configured' });
      const body = await parseBody(req);
      const n = (typeof body.name === 'string' ? body.name.trim() : '') || '';
      const em = (typeof body.email === 'string' ? body.email.trim().toLowerCase() : '') || '';
      const pw = typeof body.password === 'string' ? body.password : '';
      if (!n || !em || !pw) return res.status(400).json({ error: 'Name, email and password required' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return res.status(400).json({ error: 'Invalid email' });
      if (pw.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
      const { data: ex } = await db.from('scanners').select('id').eq('email', em).single();
      if (ex) return res.status(400).json({ error: 'Email already used' });
      const hash = await bcrypt.hash(pw, 10);
      const { data: ins, error } = await db.from('scanners').insert({ name: n, email: em, password_hash: hash, created_by: auth.admin.id }).select('id, name, email, is_active, created_at').single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(ins);
    }

    // ——— PATCH /api/admin/scanners/:id
    const patchScannersId = path.match(/^\/api\/admin\/scanners\/([^/]+)$/);
    if (patchScannersId && method === 'PATCH') {
      const auth = await requireAdminAuth(req);
      if (auth.err) return res.status(auth.err.statusCode).json(auth.err.body);
      if (auth.admin.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
      if (!db) return res.status(500).json({ error: 'Supabase not configured' });
      const id = patchScannersId[1];
      if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Invalid id' });
      const body = await parseBody(req);
      const { name, email, is_active, password } = body || {};
      const up = {};
      if (typeof name === 'string' && name.trim()) up.name = name.trim();
      if (typeof email === 'string' && email.trim()) {
        const e = email.trim().toLowerCase();
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) up.email = e;
      }
      if (typeof is_active === 'boolean') up.is_active = is_active;
      if (typeof password === 'string' && password.length >= 8) up.password_hash = await bcrypt.hash(password, 10);
      if (Object.keys(up).length === 0) return res.status(400).json({ error: 'No valid fields to update' });
      up.updated_at = new Date().toISOString();
      if (up.email) {
        const { data: ex } = await db.from('scanners').select('id').eq('email', up.email).neq('id', id).single();
        if (ex) return res.status(400).json({ error: 'Email already used' });
      }
      const { data: u, error } = await db.from('scanners').update(up).eq('id', id).select('id, name, email, is_active, updated_at').single();
      if (error) return res.status(500).json({ error: error.message });
      if (!u) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(u);
    }

    // ——— DELETE /api/admin/scanners/:id
    if (patchScannersId && method === 'DELETE') {
      const auth = await requireAdminAuth(req);
      if (auth.err) return res.status(auth.err.statusCode).json(auth.err.body);
      if (auth.admin.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
      if (!db) return res.status(500).json({ error: 'Supabase not configured' });
      const id = patchScannersId[1];
      if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Invalid id' });
      const { error } = await db.from('scanners').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }

    // ——— GET /api/admin/scanners/:id/scans
    const scannersIdScans = path.match(/^\/api\/admin\/scanners\/([^/]+)\/scans$/);
    if (scannersIdScans && method === 'GET') {
      const auth = await requireAdminAuth(req);
      if (auth.err) return res.status(auth.err.statusCode).json(auth.err.body);
      if (auth.admin.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
      if (!db) return res.status(500).json({ error: 'Supabase not configured' });
      const id = scannersIdScans[1];
      if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Invalid id' });
      const q = (req.url || '').includes('?') ? new URLSearchParams((req.url || '').split('?')[1]) : null;
      const event_id = (q && q.get('event_id')) || null;
      const date_from = (q && q.get('date_from')) || null;
      const date_to = (q && q.get('date_to')) || null;
      const scan_result = (q && q.get('scan_result')) || null;
      let query = db.from('scans').select('id, scan_time, scan_result, scan_location, event_id, qr_ticket_id, scanner_id', { count: 'exact' }).eq('scanner_id', id).order('scan_time', { ascending: false }).range(0, 199);
      if (event_id && /^[0-9a-f-]{36}$/i.test(event_id)) query = query.eq('event_id', event_id);
      if (date_from) query = query.gte('scan_time', date_from);
      if (date_to) query = query.lte('scan_time', date_to);
      if (['valid','invalid','already_scanned','wrong_event'].includes(scan_result)) query = query.eq('scan_result', scan_result);
      const { data: rows, error, count } = await query;
      if (error) return res.status(500).json({ error: error.message });
      const qids = (rows || []).map((r) => r.qr_ticket_id).filter(Boolean);
      let extra = {};
      if (qids.length) {
        const { data: qr } = await db.from('qr_tickets').select('id, buyer_name, pass_type, ambassador_name, event_name').in('id', qids);
        (qr || []).forEach((x) => { extra[x.id] = x; });
      }
      const list = (rows || []).map((r) => ({
        ...r,
        buyer_name: (r.qr_ticket_id && extra[r.qr_ticket_id]) ? extra[r.qr_ticket_id].buyer_name : null,
        pass_type: (r.qr_ticket_id && extra[r.qr_ticket_id]) ? extra[r.qr_ticket_id].pass_type : null,
        ambassador_name: (r.qr_ticket_id && extra[r.qr_ticket_id]) ? extra[r.qr_ticket_id].ambassador_name : null,
        event_name: (r.qr_ticket_id && extra[r.qr_ticket_id]) ? extra[r.qr_ticket_id].event_name : null
      }));
      return res.status(200).json({ scans: list, total: count != null ? count : list.length });
    }

    // ——— GET /api/admin/scanners/:id/statistics
    const scannersIdStats = path.match(/^\/api\/admin\/scanners\/([^/]+)\/statistics$/);
    if (scannersIdStats && method === 'GET') {
      const auth = await requireAdminAuth(req);
      if (auth.err) return res.status(auth.err.statusCode).json(auth.err.body);
      if (auth.admin.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
      if (!db) return res.status(500).json({ error: 'Supabase not configured' });
      const id = scannersIdStats[1];
      if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Invalid id' });
      const q = (req.url || '').includes('?') ? new URLSearchParams((req.url || '').split('?')[1]) : null;
      const event_id = (q && q.get('event_id')) || null;
      let query = db.from('scans').select('scan_result, qr_ticket_id').eq('scanner_id', id);
      if (event_id && /^[0-9a-f-]{36}$/i.test(event_id)) query = query.eq('event_id', event_id);
      const { data: rows, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      const total = (rows || []).length;
      const byStatus = { valid: 0, invalid: 0, already_scanned: 0, wrong_event: 0 };
      (rows || []).forEach((r) => { if (byStatus[r.scan_result] != null) byStatus[r.scan_result]++; });
      const qids = (rows || []).map((r) => r.qr_ticket_id).filter(Boolean);
      let byPass = {};
      if (qids.length) {
        const { data: qr } = await db.from('qr_tickets').select('id, pass_type').in('id', qids);
        (qr || []).forEach((x) => { byPass[x.pass_type] = (byPass[x.pass_type] || 0) + 1; });
      }
      return res.status(200).json({ total, byStatus, byPass });
    }

    // ——— GET /api/admin/scan-history (super_admin) + fallback when qr_ticket_id/scanner_id missing
    if (path === '/api/admin/scan-history' && method === 'GET') {
      const auth = await requireAdminAuth(req);
      if (auth.err) return res.status(auth.err.statusCode).json(auth.err.body);
      if (auth.admin.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
      if (!db) return res.status(500).json({ error: 'Supabase not configured' });
      const q = (req.url || '').includes('?') ? new URLSearchParams((req.url || '').split('?')[1]) : null;
      const scanner_id = (q && q.get('scanner_id')) || null;
      const event_id = (q && q.get('event_id')) || null;
      const date_from = (q && q.get('date_from')) || null;
      const date_to = (q && q.get('date_to')) || null;
      const scan_result = (q && q.get('scan_result')) || null;

      const buildQuery = (cols) => {
        let qu = db.from('scans').select(cols, { count: 'exact' }).order('scan_time', { ascending: false }).range(0, 199);
        if (scanner_id && /^[0-9a-f-]{36}$/i.test(scanner_id) && cols.includes('scanner_id')) qu = qu.eq('scanner_id', scanner_id);
        if (event_id && /^[0-9a-f-]{36}$/i.test(event_id)) qu = qu.eq('event_id', event_id);
        if (date_from) qu = qu.gte('scan_time', date_from);
        if (date_to) qu = qu.lte('scan_time', date_to);
        if (['valid','invalid','already_scanned','wrong_event'].includes(scan_result)) qu = qu.eq('scan_result', scan_result);
        return qu;
      };

      let rows, count, err;
      let r1 = await buildQuery('id, scan_time, scan_result, scan_location, event_id, qr_ticket_id, scanner_id');
      rows = r1.data; count = r1.count; err = r1.error;
      if (err && /qr_ticket_id|scanner_id|does not exist/i.test(String(err.message || ''))) {
        const r2 = await buildQuery('id, scan_time, scan_result, scan_location, event_id');
        rows = r2.data; count = r2.count; err = r2.error;
      }
      if (err) return res.status(500).json({ error: err.message });

      const hasScannerCols = rows?.[0] && ('qr_ticket_id' in rows[0] || 'scanner_id' in rows[0]);
      const qids = hasScannerCols ? (rows || []).map((r) => r.qr_ticket_id).filter(Boolean) : [];
      const sids = hasScannerCols ? (rows || []).map((r) => r.scanner_id).filter(Boolean) : [];
      let qr = {}, sc = {};
      if (qids.length) { const { data: qrData } = await db.from('qr_tickets').select('id, buyer_name, pass_type, ambassador_name, event_name').in('id', qids); (qrData || []).forEach((x) => { qr[x.id] = x; }); }
      if (sids.length) { const { data: scData } = await db.from('scanners').select('id, name').in('id', sids); (scData || []).forEach((x) => { sc[x.id] = x; }); }
      const list = (rows || []).map((r) => ({
        ...r,
        buyer_name: (r.qr_ticket_id && qr[r.qr_ticket_id]) ? qr[r.qr_ticket_id].buyer_name : null,
        pass_type: (r.qr_ticket_id && qr[r.qr_ticket_id]) ? qr[r.qr_ticket_id].pass_type : null,
        ambassador_name: (r.qr_ticket_id && qr[r.qr_ticket_id]) ? qr[r.qr_ticket_id].ambassador_name : null,
        event_name: (r.qr_ticket_id && qr[r.qr_ticket_id]) ? qr[r.qr_ticket_id].event_name : null,
        scanner_name: (r.scanner_id && sc[r.scanner_id]) ? sc[r.scanner_id].name : null
      }));
      return res.status(200).json({ scans: list, total: count != null ? count : list.length });
    }

    // ——— GET /api/admin/scan-statistics (super_admin) + fallback
    if (path === '/api/admin/scan-statistics' && method === 'GET') {
      const auth = await requireAdminAuth(req);
      if (auth.err) return res.status(auth.err.statusCode).json(auth.err.body);
      if (auth.admin.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' });
      if (!db) return res.status(500).json({ error: 'Supabase not configured' });
      const q = (req.url || '').includes('?') ? new URLSearchParams((req.url || '').split('?')[1]) : null;
      const scanner_id = (q && q.get('scanner_id')) || null;
      const event_id = (q && q.get('event_id')) || null;
      const date_from = (q && q.get('date_from')) || null;
      const date_to = (q && q.get('date_to')) || null;

      const buildQuery = (cols) => {
        let qu = db.from('scans').select(cols);
        if (scanner_id && /^[0-9a-f-]{36}$/i.test(scanner_id) && cols.includes('scanner_id')) qu = qu.eq('scanner_id', scanner_id);
        if (event_id && /^[0-9a-f-]{36}$/i.test(event_id)) qu = qu.eq('event_id', event_id);
        if (date_from) qu = qu.gte('scan_time', date_from);
        if (date_to) qu = qu.lte('scan_time', date_to);
        return qu;
      };

      let rows, err;
      let r1 = await buildQuery('scan_result, qr_ticket_id, scanner_id');
      rows = r1.data; err = r1.error;
      if (err && /qr_ticket_id|scanner_id|does not exist/i.test(String(err.message || ''))) {
        const r2 = await buildQuery('scan_result');
        rows = r2.data; err = r2.error;
      }
      if (err) return res.status(500).json({ error: err.message });

      const total = (rows || []).length;
      const byStatus = { valid: 0, invalid: 0, already_scanned: 0, wrong_event: 0 };
      const byScanner = {};
      (rows || []).forEach((r) => {
        if (byStatus[r.scan_result] != null) byStatus[r.scan_result]++;
        if (r.scanner_id) byScanner[r.scanner_id] = (byScanner[r.scanner_id] || 0) + 1;
      });
      const hasQrCol = rows?.[0] && ('qr_ticket_id' in rows[0]);
      const qids = hasQrCol ? (rows || []).map((r) => r.qr_ticket_id).filter(Boolean) : [];
      let byPass = {};
      if (qids.length) { const { data: qr } = await db.from('qr_tickets').select('id, pass_type').in('id', qids); (qr || []).forEach((x) => { byPass[x.pass_type] = (byPass[x.pass_type] || 0) + 1; }); }
      return res.status(200).json({ total, byStatus, byPass, byScanner });
    }

    // ——— POST /api/scanner/validate-ticket (requireScannerAuth)
    if (path === '/api/scanner/validate-ticket' && method === 'POST') {
      const auth = await requireScannerAuth(req);
      if (auth.err) return res.status(auth.err.statusCode).json(auth.err.body);
      if (!db) return res.status(500).json({ success: false, result: 'error', message: 'Service unavailable' });
      const { data: cfg } = await db.from('scan_system_config').select('scan_enabled').limit(1).single();
      if (!cfg || !cfg.scan_enabled) return res.status(503).json({ success: false, enabled: false, message: 'Scan system is not started', result: 'disabled' });
      const body = await parseBody(req);
      const st = (typeof body.secure_token === 'string' ? body.secure_token.trim() : '') || '';
      const ev = (typeof body.event_id === 'string' ? body.event_id.trim() : '') || '';
      const sl = typeof body.scan_location === 'string' ? body.scan_location.trim().slice(0, 500) : null;
      const di = typeof body.device_info === 'string' ? body.device_info.trim().slice(0, 500) : null;
      if (!st) return res.status(400).json({ success: false, result: 'invalid', message: 'secure_token required' });
      if (!ev || !/^[0-9a-f-]{36}$/i.test(ev)) return res.status(400).json({ success: false, result: 'invalid', message: 'event_id required and must be UUID' });
      const scannerId = auth.scanner.scannerId;
      const { data: qt, error: qtErr } = await db.from('qr_tickets').select('*').eq('secure_token', st).single();
      if (qtErr || !qt) {
        await db.from('scans').insert({ event_id: ev, scanner_id: scannerId, scan_result: 'invalid', scan_location: sl, device_info: di, notes: 'Token not found' });
        return res.status(200).json({ success: false, result: 'invalid', message: 'Ticket not found' });
      }
      const now = new Date();
      const evId = qt.event_id ? String(qt.event_id) : null;
      if (evId && evId !== ev) {
        await db.from('scans').insert({ event_id: ev, scanner_id: scannerId, qr_ticket_id: qt.id, scan_result: 'wrong_event', scan_location: sl, device_info: di, ambassador_id: qt.ambassador_id, notes: 'Wrong event' });
        return res.status(200).json({ success: false, result: 'wrong_event', message: 'This ticket is for a different event', correct_event: { event_id: evId, event_name: qt.event_name || null, event_date: qt.event_date || null } });
      }
      const { data: existing } = await db.from('scans').select('id, scan_time, scanner_id').eq('qr_ticket_id', qt.id).eq('scan_result', 'valid').limit(1).single();
      if (existing) {
        let prevName = 'Unknown';
        if (existing.scanner_id) { const { data: sn } = await db.from('scanners').select('name').eq('id', existing.scanner_id).single(); if (sn) prevName = sn.name; }
        await db.from('scans').insert({ event_id: ev, scanner_id: scannerId, qr_ticket_id: qt.id, scan_result: 'already_scanned', scan_location: sl, device_info: di, ambassador_id: qt.ambassador_id, notes: 'Duplicate' });
        const isInvDup = qt.source === 'official_invitation';
        let invDup = null;
        if (isInvDup && qt.invitation_id) { const { data: id } = await db.from('official_invitations').select('invitation_number, recipient_name, recipient_phone, recipient_email').eq('id', qt.invitation_id).single(); invDup = id; }
        const ticketDup = isInvDup ? { is_invitation: true, pass_type: qt.pass_type || null, invitation_number: invDup?.invitation_number || null, recipient_name: invDup?.recipient_name || qt.buyer_name || null, recipient_phone: invDup?.recipient_phone || qt.buyer_phone || null, recipient_email: invDup?.recipient_email || qt.buyer_email || null } : undefined;
        return res.status(200).json({ success: false, result: 'already_scanned', message: 'Ticket already scanned', previous_scan: { scanned_at: existing.scan_time, scanner_name: prevName }, ...(ticketDup && { ticket: ticketDup }) });
      }
      await db.from('qr_tickets').update({ ticket_status: 'USED', updated_at: now.toISOString() }).eq('id', qt.id);
      const { data: scanRow } = await db.from('scans').insert({ event_id: ev, scanner_id: scannerId, qr_ticket_id: qt.id, scan_result: 'valid', scan_location: sl, device_info: di, ambassador_id: qt.ambassador_id, notes: 'Valid' }).select('scan_time').single();
      const isInv = qt.source === 'official_invitation';
      let invData = null;
      if (isInv && qt.invitation_id) { const { data: inv } = await db.from('official_invitations').select('invitation_number, recipient_name, recipient_phone, recipient_email').eq('id', qt.invitation_id).single(); invData = inv; }
      const ticket = { pass_type: qt.pass_type || null, buyer_name: qt.buyer_name || null, ambassador_name: isInv ? null : (qt.ambassador_name || null), event_name: qt.event_name || null, event_date: qt.event_date || null, event_venue: qt.event_venue || null, is_invitation: isInv, source: qt.source || null, scanned_at: (scanRow && scanRow.scan_time) || now.toISOString(), ...(isInv && { invitation_number: invData?.invitation_number || null, recipient_name: invData?.recipient_name || qt.buyer_name || null, recipient_phone: invData?.recipient_phone || qt.buyer_phone || null, recipient_email: invData?.recipient_email || qt.buyer_email || null }) };
      return res.status(200).json({ success: true, result: 'valid', message: 'Ticket validated', ticket });
    }

    // ——— GET /api/scanner/events
    if (path === '/api/scanner/events' && method === 'GET') {
      const auth = await requireScannerAuth(req);
      if (auth.err) return res.status(auth.err.statusCode).json(auth.err.body);
      if (!db) return res.status(500).json({ error: 'Supabase not configured' });
      const { data: cfg } = await db.from('scan_system_config').select('scan_enabled').limit(1).single();
      if (!cfg || !cfg.scan_enabled) return res.status(503).json({ error: 'Scan system is not started', enabled: false });
      const now = new Date().toISOString();
      const { data: rows, error } = await db.from('events').select('id, name, date, venue, city').eq('event_type', 'upcoming').gte('date', now).order('date', { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ events: rows || [] });
    }

    // ——— GET /api/scanner/scans
    if (path === '/api/scanner/scans' && method === 'GET') {
      const auth = await requireScannerAuth(req);
      if (auth.err) return res.status(auth.err.statusCode).json(auth.err.body);
      if (!db) return res.status(500).json({ error: 'Supabase not configured' });
      const q = (req.url || '').includes('?') ? new URLSearchParams((req.url || '').split('?')[1] || '') : new URLSearchParams('');
      const event_id = (q.get('event_id') || '').trim() || null;
      const date_from = q.get('date_from') || null;
      const date_to = q.get('date_to') || null;
      const scan_result = (q.get('scan_result') || '').trim() || null;
      let query = db.from('scans').select('id, scan_time, scan_result, scan_location, event_id, qr_ticket_id', { count: 'exact' }).eq('scanner_id', auth.scanner.scannerId).order('scan_time', { ascending: false }).range(0, 99);
      if (event_id && /^[0-9a-f-]{36}$/i.test(event_id)) query = query.eq('event_id', event_id);
      if (date_from) query = query.gte('scan_time', date_from);
      if (date_to) query = query.lte('scan_time', date_to);
      if (['valid','invalid','already_scanned','wrong_event'].includes(scan_result)) query = query.eq('scan_result', scan_result);
      const { data: rows, error, count } = await query;
      if (error) return res.status(500).json({ error: error.message });
      const ids = (rows || []).map((r) => r.qr_ticket_id).filter(Boolean);
      let extra = {};
      if (ids.length) { const { data: qr } = await db.from('qr_tickets').select('id, buyer_name, pass_type, ambassador_name, event_name').in('id', ids); (qr || []).forEach((x) => { extra[x.id] = x; }); }
      const list = (rows || []).map((r) => ({ ...r, buyer_name: (r.qr_ticket_id && extra[r.qr_ticket_id]) ? extra[r.qr_ticket_id].buyer_name : null, pass_type: (r.qr_ticket_id && extra[r.qr_ticket_id]) ? extra[r.qr_ticket_id].pass_type : null, ambassador_name: (r.qr_ticket_id && extra[r.qr_ticket_id]) ? extra[r.qr_ticket_id].ambassador_name : null, event_name: (r.qr_ticket_id && extra[r.qr_ticket_id]) ? extra[r.qr_ticket_id].event_name : null }));
      return res.status(200).json({ scans: list, total: count != null ? count : list.length });
    }

    // ——— GET /api/scanner/statistics
    if (path === '/api/scanner/statistics' && method === 'GET') {
      const auth = await requireScannerAuth(req);
      if (auth.err) return res.status(auth.err.statusCode).json(auth.err.body);
      if (!db) return res.status(500).json({ error: 'Supabase not configured' });
      const q = (req.url || '').includes('?') ? new URLSearchParams((req.url || '').split('?')[1] || '') : new URLSearchParams('');
      const event_id = (q.get('event_id') || '').trim() || null;
      const date_from = q.get('date_from') || null;
      const date_to = q.get('date_to') || null;
      let query = db.from('scans').select('scan_result, qr_ticket_id').eq('scanner_id', auth.scanner.scannerId);
      if (event_id && /^[0-9a-f-]{36}$/i.test(event_id)) query = query.eq('event_id', event_id);
      if (date_from) query = query.gte('scan_time', date_from);
      if (date_to) query = query.lte('scan_time', date_to);
      const { data: rows, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      const total = (rows || []).length;
      const byStatus = { valid: 0, invalid: 0, already_scanned: 0, wrong_event: 0 };
      (rows || []).forEach((r) => { if (byStatus[r.scan_result] != null) byStatus[r.scan_result]++; });
      const qids = (rows || []).map((r) => r.qr_ticket_id).filter(Boolean);
      let byPass = {};
      if (qids.length) { const { data: qr } = await db.from('qr_tickets').select('id, pass_type').in('id', qids); (qr || []).forEach((x) => { byPass[x.pass_type] = (byPass[x.pass_type] || 0) + 1; }); }
      return res.status(200).json({ total, byStatus, byPass });
    }
  } catch (e) {
    console.error('[api/scan.js]', e);
    return res.status(500).json({ error: 'Server error' });
  }

  return res.status(404).json({ error: 'Not found', path, method });
}
