// Admin POS API: outlets, users, stock, orders, audit-log
// All routes require verifyAdminAuth. Audit to pos_audit_log.

async function verifyAdminAuth(req) {
  try {
    const cookies = req.headers.cookie || '';
    const m = cookies.match(/adminToken=([^;]+)/);
    const token = m ? m[1] : null;
    if (!token) return { valid: false, error: 'No authentication token', statusCode: 401 };

    const jwt = await import('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'fallback-secret-dev-only';
    let decoded;
    try { decoded = jwt.default.verify(token, secret); } catch (e) {
      return { valid: false, error: 'Invalid or expired token', statusCode: 401 };
    }
    if (!decoded.id || !decoded.email || !decoded.role) return { valid: false, error: 'Invalid token', statusCode: 401 };
    if (decoded.role !== 'admin' && decoded.role !== 'super_admin') return { valid: false, error: 'Invalid role', statusCode: 403 };

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data: admin, error } = await supabase.from('admins').select('id, email, name, role').eq('id', decoded.id).eq('email', decoded.email).eq('is_active', true).single();
    if (error || !admin) return { valid: false, error: 'Admin not found or inactive', statusCode: 401 };
    return { valid: true, admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } };
  } catch (e) {
    return { valid: false, error: e.message, statusCode: 500 };
  }
}

async function getSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase not configured');
  return createClient(url, key);
}

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.json === 'function') {
    try { return await req.json(); } catch (_) {}
  }
  let b = '';
  try { for await (const c of req) b += c.toString(); } catch (_) {}
  return JSON.parse(b || '{}');
}

// Import shared CORS utility
const { setCORSHeaders: setCORSHeadersUtil, handlePreflight } = require('./utils/cors.js');

function setCORS(res, req) {
  // Handle preflight requests
  if (handlePreflight(req, res, { methods: 'GET, POST, PUT, PATCH, DELETE, OPTIONS', headers: 'Content-Type, Authorization' })) {
    return true; // Preflight handled
  }
  
  // Set CORS headers for actual requests
  if (!setCORSHeadersUtil(res, req, { methods: 'GET, POST, PUT, PATCH, DELETE, OPTIONS', headers: 'Content-Type, Authorization' })) {
    res.status(403).json({ error: 'CORS policy: Origin not allowed' });
    return false;
  }
  return true;
}

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.headers['x-real-ip'] || 'unknown';
}

function deriveSlug(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'outlet';
}

async function suggestSlugs(base, supabase) {
  const out = [];
  for (let i = 2; i <= 5; i++) {
    const s = `${base}-${i}`;
    const { data } = await supabase.from('pos_outlets').select('id').eq('slug', s).maybeSingle();
    if (!data) out.push(s);
  }
  return out;
}

async function posAuditLog(sb, opts) {
  const { action, performed_by_type, performed_by_id, performed_by_email, pos_outlet_id, target_type, target_id, details, req } = opts;
  await sb.from('pos_audit_log').insert({
    action,
    performed_by_type,
    performed_by_id,
    performed_by_email: performed_by_email || null,
    pos_outlet_id: pos_outlet_id || null,
    target_type,
    target_id,
    details: details || null,
    ip_address: req ? getClientIp(req) : null,
    user_agent: req?.headers?.['user-agent'] || null
  });
}

// --- Outlets ---
async function outletsList(sb, res) {
  const { data, error } = await sb.from('pos_outlets').select('id, name, slug, is_active, created_at, created_by').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const base = typeof process.env.VERCEL_URL === 'string' ? `https://${process.env.VERCEL_URL}` : (process.env.SITE_URL || '');
  const list = (data || []).map(o => ({ ...o, link: base ? `${base}/pos/${o.slug}` : `/pos/${o.slug}` }));
  return res.status(200).json(list);
}

async function outletsCreate(sb, body, auth, req, res) {
  const { name, slug: slugIn } = body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name required' });
  const slug = (slugIn && String(slugIn).trim()) ? deriveSlug(slugIn) : deriveSlug(name);
  const { data: ex } = await sb.from('pos_outlets').select('id').eq('slug', slug).maybeSingle();
  if (ex) return res.status(400).json({ error: 'Slug already exists', suggestedSlugs: await suggestSlugs(slug.replace(/-[0-9]+$/, ''), sb) });
  const { data: row, error } = await sb.from('pos_outlets').insert({ name: String(name).trim(), slug, is_active: true, created_by: auth.admin.id }).select('id, name, slug, is_active, created_at').single();
  if (error) return res.status(500).json({ error: error.message });
  await posAuditLog(sb, { action: 'create_pos_outlet', performed_by_type: 'admin', performed_by_id: auth.admin.id, performed_by_email: auth.admin.email, pos_outlet_id: row.id, target_type: 'pos_outlet', target_id: row.id, details: {}, req });
  return res.status(201).json(row);
}

async function outletsUpdate(sb, id, body, auth, req, res) {
  const { name, slug: slugIn, is_active } = body || {};
  const { data: old, error: e0 } = await sb.from('pos_outlets').select('id, name, slug, is_active').eq('id', id).single();
  if (e0 || !old) return res.status(404).json({ error: 'Outlet not found' });
  const up = {};
  if (name !== undefined) up.name = String(name).trim();
  if (slugIn !== undefined) {
    const s = deriveSlug(slugIn);
    const { data: ex } = await sb.from('pos_outlets').select('id').eq('slug', s).neq('id', id).maybeSingle();
    if (ex) return res.status(400).json({ error: 'Slug already in use' });
    up.slug = s;
  }
  if (is_active !== undefined) up.is_active = !!is_active;
  up.updated_at = new Date().toISOString();
  if (Object.keys(up).length <= 1) return res.status(200).json(old); // only updated_at
  const { data: row, error } = await sb.from('pos_outlets').update(up).eq('id', id).select('id, name, slug, is_active, updated_at').single();
  if (error) return res.status(500).json({ error: error.message });
  await posAuditLog(sb, { action: 'update_pos_outlet', performed_by_type: 'admin', performed_by_id: auth.admin.id, performed_by_email: auth.admin.email, pos_outlet_id: id, target_type: 'pos_outlet', target_id: id, details: { old: { name: old.name, slug: old.slug, is_active: old.is_active }, new: up }, req });
  return res.status(200).json(row);
}

async function outletsDelete(sb, id, auth, req, res) {
  const { data: o, error: e0 } = await sb.from('pos_outlets').select('id').eq('id', id).single();
  if (e0 || !o) return res.status(404).json({ error: 'Outlet not found' });
  const { error } = await sb.from('pos_outlets').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  await posAuditLog(sb, { action: 'delete_pos_outlet', performed_by_type: 'admin', performed_by_id: auth.admin.id, performed_by_email: auth.admin.email, pos_outlet_id: id, target_type: 'pos_outlet', target_id: id, details: {}, req });
  return res.status(200).json({ success: true });
}

// --- Users ---
async function usersList(sb, q, res) {
  let query = sb.from('pos_users').select('id, name, email, is_active, is_paused, pos_outlet_id, created_at, created_by').order('created_at', { ascending: false });
  const oid = q.pos_outlet_id;
  if (oid) query = query.eq('pos_outlet_id', oid);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data || []);
}

async function usersCreate(sb, body, auth, req, res) {
  const { pos_outlet_id, name, email, password } = body || {};
  if (!pos_outlet_id || !name || !email || !password) return res.status(400).json({ error: 'pos_outlet_id, name, email, password required' });
  const bcrypt = (await import('bcryptjs')).default;
  const hash = bcrypt.hashSync(String(password), 10);
  const { data: row, error } = await sb.from('pos_users').insert({ pos_outlet_id, name: String(name).trim(), email: String(email).trim().toLowerCase(), password_hash: hash, is_active: true, is_paused: false, created_by: auth.admin.id }).select('id, name, email, is_active, is_paused, pos_outlet_id, created_at').single();
  if (error) {
    if (error.code === '23505') return res.status(400).json({ error: 'Email already exists for this outlet' });
    return res.status(500).json({ error: error.message });
  }
  await posAuditLog(sb, { action: 'create_pos_user', performed_by_type: 'admin', performed_by_id: auth.admin.id, performed_by_email: auth.admin.email, pos_outlet_id, target_type: 'pos_user', target_id: row.id, details: {}, req });
  return res.status(201).json(row);
}

async function usersUpdate(sb, id, body, auth, req, res) {
  const { name, email, password, is_active, is_paused } = body || {};
  const { data: old, error: e0 } = await sb.from('pos_users').select('id, name, email, is_active, is_paused, pos_outlet_id').eq('id', id).single();
  if (e0 || !old) return res.status(404).json({ error: 'User not found' });
  const up = { updated_at: new Date().toISOString() };
  if (name !== undefined) up.name = String(name).trim();
  if (email !== undefined) up.email = String(email).trim().toLowerCase();
  if (password !== undefined && String(password).length) {
    const bcrypt = (await import('bcryptjs')).default;
    up.password_hash = bcrypt.hashSync(String(password), 10);
  }
  if (is_active !== undefined) up.is_active = !!is_active;
  if (is_paused !== undefined) up.is_paused = !!is_paused;
  const { data: row, error } = await sb.from('pos_users').update(up).eq('id', id).select('id, name, email, is_active, is_paused, pos_outlet_id, updated_at').single();
  if (error) { if (error.code === '23505') return res.status(400).json({ error: 'Email already exists for this outlet' }); return res.status(500).json({ error: error.message }); }
  const details = { old: { name: old.name, email: old.email, is_active: old.is_active, is_paused: old.is_paused }, new: {} };
  if (name !== undefined) details.new.name = up.name;
  if (email !== undefined) details.new.email = up.email;
  if (is_active !== undefined) details.new.is_active = up.is_active;
  if (is_paused !== undefined) details.new.is_paused = up.is_paused;
  if (password !== undefined && String(password).length) details.new.password_changed = true;
  const act = (is_paused === true && !old.is_paused) ? 'pause_pos_user' : (is_paused === false && old.is_paused) ? 'unpause_pos_user' : 'update_pos_user';
  await posAuditLog(sb, { action: act, performed_by_type: 'admin', performed_by_id: auth.admin.id, performed_by_email: auth.admin.email, pos_outlet_id: old.pos_outlet_id, target_type: 'pos_user', target_id: id, details, req });
  return res.status(200).json(row);
}

async function usersDelete(sb, id, auth, req, res) {
  const { data: u, error: e0 } = await sb.from('pos_users').select('id, pos_outlet_id').eq('id', id).single();
  if (e0 || !u) return res.status(404).json({ error: 'User not found' });
  const { error } = await sb.from('pos_users').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  await posAuditLog(sb, { action: 'delete_pos_user', performed_by_type: 'admin', performed_by_id: auth.admin.id, performed_by_email: auth.admin.email, pos_outlet_id: u.pos_outlet_id, target_type: 'pos_user', target_id: id, details: {}, req });
  return res.status(200).json({ success: true });
}

// --- Stock ---
async function stockList(sb, q, res) {
  const pos_outlet_id = q.pos_outlet_id;
  const event_id = q.event_id;
  if (!pos_outlet_id) return res.status(400).json({ error: 'pos_outlet_id required' });
  let query = sb.from('pos_pass_stock').select('id, pos_outlet_id, event_id, pass_id, max_quantity, sold_quantity, is_active, updated_at, event_passes(id, name, price, description)').eq('pos_outlet_id', pos_outlet_id);
  if (event_id) query = query.eq('event_id', event_id);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  const list = (data || []).map(r => ({
    ...r,
    remaining: r.max_quantity == null ? null : Math.max(0, (r.max_quantity || 0) - (r.sold_quantity || 0))
  }));
  return res.status(200).json(list);
}

async function stockCreate(sb, body, auth, req, res) {
  const { pos_outlet_id, event_id, pass_id, max_quantity, sold_quantity } = body || {};
  if (!pos_outlet_id || !event_id || !pass_id) return res.status(400).json({ error: 'pos_outlet_id, event_id, pass_id required' });
  const mq = max_quantity == null ? null : parseInt(max_quantity, 10);
  const sq = Math.max(0, parseInt(sold_quantity, 10) || 0);
  if (mq != null && sq > mq) return res.status(400).json({ error: 'sold_quantity cannot exceed max_quantity' });
  const { data: existing } = await sb.from('pos_pass_stock').select('id').eq('pos_outlet_id', pos_outlet_id).eq('event_id', event_id).eq('pass_id', pass_id).maybeSingle();
  if (existing) return res.status(400).json({ error: 'This pass type already has stock for this outlet and event. Use Edit to update (max must be ≥ sold).' });
  const { data: row, error } = await sb.from('pos_pass_stock').insert({ pos_outlet_id, event_id, pass_id, max_quantity: mq, sold_quantity: sq, is_active: true, updated_at: new Date().toISOString() }).select('id, pos_outlet_id, event_id, pass_id, max_quantity, sold_quantity, is_active, updated_at').single();
  if (error) return res.status(500).json({ error: error.message });
  await posAuditLog(sb, { action: 'create_pos_stock', performed_by_type: 'admin', performed_by_id: auth.admin.id, performed_by_email: auth.admin.email, pos_outlet_id, target_type: 'pos_pass_stock', target_id: row.id, details: { event_id, pass_id, max_quantity: mq, sold_quantity: sq }, req });
  return res.status(201).json(row);
}

async function stockUpdate(sb, id, body, auth, req, res) {
  const { max_quantity, sold_quantity, is_active } = body || {};
  const { data: old, error: e0 } = await sb.from('pos_pass_stock').select('id, pos_outlet_id, max_quantity, sold_quantity, is_active').eq('id', id).single();
  if (e0 || !old) return res.status(404).json({ error: 'Stock row not found' });
  const up = { updated_at: new Date().toISOString() };
  if (max_quantity !== undefined) up.max_quantity = max_quantity == null ? null : parseInt(max_quantity, 10);
  if (sold_quantity !== undefined) up.sold_quantity = Math.max(0, parseInt(sold_quantity, 10) || 0);
  if (is_active !== undefined) up.is_active = (is_active === true || is_active === 'true' || is_active === 1);
  const mq = up.max_quantity !== undefined ? up.max_quantity : old.max_quantity;
  const sq = up.sold_quantity !== undefined ? up.sold_quantity : old.sold_quantity;
  if (mq != null && sq > mq) return res.status(400).json({ error: `max_quantity cannot be less than sold_quantity (${sq} sold). Remaining = max − sold.` });
  const { data: row, error } = await sb.from('pos_pass_stock').update(up).eq('id', id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  await posAuditLog(sb, { action: 'update_pos_stock', performed_by_type: 'admin', performed_by_id: auth.admin.id, performed_by_email: auth.admin.email, pos_outlet_id: old.pos_outlet_id, target_type: 'pos_pass_stock', target_id: id, details: { old: { max_quantity: old.max_quantity, sold_quantity: old.sold_quantity, is_active: old.is_active }, new: up }, req });
  return res.status(200).json(row);
}

// --- Statistics ---
async function posStatistics(sb, q, res) {
  let query = sb.from('orders').select(`
    id, order_number, total_price, status, pos_outlet_id, created_at,
    pos_outlets(id, name, slug),
    order_passes(pass_type, quantity, price)
  `).eq('source', 'point_de_vente');
  if (q.pos_outlet_id) query = query.eq('pos_outlet_id', q.pos_outlet_id);
  if (q.from) query = query.gte('created_at', q.from);
  if (q.to) query = query.lte('created_at', q.to);
  const { data: rows, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  const list = rows || [];
  const byOutlet = {};
  const daily = {};
  let totalOrders = 0;
  let totalRevenue = 0;
  let paidOrders = 0;
  let paidRevenue = 0;
  let paidTickets = 0;
  let pendingOrders = 0;
  let pendingRevenue = 0;
  let pendingTickets = 0;
  let rejectedOrders = 0;
  let rejectedTickets = 0;
  let removedOrders = 0;
  let removedTickets = 0;
  const byPassType = {};
  const statuses = {};
  for (const o of list) {
    const out = o.pos_outlets || {};
    const oid = o.pos_outlet_id || '_none';
    const price = parseFloat(o.total_price) || 0;
    const ticketCount = (o.order_passes || []).reduce((s, p) => s + (p.quantity || 0), 0);
    if (!byOutlet[oid]) byOutlet[oid] = { outlet_id: oid, outlet_name: out.name || '—', total_orders: 0, total_revenue: 0, by_status: {}, by_pass_type: {} };
    statuses[o.status] = (statuses[o.status] || 0) + 1;
    byOutlet[oid].by_status[o.status] = (byOutlet[oid].by_status[o.status] || 0) + 1;
    totalOrders += 1;
    if (o.status === 'PAID') {
      totalRevenue += price;
      paidOrders += 1; paidRevenue += price; paidTickets += ticketCount;
      byOutlet[oid].total_orders += 1;
      byOutlet[oid].total_revenue += price;
      const d = (o.created_at || '').slice(0, 10);
      if (d) { if (!daily[d]) daily[d] = { date: d, orders: 0, revenue: 0 }; daily[d].orders += 1; daily[d].revenue += price; }
      for (const p of o.order_passes || []) {
        const pt = p.pass_type || 'Standard';
        byPassType[pt] = (byPassType[pt] || 0) + (p.quantity || 0);
        byOutlet[oid].by_pass_type[pt] = (byOutlet[oid].by_pass_type[pt] || 0) + (p.quantity || 0);
      }
    } else if (o.status === 'PENDING_ADMIN_APPROVAL') { pendingOrders += 1; pendingRevenue += price; pendingTickets += ticketCount; }
    else if (o.status === 'REJECTED') { rejectedOrders += 1; rejectedTickets += ticketCount; }
    else if (o.status === 'REMOVED_BY_ADMIN') { removedOrders += 1; removedTickets += ticketCount; }
  }
  return res.status(200).json({
    byOutlet: Object.values(byOutlet),
    daily: Object.values(daily).sort((a, b) => a.date.localeCompare(b.date)),
    totalOrders,
    totalRevenue,
    paidOrders,
    paidRevenue,
    paidTickets,
    pendingOrders,
    pendingRevenue,
    pendingTickets,
    rejectedOrders,
    rejectedTickets,
    removedOrders,
    removedTickets,
    byPassType,
    byStatus: statuses
  });
}

// --- Audit ---
async function auditList(sb, q, res) {
  let query = sb.from('pos_audit_log').select('*').order('created_at', { ascending: false });
  if (q.action) query = query.eq('action', q.action);
  if (q.performed_by_id) query = query.eq('performed_by_id', q.performed_by_id);
  if (q.target_type) query = query.eq('target_type', q.target_type);
  if (q.target_id) query = query.eq('target_id', q.target_id);
  if (q.from) query = query.gte('created_at', q.from);
  if (q.to) query = query.lte('created_at', q.to);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 50));
  const offset = Math.max(0, parseInt(q.offset, 10) || 0);
  query = query.range(offset, offset + limit - 1);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data || []);
}

// --- Orders list ---
async function ordersList(sb, q, res) {
  let query = sb.from('orders').select(`
    id, order_number, user_name, user_phone, user_email, city, ville, quantity, total_price, status, payment_method, source, event_id, pos_outlet_id, pos_user_id, approved_by, rejected_by, removed_by, cancellation_reason, created_at,
    pos_outlets(id, name, slug),
    events(id, name, date, venue),
    order_passes(id, pass_id, pass_type, quantity, price),
    approver:admins!approved_by(email),
    rejector:admins!rejected_by(email),
    remover:admins!removed_by(email)
  `).eq('source', 'point_de_vente').order('created_at', { ascending: false });
  if (q.status) query = query.eq('status', q.status);
  if (q.event_id) query = query.eq('event_id', q.event_id);
  if (q.pos_outlet_id) query = query.eq('pos_outlet_id', q.pos_outlet_id);
  if (q.from) query = query.gte('created_at', q.from);
  if (q.to) {
    const toVal = /^\d{4}-\d{2}-\d{2}$/.test(String(q.to)) ? `${q.to}T23:59:59.999Z` : q.to;
    query = query.lte('created_at', toVal);
  }
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 50));
  const offset = Math.max(0, parseInt(q.offset, 10) || 0);
  query = query.range(offset, offset + limit - 1);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data || []);
}

// --- Orders: update client email ---
async function ordersUpdateEmail(sb, id, body, auth, req, res) {
  if (!body || !('user_email' in body)) return res.status(400).json({ error: 'user_email required (string or null)' });
  const { user_email } = body;
  const newEmail = user_email == null ? null : (typeof user_email === 'string' ? user_email.trim() || null : null);
  const { data: order, error: e0 } = await sb.from('orders').select('id, user_email, pos_outlet_id').eq('id', id).eq('source', 'point_de_vente').single();
  if (e0 || !order) return res.status(404).json({ error: 'Order not found' });
  const { error } = await sb.from('orders').update({ user_email: newEmail, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  await posAuditLog(sb, { action: 'update_pos_order_email', performed_by_type: 'admin', performed_by_id: auth.admin.id, performed_by_email: auth.admin.email, pos_outlet_id: order.pos_outlet_id, target_type: 'order', target_id: id, details: { field: 'user_email' }, req });
  return res.status(200).json({ success: true, user_email: newEmail });
}

// --- Orders: resend "order received" (pending) email ---
async function ordersResendOrderReceived(sb, id, auth, req, res) {
  const { data: order, error: e0 } = await sb.from('orders').select(`
    id, order_number, user_name, user_phone, user_email, city, ville, total_price, status, pos_outlet_id,
    pos_outlets(id, name),
    order_passes(pass_type, quantity, price)
  `).eq('id', id).eq('source', 'point_de_vente').single();
  if (e0 || !order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'PENDING_ADMIN_APPROVAL') return res.status(400).json({ error: 'Only pending orders can resend order-received email' });
  if (!order.user_email) return res.status(400).json({ error: 'No client email' });
  const outletName = order.pos_outlets?.name || 'Point de vente';
  const passes = (order.order_passes || []).map(p => ({ pass_type: p.pass_type, quantity: p.quantity, price: p.price }));
  if (passes.length === 0) return res.status(400).json({ error: 'No passes' });
  const on = (order.order_number != null) ? `#${order.order_number}` : order.id.slice(0, 8);
  const passesRows = passes.map(p => `<tr><td>${(p.pass_type || '').replace(/</g, '&lt;')}</td><td style="text-align:center">${p.quantity}</td><td style="text-align:right">${(p.price || 0).toFixed(2)} TND</td></tr>`).join('');
  const totalPrice = passes.reduce((s, p) => s + (p.price || 0) * (p.quantity || 0), 0);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light dark"><title>Payment Processing – Andiamo Events</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;line-height:1.6;color:#1A1A1A;background:#FFF}@media(prefers-color-scheme:dark){body{color:#FFF;background:#1A1A1A}}a{color:#E21836!important;text-decoration:none}.email-wrapper{max-width:600px;margin:0 auto}.content-card{background:#F5F5F5;margin:0 20px 30px;border-radius:12px;padding:50px 40px;border:1px solid rgba(0,0,0,0.1)}@media(prefers-color-scheme:dark){.content-card{background:#1F1F1F;border:1px solid rgba(42,42,42,0.5)}}.title-section{text-align:center;margin-bottom:40px;padding-bottom:30px;border-bottom:1px solid rgba(0,0,0,0.1)}.title{font-size:32px;font-weight:700;color:#1A1A1A;margin-bottom:12px}@media(prefers-color-scheme:dark){.title{color:#FFF}}.subtitle{font-size:16px;color:#666}.greeting{font-size:18px;color:#1A1A1A;margin-bottom:30px}.greeting strong{color:#E21836}.message{font-size:16px;color:#666;margin-bottom:25px}.order-info-block{background:#E8E8E8;border:1px solid rgba(0,0,0,0.15);border-radius:8px;padding:30px;margin:40px 0}@media(prefers-color-scheme:dark){.order-info-block{background:#252525}.order-info-block,.passes-table td{color:#FFF}}.info-row{margin-bottom:20px}.info-label{font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:10px;font-weight:600}.info-value{font-family:'Courier New',monospace;font-size:18px;color:#1A1A1A}.passes-table{width:100%;border-collapse:collapse;margin:20px 0}.passes-table th{text-align:left;padding:12px 0;color:#E21836;font-weight:600;font-size:14px;border-bottom:2px solid rgba(226,24,54,0.3)}.passes-table td{padding:12px 0;color:#1A1A1A;font-size:15px}.total-row{border-top:2px solid rgba(226,24,54,0.3)}.total-row td{font-weight:700;font-size:18px;color:#E21836;padding-top:15px}.support-section{background:#E8E8E8;border-left:3px solid rgba(226,24,54,0.3);padding:20px 25px;margin:35px 0;border-radius:4px}.support-text{font-size:14px;color:#666}.closing-section{text-align:center;margin:50px 0 40px;padding-top:40px;border-top:1px solid rgba(0,0,0,0.1)}.slogan{font-size:24px;font-style:italic;color:#E21836;font-weight:300;margin-bottom:30px}.signature{font-size:16px;color:#666}.footer{margin-top:50px;padding:40px 20px 30px;text-align:center;border-top:1px solid rgba(0,0,0,0.1)}.footer-text{font-size:12px;color:#999}</style></head><body><div class="email-wrapper"><div class="content-card"><div class="title-section"><h1 class="title">Payment Processing</h1><p class="subtitle">Payment Processing – Andiamo Events</p></div><p class="greeting">Dear <strong>${(order.user_name || 'Valued Customer').replace(/</g, '&lt;')}</strong>,</p><p class="message">Your order has been received via our Point de vente <strong>${(outletName || '').replace(/</g, '&lt;')}</strong>.<br><br>Your order is pending approval by our team. Once approved, you will receive a final confirmation email with your tickets (QR codes). Please check your spam folder.</p><div class="order-info-block"><div class="info-row"><div class="info-label">Order Number</div><div class="info-value">${on}</div></div><div class="info-row"><div class="info-label">Point de vente</div><div style="font-size:18px;color:#E21836;font-weight:600">${(outletName || '').replace(/</g, '&lt;')}</div></div></div><div class="order-info-block"><h3 style="color:#E21836;margin-bottom:20px;font-size:18px;font-weight:600">Passes Purchased</h3><table class="passes-table"><thead><tr><th>Pass Type</th><th style="text-align:center">Quantity</th><th style="text-align:right">Price</th></tr></thead><tbody>${passesRows}<tr class="total-row"><td colspan="2" style="text-align:right;padding-right:20px"><strong>Total Amount:</strong></td><td style="text-align:right"><strong>${totalPrice.toFixed(2)} TND</strong></td></tr></tbody></table></div><div class="support-section"><p class="support-text">Need assistance? Contact us at <a href="mailto:Contact@andiamoevents.com" style="color:#E21836!important">Contact@andiamoevents.com</a> or on Instagram <a href="https://www.instagram.com/andiamo.events/" target="_blank" style="color:#E21836!important">@andiamo.events</a> or call <a href="tel:28070128" style="color:#E21836!important">28070128</a>.</p></div><div class="closing-section"><p class="slogan">We Create Memories</p><p class="signature">Best regards,<br>The Andiamo Events Team</p></div></div><div class="footer"><p class="footer-text">Developed by <span style="color:#E21836">Malek Ben Amor</span></p></div></div></body></html>`;
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) return res.status(500).json({ error: 'Email not configured' });
  try {
    const nodemailer = (await import('nodemailer')).default;
    const tr = nodemailer.createTransport({ host: process.env.EMAIL_HOST, port: parseInt(process.env.EMAIL_PORT || '587'), secure: false, auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
    await tr.sendMail({ from: '"Andiamo Events" <contact@andiamoevents.com>', replyTo: '"Andiamo Events" <contact@andiamoevents.com>', to: order.user_email, subject: 'Order Received – Pending Approval – Andiamo Events', html });
    await posAuditLog(sb, { action: 'resend_pos_order_email', performed_by_type: 'admin', performed_by_id: auth.admin.id, performed_by_email: auth.admin.email, pos_outlet_id: order.pos_outlet_id, target_type: 'order', target_id: id, details: { type: 'order_received' }, req });
    return res.status(200).json({ success: true });
  } catch (er) { return res.status(500).json({ error: String(er && er.message) }); }
}

// --- Orders: resend tickets (completion) email ---
async function ordersResendTickets(sb, id, auth, req, res) {
  const { data: order, error: e0 } = await sb.from('orders').select(`
    id, order_number, user_name, user_phone, user_email, total_price, status, event_id, pos_outlet_id,
    events(id, name, date, venue)
  `).eq('id', id).eq('source', 'point_de_vente').single();
  if (e0 || !order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'PAID') return res.status(400).json({ error: 'Only approved (PAID) orders can resend tickets email' });
  if (!order.user_email) return res.status(400).json({ error: 'No client email' });
  const { data: orderPasses } = await sb.from('order_passes').select('id, pass_id, pass_type, quantity, price').eq('order_id', id);
  if (!orderPasses || orderPasses.length === 0) return res.status(400).json({ error: 'No passes' });
  const { data: tickets } = await sb.from('tickets').select('id, order_pass_id, secure_token, qr_code_url').eq('order_id', id);
  if (!tickets || tickets.length === 0) return res.status(400).json({ error: 'No tickets generated for this order' });
  const ticketsByPass = new Map();
  tickets.forEach(t => {
    const p = orderPasses.find(x => x.id === t.order_pass_id);
    if (p) { if (!ticketsByPass.has(p.pass_type)) ticketsByPass.set(p.pass_type, []); ticketsByPass.get(p.pass_type).push(t); }
  });
  const ticketsHtml = Array.from(ticketsByPass.entries()).map(([pt, arr]) => {
    const list = arr.map((t, i) => `<div style="margin:20px 0;padding:20px;background:#E8E8E8;border-radius:8px;text-align:center;border:1px solid rgba(0,0,0,0.1)"><h4 style="margin:0 0 15px 0;color:#E21836;font-size:16px;font-weight:600">${(pt || 'Pass').replace(/</g, '&lt;')} - Ticket ${i + 1}</h4><img src="${t.qr_code_url || ''}" alt="QR" style="max-width:250px;height:auto;border-radius:8px;border:2px solid rgba(226,24,54,0.3);display:block;margin:0 auto" /><p style="margin:10px 0 0 0;font-size:12px;color:#666;font-family:'Courier New',monospace">Token: ${(t.secure_token || '').substring(0, 8)}...</p></div>`).join('');
    return `<div style="margin:30px 0"><h3 style="color:#E21836;margin-bottom:15px;font-size:18px;font-weight:600">${(pt || 'Pass').replace(/</g, '&lt;')} Tickets (${arr.length})</h3>${list}</div>`;
  }).join('');
  const passesSummaryHtml = orderPasses.map(p => `<tr style="border-bottom:1px solid rgba(0,0,0,0.1)"><td style="padding:12px 0;color:#1A1A1A;font-size:15px">${(p.pass_type || '').replace(/</g, '&lt;')}</td><td style="padding:12px 0;color:#1A1A1A;font-size:15px;text-align:center">${p.quantity}</td><td style="padding:12px 0;color:#1A1A1A;font-size:15px;text-align:right">${(p.price || 0).toFixed(2)} TND</td></tr>`).join('');
  const orderNum = order.order_number != null ? `#${order.order_number}` : id.substring(0, 8).toUpperCase();
  const eventTime = order.events?.date ? new Date(order.events.date).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' }) : 'TBA';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light dark"><title>Your Digital Tickets - Andiamo Events</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;line-height:1.6;color:#1A1A1A;background:#FFF}@media(prefers-color-scheme:dark){body{color:#FFF;background:#1A1A1A}}.email-wrapper{max-width:600px;margin:0 auto;background:#FFF}@media(prefers-color-scheme:dark){.email-wrapper{background:#1A1A1A}}.content-card{background:#F5F5F5;margin:0 20px 30px;border-radius:12px;padding:50px 40px;border:1px solid rgba(0,0,0,0.1)}@media(prefers-color-scheme:dark){.content-card{background:#1F1F1F;border:1px solid rgba(42,42,42,0.5)}}.title-section{text-align:center;margin-bottom:40px;padding-bottom:30px;border-bottom:1px solid rgba(0,0,0,0.1)}@media(prefers-color-scheme:dark){.title-section{border-bottom:1px solid rgba(255,255,255,0.1)}}.title{font-size:32px;font-weight:700;color:#1A1A1A;margin-bottom:12px}@media(prefers-color-scheme:dark){.title{color:#FFF}}.subtitle{font-size:16px;color:#666}@media(prefers-color-scheme:dark){.subtitle{color:#B0B0B0}}.greeting{font-size:18px;color:#1A1A1A;margin-bottom:30px}@media(prefers-color-scheme:dark){.greeting{color:#FFF}}.greeting strong{color:#E21836;font-weight:600}.message{font-size:16px;color:#666;margin-bottom:25px}@media(prefers-color-scheme:dark){.message{color:#B0B0B0}}.order-info-block{background:#E8E8E8;border:1px solid rgba(0,0,0,0.15);border-radius:8px;padding:30px;margin:40px 0}@media(prefers-color-scheme:dark){.order-info-block{background:#252525;border:1px solid rgba(42,42,42,0.8)}}.info-row{margin-bottom:20px}.info-row:last-child{margin-bottom:0}.info-label{font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:10px;font-weight:600}@media(prefers-color-scheme:dark){.info-label{color:#6B6B6B}}.info-value{font-family:'Courier New',monospace;font-size:18px;color:#1A1A1A;font-weight:500}@media(prefers-color-scheme:dark){.info-value{color:#FFF}}.passes-table{width:100%;border-collapse:collapse;margin:20px 0}.passes-table th{text-align:left;padding:12px 0;color:#E21836;font-weight:600;font-size:14px;border-bottom:2px solid rgba(226,24,54,0.3)}.passes-table td{padding:12px 0;color:#1A1A1A;font-size:15px}@media(prefers-color-scheme:dark){.passes-table td{color:#FFF}}.total-row{border-top:2px solid rgba(226,24,54,0.3)}.total-row td{font-weight:700;font-size:18px;color:#E21836;padding-top:15px}.tickets-section{background:#E8E8E8;border:1px solid rgba(0,0,0,0.15);border-radius:8px;padding:30px;margin:40px 0}@media(prefers-color-scheme:dark){.tickets-section{background:#252525;border:1px solid rgba(42,42,42,0.8)}}.support-section{background:#E8E8E8;border-left:3px solid rgba(226,24,54,0.3);padding:20px 25px;margin:35px 0;border-radius:4px}@media(prefers-color-scheme:dark){.support-section{background:#252525}}.support-text{font-size:14px;color:#666;line-height:1.7}@media(prefers-color-scheme:dark){.support-text{color:#B0B0B0}}.support-email{color:#E21836!important;text-decoration:none;font-weight:500}.closing-section{text-align:center;margin:50px 0 40px;padding-top:40px;border-top:1px solid rgba(0,0,0,0.1)}@media(prefers-color-scheme:dark){.closing-section{border-top:1px solid rgba(255,255,255,0.1)}}.slogan{font-size:24px;font-style:italic;color:#E21836;font-weight:300;margin-bottom:30px}.signature{font-size:16px;color:#666;line-height:1.7}@media(prefers-color-scheme:dark){.signature{color:#B0B0B0}}@media only screen and (max-width:600px){.content-card{margin:0 15px 20px;padding:35px 25px}.title{font-size:26px}.order-info-block,.tickets-section{padding:25px 20px}}</style></head><body><div class="email-wrapper"><div class="content-card"><div class="title-section"><h1 class="title">Your Tickets Are Ready</h1><p class="subtitle">Order Confirmation - Andiamo Events</p></div><p class="greeting">Dear <strong>${(order.user_name || 'Valued Customer').replace(/</g, '&lt;')}</strong>,</p><p class="message">We're excited to confirm that your order has been successfully processed! Your digital tickets with unique QR codes are ready and attached below.</p><div class="order-info-block"><div class="info-row"><div class="info-label">Order Number</div><div class="info-value">${orderNum}</div></div><div class="info-row"><div class="info-label">Event</div><div style="font-size:18px;color:#E21836;font-weight:600">${(order.events?.name || 'Event').replace(/</g, '&lt;')}</div></div><div class="info-row"><div class="info-label">Event Time</div><div style="font-size:18px;color:#E21836;font-weight:600">${(eventTime || 'TBA').replace(/</g, '&lt;')}</div></div><div class="info-row"><div class="info-label">Venue</div><div style="font-size:18px;color:#E21836;font-weight:600">${(order.events?.venue || 'Venue to be announced').replace(/</g, '&lt;')}</div></div></div><div class="order-info-block"><h3 style="color:#E21836;margin-bottom:20px;font-size:18px;font-weight:600">Passes Purchased</h3><table class="passes-table"><thead><tr><th>Pass Type</th><th style="text-align:center">Quantity</th><th style="text-align:right">Price</th></tr></thead><tbody>${passesSummaryHtml}<tr class="total-row"><td colspan="2" style="text-align:right;padding-right:20px"><strong>Total Amount Paid:</strong></td><td style="text-align:right"><strong>${(order.total_price || 0).toFixed(2)} TND</strong></td></tr></tbody></table></div><div class="tickets-section"><h3 style="color:#E21836;margin-bottom:20px;font-size:18px;font-weight:600">Your Digital Tickets</h3><p class="message" style="margin-bottom:25px">Please present these QR codes at the event entrance. Each ticket has a unique QR code for verification.</p>${ticketsHtml}</div><div class="support-section"><p class="support-text">Need assistance? Contact us at <a href="mailto:support@andiamoevents.com" class="support-email">support@andiamoevents.com</a>.</p></div><div class="closing-section"><p class="slogan">We Create Memories</p><p class="signature">Best regards,<br>The Andiamo Events Team</p></div></div></div></body></html>`;
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) return res.status(500).json({ error: 'Email not configured' });
  try {
    const nodemailer = (await import('nodemailer')).default;
    const tr = nodemailer.createTransport({ host: process.env.EMAIL_HOST, port: parseInt(process.env.EMAIL_PORT || '587'), secure: false, auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
    await tr.sendMail({ from: '"Andiamo Events" <contact@andiamoevents.com>', replyTo: '"Andiamo Events" <contact@andiamoevents.com>', to: order.user_email, subject: 'Your Digital Tickets Are Ready - Andiamo Events', html });
    await posAuditLog(sb, { action: 'resend_pos_order_email', performed_by_type: 'admin', performed_by_id: auth.admin.id, performed_by_email: auth.admin.email, pos_outlet_id: order.pos_outlet_id, target_type: 'order', target_id: id, details: { type: 'tickets' }, req });
    return res.status(200).json({ success: true });
  } catch (er) { return res.status(500).json({ error: String(er && er.message) }); }
}

// --- Orders: reject (decrement pos_pass_stock) ---
async function ordersReject(sb, id, body, auth, req, res) {
  const { data: order, error: e0 } = await sb.from('orders').select('id, status, pos_outlet_id, event_id').eq('id', id).single();
  if (e0 || !order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'PENDING_ADMIN_APPROVAL') return res.status(400).json({ error: 'Order not in PENDING_ADMIN_APPROVAL' });
  const { data: passes } = await sb.from('order_passes').select('pass_id, quantity').eq('order_id', id);
  for (const p of passes || []) {
    const { data: r } = await sb.from('pos_pass_stock').select('sold_quantity').eq('pos_outlet_id', order.pos_outlet_id).eq('event_id', order.event_id).eq('pass_id', p.pass_id).single();
    if (r) await sb.from('pos_pass_stock').update({ sold_quantity: Math.max(0, (r.sold_quantity || 0) - p.quantity), updated_at: new Date().toISOString() }).eq('pos_outlet_id', order.pos_outlet_id).eq('event_id', order.event_id).eq('pass_id', p.pass_id);
  }
  await sb.from('orders').update({
    status: 'REJECTED',
    cancelled_by: 'admin',
    cancellation_reason: (body || {}).reason || null,
    cancelled_at: new Date().toISOString(),
    rejected_by: auth.admin.id,
    updated_at: new Date().toISOString()
  }).eq('id', id);
  await posAuditLog(sb, { action: 'reject_pos_order', performed_by_type: 'admin', performed_by_id: auth.admin.id, performed_by_email: auth.admin.email, pos_outlet_id: order.pos_outlet_id, target_type: 'order', target_id: id, details: { reason: (body || {}).reason }, req });
  return res.status(200).json({ success: true });
}

// --- Orders: remove (decrement pos_pass_stock, return stock, delete qr_tickets for PAID) ---
async function ordersRemove(sb, id, auth, req, res) {
  const { data: order, error: e0 } = await sb.from('orders').select('id, status, pos_outlet_id, event_id').eq('id', id).single();
  if (e0 || !order) return res.status(404).json({ error: 'Order not found' });
  if (order.status === 'REJECTED' || order.status === 'REMOVED_BY_ADMIN') return res.status(400).json({ error: 'Order already rejected or removed. Stock was already returned.' });
  const { data: passes } = await sb.from('order_passes').select('pass_id, quantity').eq('order_id', id);
  for (const p of passes || []) {
    const { data: r } = await sb.from('pos_pass_stock').select('sold_quantity').eq('pos_outlet_id', order.pos_outlet_id).eq('event_id', order.event_id).eq('pass_id', p.pass_id).single();
    if (r) await sb.from('pos_pass_stock').update({ sold_quantity: Math.max(0, (r.sold_quantity || 0) - p.quantity), updated_at: new Date().toISOString() }).eq('pos_outlet_id', order.pos_outlet_id).eq('event_id', order.event_id).eq('pass_id', p.pass_id);
  }
  // Remove from qr_tickets so those QR codes can no longer be scanned (PAID orders had qr_tickets; PENDING had none)
  await sb.from('qr_tickets').delete().eq('order_id', id);
  await sb.from('orders').update({ status: 'REMOVED_BY_ADMIN', removed_by: auth.admin.id, updated_at: new Date().toISOString() }).eq('id', id);
  await posAuditLog(sb, { action: 'remove_pos_order', performed_by_type: 'admin', performed_by_id: auth.admin.id, performed_by_email: auth.admin.email, pos_outlet_id: order.pos_outlet_id, target_type: 'order', target_id: id, details: {}, req });
  return res.status(200).json({ success: true });
}

// --- Orders: approve (tickets, email, SMS) — simplified version of admin-approve-order for POS ---
async function ordersApprove(sb, id, auth, req, res) {
  const { data: order, error: e0 } = await sb.from('orders').select(`
    id, order_number, status, source, payment_method, user_name, user_phone, user_email, total_price, event_id, pos_outlet_id, city, ville,
    events(id, name, date, venue)
  `).eq('id', id).single();
  if (e0 || !order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'PENDING_ADMIN_APPROVAL') return res.status(400).json({ error: 'Order not in PENDING_ADMIN_APPROVAL' });

  const { data: orderPasses } = await sb.from('order_passes').select('id, pass_id, pass_type, quantity, price').eq('order_id', id);
  if (!orderPasses || orderPasses.length === 0) return res.status(400).json({ error: 'No passes for this order' });

  // Update order: PAID + approved_by
  await sb.from('orders').update({
    status: 'PAID',
    payment_status: 'PAID',
    approved_at: new Date().toISOString(),
    approved_by: auth.admin.id,
    updated_at: new Date().toISOString()
  }).eq('id', id).eq('status', 'PENDING_ADMIN_APPROVAL');

  const { v4: uuidv4 } = await import('uuid');
  const QRCode = await import('qrcode');
  const storage = sb.storage.from('tickets');
  const tickets = [];

  for (const pass of orderPasses) {
    for (let i = 0; i < pass.quantity; i++) {
      const secureToken = uuidv4();
      const buf = await QRCode.default.toBuffer(secureToken, { type: 'png', width: 300, margin: 2 });
      const fname = `tickets/${id}/${secureToken}.png`;
      await storage.upload(fname, buf, { contentType: 'image/png', upsert: true });
      const { data: urlData } = storage.getPublicUrl(fname);
      const { data: t } = await sb.from('tickets').insert({
        order_id: id,
        order_pass_id: pass.id,
        secure_token: secureToken,
        qr_code_url: urlData?.publicUrl || null,
        status: 'GENERATED',
        generated_at: new Date().toISOString()
      }).select().single();
      if (t) {
        tickets.push(t);
        await sb.from('qr_tickets').insert({
          secure_token: secureToken,
          ticket_id: t.id,
          order_id: id,
          source: 'point_de_vente',
          payment_method: order.payment_method || 'pos',
          ambassador_id: null,
          ambassador_name: null,
          ambassador_phone: null,
          buyer_name: order.user_name,
          buyer_phone: order.user_phone,
          buyer_email: order.user_email || null,
          buyer_city: order.city ?? '',
          buyer_ville: order.ville ?? null,
          event_id: order.event_id,
          event_name: order.events?.name || null,
          event_date: order.events?.date || null,
          event_venue: order.events?.venue || null,
          order_pass_id: pass.id,
          pass_type: pass.pass_type || 'Standard',
          pass_price: pass.price || 0,
          ticket_status: 'VALID',
          qr_code_url: t.qr_code_url,
          generated_at: t.generated_at
        }).then(() => {}).catch(er => console.warn('qr_tickets insert:', er));
      }
    }
  }

  // Email (same structure as ambassador "Your Tickets Are Ready" – admin-approve-order)
  const passesSummary = orderPasses.map(p => ({ passType: p.pass_type, quantity: p.quantity, price: p.price }));
  const ticketsByPass = new Map();
  tickets.forEach(t => {
    const p = orderPasses.find(x => x.id === t.order_pass_id);
    if (p) {
      if (!ticketsByPass.has(p.pass_type)) ticketsByPass.set(p.pass_type, []);
      ticketsByPass.get(p.pass_type).push(t);
    }
  });
  const ticketsHtml = Array.from(ticketsByPass.entries()).map(([pt, arr]) => {
    const list = arr.map((t, i) =>
      `<div style="margin:20px 0;padding:20px;background:#E8E8E8;border-radius:8px;text-align:center;border:1px solid rgba(0,0,0,0.1)"><h4 style="margin:0 0 15px 0;color:#E21836;font-size:16px;font-weight:600">${(pt || 'Pass').replace(/</g, '&lt;')} - Ticket ${i + 1}</h4><img src="${t.qr_code_url || ''}" alt="QR" style="max-width:250px;height:auto;border-radius:8px;border:2px solid rgba(226,24,54,0.3);display:block;margin:0 auto" /><p style="margin:10px 0 0 0;font-size:12px;color:#666;font-family:'Courier New',monospace">Token: ${(t.secure_token || '').substring(0, 8)}...</p></div>`
    ).join('');
    return `<div style="margin:30px 0"><h3 style="color:#E21836;margin-bottom:15px;font-size:18px;font-weight:600">${(pt || 'Pass').replace(/</g, '&lt;')} Tickets (${arr.length})</h3>${list}</div>`;
  }).join('');
  const passesSummaryHtml = passesSummary.map(p =>
    `<tr style="border-bottom:1px solid rgba(0,0,0,0.1)"><td style="padding:12px 0;color:#1A1A1A;font-size:15px">${(p.passType || '').replace(/</g, '&lt;')}</td><td style="padding:12px 0;color:#1A1A1A;font-size:15px;text-align:center">${p.quantity}</td><td style="padding:12px 0;color:#1A1A1A;font-size:15px;text-align:right">${(p.price || 0).toFixed(2)} TND</td></tr>`
  ).join('');
  const orderNum = order.order_number != null ? `#${order.order_number}` : id.substring(0, 8).toUpperCase();
  const eventTime = order.events?.date ? new Date(order.events.date).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' }) : 'TBA';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light dark"><title>Your Digital Tickets - Andiamo Events</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;line-height:1.6;color:#1A1A1A;background:#FFF}@media(prefers-color-scheme:dark){body{color:#FFF;background:#1A1A1A}}.email-wrapper{max-width:600px;margin:0 auto;background:#FFF}@media(prefers-color-scheme:dark){.email-wrapper{background:#1A1A1A}}.content-card{background:#F5F5F5;margin:0 20px 30px;border-radius:12px;padding:50px 40px;border:1px solid rgba(0,0,0,0.1)}@media(prefers-color-scheme:dark){.content-card{background:#1F1F1F;border:1px solid rgba(42,42,42,0.5)}}.title-section{text-align:center;margin-bottom:40px;padding-bottom:30px;border-bottom:1px solid rgba(0,0,0,0.1)}@media(prefers-color-scheme:dark){.title-section{border-bottom:1px solid rgba(255,255,255,0.1)}}.title{font-size:32px;font-weight:700;color:#1A1A1A;margin-bottom:12px}@media(prefers-color-scheme:dark){.title{color:#FFF}}.subtitle{font-size:16px;color:#666}@media(prefers-color-scheme:dark){.subtitle{color:#B0B0B0}}.greeting{font-size:18px;color:#1A1A1A;margin-bottom:30px}@media(prefers-color-scheme:dark){.greeting{color:#FFF}}.greeting strong{color:#E21836;font-weight:600}.message{font-size:16px;color:#666;margin-bottom:25px}@media(prefers-color-scheme:dark){.message{color:#B0B0B0}}.order-info-block{background:#E8E8E8;border:1px solid rgba(0,0,0,0.15);border-radius:8px;padding:30px;margin:40px 0}@media(prefers-color-scheme:dark){.order-info-block{background:#252525;border:1px solid rgba(42,42,42,0.8)}}.info-row{margin-bottom:20px}.info-row:last-child{margin-bottom:0}.info-label{font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:10px;font-weight:600}@media(prefers-color-scheme:dark){.info-label{color:#6B6B6B}}.info-value{font-family:'Courier New',monospace;font-size:18px;color:#1A1A1A;font-weight:500}@media(prefers-color-scheme:dark){.info-value{color:#FFF}}.passes-table{width:100%;border-collapse:collapse;margin:20px 0}.passes-table th{text-align:left;padding:12px 0;color:#E21836;font-weight:600;font-size:14px;border-bottom:2px solid rgba(226,24,54,0.3)}.passes-table td{padding:12px 0;color:#1A1A1A;font-size:15px}@media(prefers-color-scheme:dark){.passes-table td{color:#FFF}}.total-row{border-top:2px solid rgba(226,24,54,0.3)}.total-row td{font-weight:700;font-size:18px;color:#E21836;padding-top:15px}.tickets-section{background:#E8E8E8;border:1px solid rgba(0,0,0,0.15);border-radius:8px;padding:30px;margin:40px 0}@media(prefers-color-scheme:dark){.tickets-section{background:#252525;border:1px solid rgba(42,42,42,0.8)}}.support-section{background:#E8E8E8;border-left:3px solid rgba(226,24,54,0.3);padding:20px 25px;margin:35px 0;border-radius:4px}@media(prefers-color-scheme:dark){.support-section{background:#252525}}.support-text{font-size:14px;color:#666;line-height:1.7}@media(prefers-color-scheme:dark){.support-text{color:#B0B0B0}}.support-email{color:#E21836!important;text-decoration:none;font-weight:500}.closing-section{text-align:center;margin:50px 0 40px;padding-top:40px;border-top:1px solid rgba(0,0,0,0.1)}@media(prefers-color-scheme:dark){.closing-section{border-top:1px solid rgba(255,255,255,0.1)}}.slogan{font-size:24px;font-style:italic;color:#E21836;font-weight:300;margin-bottom:30px}.signature{font-size:16px;color:#666;line-height:1.7}@media(prefers-color-scheme:dark){.signature{color:#B0B0B0}}@media only screen and (max-width:600px){.content-card{margin:0 15px 20px;padding:35px 25px}.title{font-size:26px}.order-info-block,.tickets-section{padding:25px 20px}}</style></head><body><div class="email-wrapper"><div class="content-card"><div class="title-section"><h1 class="title">Your Tickets Are Ready</h1><p class="subtitle">Order Confirmation - Andiamo Events</p></div><p class="greeting">Dear <strong>${(order.user_name || 'Valued Customer').replace(/</g, '&lt;')}</strong>,</p><p class="message">We're excited to confirm that your order has been successfully processed! Your digital tickets with unique QR codes are ready and attached below.</p><div class="order-info-block"><div class="info-row"><div class="info-label">Order Number</div><div class="info-value">${orderNum}</div></div><div class="info-row"><div class="info-label">Event</div><div style="font-size:18px;color:#E21836;font-weight:600">${(order.events?.name || 'Event').replace(/</g, '&lt;')}</div></div><div class="info-row"><div class="info-label">Event Time</div><div style="font-size:18px;color:#E21836;font-weight:600">${(eventTime || 'TBA').replace(/</g, '&lt;')}</div></div><div class="info-row"><div class="info-label">Venue</div><div style="font-size:18px;color:#E21836;font-weight:600">${(order.events?.venue || 'Venue to be announced').replace(/</g, '&lt;')}</div></div></div><div class="order-info-block"><h3 style="color:#E21836;margin-bottom:20px;font-size:18px;font-weight:600">Passes Purchased</h3><table class="passes-table"><thead><tr><th>Pass Type</th><th style="text-align:center">Quantity</th><th style="text-align:right">Price</th></tr></thead><tbody>${passesSummaryHtml}<tr class="total-row"><td colspan="2" style="text-align:right;padding-right:20px"><strong>Total Amount Paid:</strong></td><td style="text-align:right"><strong>${(order.total_price || 0).toFixed(2)} TND</strong></td></tr></tbody></table></div><div class="tickets-section"><h3 style="color:#E21836;margin-bottom:20px;font-size:18px;font-weight:600">Your Digital Tickets</h3><p class="message" style="margin-bottom:25px">Please present these QR codes at the event entrance. Each ticket has a unique QR code for verification.</p>${ticketsHtml}</div><div class="support-section"><p class="support-text">Need assistance? Contact us at <a href="mailto:support@andiamoevents.com" class="support-email">support@andiamoevents.com</a>.</p></div><div class="closing-section"><p class="slogan">We Create Memories</p><p class="signature">Best regards,<br>The Andiamo Events Team</p></div></div></div></body></html>`;

  if (order.user_email && process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      const nodemailer = (await import('nodemailer')).default;
      const tr = nodemailer.createTransport({ host: process.env.EMAIL_HOST, port: parseInt(process.env.EMAIL_PORT || '587'), secure: false, auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
      await tr.sendMail({ from: '"Andiamo Events" <contact@andiamoevents.com>', replyTo: '"Andiamo Events" <contact@andiamoevents.com>', to: order.user_email, subject: 'Your Digital Tickets Are Ready - Andiamo Events', html });
      await sb.from('tickets').update({ status: 'DELIVERED', email_delivery_status: 'sent', delivered_at: new Date().toISOString() }).in('id', tickets.map(t => t.id));
    } catch (er) { console.warn('POS approve email:', er); }
  }

  // SMS
  if (order.user_phone && process.env.WINSMS_API_KEY) {
    try {
      let c = order.user_phone.replace(/\D/g, '');
      if (c.startsWith('216')) c = c.slice(3);
      c = c.replace(/^0+/, '');
      if (c.length === 8 && /^[2594]/.test(c)) {
        const msg = `Paiement confirmé #${order.order_number != null ? order.order_number : ''}\nTotal: ${parseFloat(order.total_price).toFixed(0)} DT\nBillets envoyés par email (Check SPAM).\nWe Create Memories`;
        const qs = (await import('querystring')).default;
        const https = (await import('https')).default;
        const u = `https://www.winsmspro.com/sms/sms/api?${qs.stringify({ action: 'send-sms', api_key: process.env.WINSMS_API_KEY, to: '+216' + c, sms: msg, from: 'Andiamo', response: 'json' })}`;
        const smsRes = await new Promise((resolve, reject) => { https.get(u, (r) => { let d = ''; r.on('data', x => d += x); r.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } }); }).on('error', reject); });
        if (smsRes?.code === 'ok' || smsRes?.code === '200') await sb.from('sms_logs').insert({ phone_number: order.user_phone, message: msg, status: 'sent', api_response: JSON.stringify(smsRes), sent_at: new Date().toISOString() });
      }
    } catch (er) { console.warn('POS approve SMS:', er); }
  }

  await posAuditLog(sb, { action: 'approve_pos_order', performed_by_type: 'admin', performed_by_id: auth.admin.id, performed_by_email: auth.admin.email, pos_outlet_id: order.pos_outlet_id, target_type: 'order', target_id: id, details: {}, req });
  return res.status(200).json({ success: true, ticketsCount: tickets.length });
}

// --- Main ---
function getQuery(url) {
  const i = (url || '').indexOf('?');
  if (i < 0) return {};
  const o = {};
  for (const [k, v] of new URLSearchParams(url.slice(i))) o[k] = v;
  return o;
}

export default async (req, res) => {
  // Handle CORS (including preflight)
  if (!setCORS(res, req)) {
    return; // CORS error already handled
  }

  const path = (req.url || '').split('?')[0];
  const method = req.method;
  const q = getQuery(req.url);

  const auth = await verifyAdminAuth(req);
  if (!auth.valid) return res.status(auth.statusCode || 401).json({ error: auth.error });

  let sb;
  try { sb = await getSupabase(); } catch (e) { return res.status(500).json({ error: 'Supabase not configured' }); }

  // Outlets
  if (path === '/api/admin/pos-outlets' && method === 'GET') return outletsList(sb, res);
  if (path === '/api/admin/pos-outlets' && method === 'POST') { const b = await parseBody(req); return outletsCreate(sb, b, auth, req, res); }
  const outId = path.match(/^\/api\/admin\/pos-outlets\/([^/]+)$/);
  if (outId) {
    if (method === 'PATCH') { const b = await parseBody(req); return outletsUpdate(sb, outId[1], b, auth, req, res); }
    if (method === 'DELETE') return outletsDelete(sb, outId[1], auth, req, res);
  }

  // Users
  if (path === '/api/admin/pos-users' && method === 'GET') return usersList(sb, q, res);
  if (path === '/api/admin/pos-users' && method === 'POST') { const b = await parseBody(req); return usersCreate(sb, b, auth, req, res); }
  const usId = path.match(/^\/api\/admin\/pos-users\/([^/]+)$/);
  if (usId) {
    if (method === 'PATCH') { const b = await parseBody(req); return usersUpdate(sb, usId[1], b, auth, req, res); }
    if (method === 'DELETE') return usersDelete(sb, usId[1], auth, req, res);
  }

  // Stock
  if (path === '/api/admin/pos-stock' && method === 'GET') return stockList(sb, q, res);
  if (path === '/api/admin/pos-stock' && method === 'POST') { const b = await parseBody(req); return stockCreate(sb, b, auth, req, res); }
  const stId = path.match(/^\/api\/admin\/pos-stock\/([^/]+)$/);
  if (stId && (method === 'PATCH' || method === 'PUT')) { const b = await parseBody(req); return stockUpdate(sb, stId[1], b, auth, req, res); }

  // Audit
  if (path === '/api/admin/pos-audit-log' && method === 'GET') return auditList(sb, q, res);

  // Events (for POS stock form dropdowns)
  if (path === '/api/admin/pos-events' && method === 'GET') {
    const { data, error } = await sb.from('events').select('id, name, date, venue').order('date', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  }

  // Statistics
  if (path === '/api/admin/pos-statistics' && method === 'GET') return posStatistics(sb, q, res);

  // Orders
  if (path === '/api/admin/pos-orders' && method === 'GET') return ordersList(sb, q, res);
  const ordApp = path.match(/^\/api\/admin\/pos-orders\/([^/]+)\/approve$/);
  const ordRej = path.match(/^\/api\/admin\/pos-orders\/([^/]+)\/reject$/);
  const ordRem = path.match(/^\/api\/admin\/pos-orders\/([^/]+)\/remove$/);
  const ordResendRec = path.match(/^\/api\/admin\/pos-orders\/([^/]+)\/resend-order-received$/);
  const ordResendTic = path.match(/^\/api\/admin\/pos-orders\/([^/]+)\/resend-tickets-email$/);
  const ordPatch = path.match(/^\/api\/admin\/pos-orders\/([^/]+)$/);
  if (ordApp && method === 'POST') return ordersApprove(sb, ordApp[1], auth, req, res);
  if (ordRej && method === 'POST') { const b = await parseBody(req); return ordersReject(sb, ordRej[1], b, auth, req, res); }
  if (ordRem && method === 'POST') return ordersRemove(sb, ordRem[1], auth, req, res);
  if (ordResendRec && method === 'POST') return ordersResendOrderReceived(sb, ordResendRec[1], auth, req, res);
  if (ordResendTic && method === 'POST') return ordersResendTickets(sb, ordResendTic[1], auth, req, res);
  if (ordPatch && method === 'PATCH') { const b = await parseBody(req); return ordersUpdateEmail(sb, ordPatch[1], b, auth, req, res); }

  return res.status(404).json({ error: 'Not found' });
};
