// Point de Vente (POS) API – /api/pos/:outletSlug/login | logout | verify | events | passes/:eventId | orders/create
// Outlet is always resolved by :outletSlug from URL. Never trust frontend for outlet or auth.

import https from 'https';
import querystring from 'querystring';

// Import shared CORS utility (using dynamic import for ES modules)
let corsUtils = null;
async function getCorsUtils() {
  if (!corsUtils) {
    corsUtils = await import('./utils/cors.js');
  }
  return corsUtils;
}

async function setCORSHeaders(res, req) {
  const { setCORSHeaders: setCORSHeadersUtil, handlePreflight } = await getCorsUtils();
  if (req.method === 'OPTIONS') {
    return handlePreflight(req, res, { methods: 'GET, POST, PUT, PATCH, DELETE, OPTIONS', headers: 'Content-Type, Authorization' });
  }
  // Set CORS headers if Origin is present and allowed
  // If no Origin header (same-origin request), don't set CORS headers but allow the request
  const hasOrigin = !!req.headers?.origin;
  if (hasOrigin && !setCORSHeadersUtil(res, req, { methods: 'GET, POST, PUT, PATCH, DELETE, OPTIONS', headers: 'Content-Type, Authorization' })) {
    // Origin present but not allowed - reject
    res.status(403).json({ error: 'CORS policy: Origin not allowed' });
    return false;
  }
  // No origin (same-origin) or origin allowed - proceed
  return true;
}

async function parseBody(req) {
  if (req.body) return req.body;
  let body = '';
  for await (const chunk of req) body += chunk.toString();
  return JSON.parse(body || '{}');
}

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

function formatPhoneNumber(phone) {
  if (!phone) return null;
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('216')) cleaned = cleaned.slice(3);
  cleaned = cleaned.replace(/^0+/, '');
  if (cleaned.length === 8 && /^[2594]/.test(cleaned)) return '+216' + cleaned;
  return null;
}

async function sendSms(phoneNumbers, message, senderId = 'Andiamo') {
  const key = process.env.WINSMS_API_KEY;
  if (!key) throw new Error('WINSMS_API_KEY not set');
  const arr = Array.isArray(phoneNumbers) ? phoneNumbers : [phoneNumbers];
  const to = arr.map(formatPhoneNumber).filter(Boolean);
  if (to.length === 0) throw new Error('No valid phone numbers');
  const q = querystring.stringify({
    action: 'send-sms',
    api_key: key,
    to: to.join(','),
    sms: (message || '').trim(),
    from: senderId,
    response: 'json'
  });
  const url = `https://www.winsmspro.com/sms/sms/api?${q}`;
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let d = '';
      res.on('data', c => (d += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d), raw: d }); }
        catch (e) { resolve({ status: res.statusCode, data: d, raw: d }); }
      });
    }).on('error', e => reject(e));
  });
}

/** Parse /api/pos/:outletSlug/... into { outletSlug, action, actionId }.
 *  /api/pos/paris-store/login -> { outletSlug:'paris-store', action:'login', actionId:null }
 *  /api/pos/paris-store/passes/evt-uuid -> { outletSlug:'paris-store', action:'passes', actionId:'evt-uuid' }
 *  /api/pos/paris-store/orders/create -> { outletSlug:'paris-store', action:'orders', actionId:'create' }
 */
function parsePosPath(url) {
  const path = (url || '').split('?')[0];
  const parts = path.split('/').filter(Boolean);
  if (parts[0] !== 'api' || parts[1] !== 'pos' || !parts[2]) return null;
  return {
    outletSlug: parts[2],
    action: parts[3] || '',
    actionId: parts[4] || null
  };
}

async function getSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  if (!process.env.SUPABASE_URL) throw new Error('SUPABASE_URL not set');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!key) throw new Error('Supabase key not set');
  return createClient(process.env.SUPABASE_URL, key);
}

async function getOutletBySlug(supabase, slug) {
  const { data, error } = await supabase
    .from('pos_outlets')
    .select('id, name, slug')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();
  if (error || !data) return null;
  return data;
}

// In-memory rate limit for login: 6 attempts per 15 min per IP (resets on cold start in serverless)
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX = 6;

function checkLoginRateLimit(ip) {
  const now = Date.now();
  let rec = loginAttempts.get(ip);
  if (!rec) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }
  if (now > rec.resetAt) {
    rec = { count: 1, resetAt: now + LOGIN_WINDOW_MS };
    loginAttempts.set(ip, rec);
    return true;
  }
  rec.count += 1;
  if (rec.count > LOGIN_MAX) return false;
  return true;
}

/**
 * requirePosAuth: resolve outlet by slug, verify posToken cookie (JWT with pos_user_id, pos_outlet_id),
 * re-validate pos_users (is_active, !is_paused). Returns { posUser, outlet } or { valid: false, statusCode, error }.
 */
async function requirePosAuth(req, supabase, outlet) {
  const cookies = req.headers.cookie || '';
  const m = cookies.match(/posToken=([^;]+)/);
  const token = m ? m[1] : null;
  if (!token) return { valid: false, statusCode: 401, error: 'Not authenticated' };

  const jwtMod = await import('jsonwebtoken');
  const jwt = jwtMod.default;
  const secret = process.env.JWT_SECRET || 'fallback-secret-dev-only';
  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch (e) {
    return { valid: false, statusCode: 401, error: 'Invalid or expired session' };
  }
  if (!decoded.pos_user_id || !decoded.pos_outlet_id || decoded.role !== 'pos') {
    return { valid: false, statusCode: 401, error: 'Invalid token' };
  }
  if (decoded.pos_outlet_id !== outlet.id) {
    return { valid: false, statusCode: 403, error: 'Outlet mismatch' };
  }

  const { data: pu, error } = await supabase
    .from('pos_users')
    .select('id, name, email, is_active, is_paused')
    .eq('id', decoded.pos_user_id)
    .single();
  if (error || !pu) return { valid: false, statusCode: 401, error: 'User not found' };
  if (!pu.is_active || pu.is_paused) return { valid: false, statusCode: 403, error: 'Account paused or inactive' };

  return { valid: true, posUser: pu, outlet };
}

// --- Route handlers ---

async function handleLogin(req, res, supabase, outletSlug) {
  const ip = getClientIp(req);
  if (!checkLoginRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
  }

  let body;
  try { body = await parseBody(req); } catch (e) { return res.status(400).json({ error: 'Invalid JSON' }); }
  const { email, password } = body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const outlet = await getOutletBySlug(supabase, outletSlug);
  if (!outlet) return res.status(404).json({ error: 'Outlet not found or inactive' });

  const { data: user, error: uErr } = await supabase
    .from('pos_users')
    .select('id, name, email, password_hash, is_active, is_paused')
    .eq('pos_outlet_id', outlet.id)
    .ilike('email', email.trim())
    .single();
  if (uErr || !user) return res.status(401).json({ error: 'Invalid credentials' });
  if (!user.is_active || user.is_paused) return res.status(403).json({ error: 'Account paused or inactive' });

  const bcryptMod = await import('bcryptjs');
  const ok = await bcryptMod.default.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const jwtMod = await import('jsonwebtoken');
  const secret = process.env.JWT_SECRET || 'fallback-secret-dev-only';
  const token = jwtMod.default.sign(
    { pos_user_id: user.id, pos_outlet_id: outlet.id, email: user.email, role: 'pos' },
    secret,
    { expiresIn: '8h' }
  );

  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1' || !!process.env.VERCEL_URL;
  const parts = [
    `posToken=${token}`,
    'HttpOnly',
    'Path=/',
    'Max-Age=28800',
    isProd ? 'Secure' : '',
    'SameSite=Lax'
  ].filter(Boolean);
  if (isProd && process.env.COOKIE_DOMAIN) parts.push(`Domain=${process.env.COOKIE_DOMAIN}`);
  res.setHeader('Set-Cookie', parts.join('; '));
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    success: true,
    pos_user: { id: user.id, email: user.email, name: user.name },
    outlet: { id: outlet.id, name: outlet.name, slug: outlet.slug }
  });
}

async function handleLogout(req, res, _supabase, _outletSlug) {
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1' || !!process.env.VERCEL_URL;
  const parts = [
    'posToken=',
    'HttpOnly',
    'Path=/',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    isProd ? 'Secure' : '',
    'SameSite=Lax'
  ].filter(Boolean);
  if (isProd && process.env.COOKIE_DOMAIN) parts.push(`Domain=${process.env.COOKIE_DOMAIN}`);
  res.setHeader('Set-Cookie', parts.join('; '));
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({ success: true });
}

async function handleVerify(req, res, supabase, outletSlug) {
  const outlet = await getOutletBySlug(supabase, outletSlug);
  if (!outlet) return res.status(404).json({ error: 'Outlet not found or inactive' });

  const auth = await requirePosAuth(req, supabase, outlet);
  if (!auth.valid) return res.status(auth.statusCode || 401).json({ error: auth.error });

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    valid: true,
    pos_user: { id: auth.posUser.id, email: auth.posUser.email, name: auth.posUser.name },
    outlet: { id: auth.outlet.id, name: auth.outlet.name, slug: auth.outlet.slug }
  });
}

/** GET /api/pos/:outletSlug/events – events that have at least one pos_pass_stock for this outlet. */
async function handleEvents(req, res, supabase, outletSlug) {
  const outlet = await getOutletBySlug(supabase, outletSlug);
  if (!outlet) return res.status(404).json({ error: 'Outlet not found or inactive' });
  const auth = await requirePosAuth(req, supabase, outlet);
  if (!auth.valid) return res.status(auth.statusCode || 401).json({ error: auth.error });

  const { data: stocks } = await supabase
    .from('pos_pass_stock')
    .select('event_id')
    .eq('pos_outlet_id', outlet.id)
    .eq('is_active', true);
  const eventIds = [...new Set((stocks || []).map((s) => s.event_id).filter(Boolean))];
  if (eventIds.length === 0) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json([]);
  }

  const { data: events, error } = await supabase
    .from('events')
    .select('id, name, date, venue, city')
    .in('id', eventIds)
    .order('date', { ascending: true });
  if (error) return res.status(500).json({ error: 'Failed to fetch events' });

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json(events || []);
}

/** GET /api/pos/:outletSlug/passes/:eventId – pos_pass_stock + event_passes: remaining, sold_quantity. */
async function handlePasses(req, res, supabase, outletSlug, eventId) {
  if (!eventId) return res.status(400).json({ error: 'Event ID required' });
  const outlet = await getOutletBySlug(supabase, outletSlug);
  if (!outlet) return res.status(404).json({ error: 'Outlet not found or inactive' });
  const auth = await requirePosAuth(req, supabase, outlet);
  if (!auth.valid) return res.status(auth.statusCode || 401).json({ error: auth.error });

  const { data: stocks, error: stockErr } = await supabase
    .from('pos_pass_stock')
    .select('id, pass_id, max_quantity, sold_quantity')
    .eq('pos_outlet_id', outlet.id)
    .eq('event_id', eventId)
    .eq('is_active', true);
  if (stockErr) return res.status(500).json({ error: 'Failed to fetch passes' });
  const passIds = (stocks || []).map((s) => s.pass_id).filter(Boolean);
  if (passIds.length === 0) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json([]);
  }

  const { data: eventPasses, error: epErr } = await supabase
    .from('event_passes')
    .select('id, name, price, description, is_primary, is_active')
    .in('id', passIds)
    .eq('is_active', true);
  if (epErr) return res.status(500).json({ error: 'Failed to fetch passes' });
  const epMap = new Map((eventPasses || []).map((p) => [p.id, p]));

  const passes = (stocks || [])
    .map((r) => {
      const ep = epMap.get(r.pass_id);
      if (!ep) return null;
      const remaining = r.max_quantity == null ? null : Math.max(0, r.max_quantity - (r.sold_quantity || 0));
      return {
        id: ep.id,
        name: ep.name,
        price: parseFloat(ep.price),
        description: ep.description || '',
        is_primary: !!ep.is_primary,
        sold_quantity: r.sold_quantity || 0,
        max_quantity: r.max_quantity,
        remaining
      };
    })
    .filter(Boolean);

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json(passes);
}

/** POST /api/pos/:outletSlug/orders/create – create POS order, increment pos_pass_stock, SMS, email, audit. */
async function handleOrdersCreate(req, res, supabase, outletSlug) {
  const outlet = await getOutletBySlug(supabase, outletSlug);
  if (!outlet) return res.status(404).json({ error: 'Outlet not found or inactive' });
  const auth = await requirePosAuth(req, supabase, outlet);
  if (!auth.valid) return res.status(auth.statusCode || 401).json({ error: auth.error });

  let body;
  try { body = await parseBody(req); } catch (e) { return res.status(400).json({ error: 'Invalid JSON' }); }
  const { customerInfo, passes, eventId } = body || {};
  if (!customerInfo || !passes || !Array.isArray(passes) || passes.length === 0 || !eventId) {
    return res.status(400).json({ error: 'customerInfo, passes and eventId required' });
  }
  const { full_name, phone, email } = customerInfo;
  if (!full_name || !phone || !email) return res.status(400).json({ error: 'full_name, phone, email required' });

  // Validate event
  const { data: ev, error: evErr } = await supabase.from('events').select('id').eq('id', eventId).single();
  if (evErr || !ev) return res.status(400).json({ error: 'Event not found' });

  // Validate passes: exist, belong to event, and POS stock allows
  const passIds = passes.map((p) => p.passId).filter(Boolean);
  const { data: eventPasses, error: epErr } = await supabase
    .from('event_passes')
    .select('id, name, price, event_id')
    .in('id', passIds)
    .eq('event_id', eventId);
  if (epErr || !eventPasses || eventPasses.length !== passIds.length) {
    return res.status(400).json({ error: 'Invalid passes or pass not in event' });
  }
  const epMap = new Map(eventPasses.map((p) => [p.id, p]));

  const { data: posStocks } = await supabase
    .from('pos_pass_stock')
    .select('pass_id, max_quantity, sold_quantity')
    .eq('pos_outlet_id', outlet.id)
    .eq('event_id', eventId)
    .eq('is_active', true);
  const stockMap = new Map((posStocks || []).map((s) => [s.pass_id, s]));

  const validatedPasses = [];
  let totalPrice = 0;
  let totalQty = 0;
  for (const p of passes) {
    const ep = epMap.get(p.passId);
    if (!ep) return res.status(400).json({ error: `Pass ${p.passId} not found` });
    const st = stockMap.get(p.passId);
    if (!st) return res.status(400).json({ error: `No POS stock for pass ${ep.name}` });
    const qty = Math.max(1, parseInt(p.quantity, 10) || 1);
    const price = parseFloat(ep.price);
    if (st.max_quantity != null && (st.sold_quantity || 0) + qty > st.max_quantity) {
      return res.status(400).json({ error: `Insufficient POS stock for ${ep.name}` });
    }
    validatedPasses.push({ passId: ep.id, passName: ep.name, quantity: qty, price });
    totalPrice += price * qty;
    totalQty += qty;
  }

  const orderData = {
    source: 'point_de_vente',
    pos_outlet_id: outlet.id,
    pos_user_id: auth.posUser.id,
    payment_method: 'pos',
    event_id: eventId,
    user_name: (full_name || '').trim(),
    user_phone: (phone || '').trim(),
    user_email: (email || '').trim() || null,
    city: (customerInfo.city || '').trim() || '',
    ville: (customerInfo.ville || '').trim() || null,
    quantity: totalQty,
    total_price: totalPrice,
    status: 'PENDING_ADMIN_APPROVAL',
    ambassador_id: null,
    stock_released: false,
    notes: JSON.stringify({ all_passes: validatedPasses, total_order_price: totalPrice })
  };

  const { data: order, error: orderErr } = await supabase.from('orders').insert(orderData).select().single();
  if (orderErr) return res.status(500).json({ error: 'Failed to create order', details: orderErr.message });

  const orderPassesData = validatedPasses.map((p) => ({
    order_id: order.id,
    pass_id: p.passId,
    pass_type: p.passName,
    quantity: p.quantity,
    price: p.price
  }));
  const { error: opErr } = await supabase.from('order_passes').insert(orderPassesData);
  if (opErr) {
    await supabase.from('orders').delete().eq('id', order.id);
    return res.status(500).json({ error: 'Failed to create order passes' });
  }

  // Increment pos_pass_stock.sold_quantity (fetch then update; no RPC)
  for (const p of validatedPasses) {
    const { data: row } = await supabase.from('pos_pass_stock')
      .select('sold_quantity')
      .eq('pos_outlet_id', outlet.id).eq('event_id', eventId).eq('pass_id', p.passId)
      .single();
    if (row) {
      await supabase.from('pos_pass_stock')
        .update({ sold_quantity: (row.sold_quantity || 0) + p.quantity, updated_at: new Date().toISOString() })
        .eq('pos_outlet_id', outlet.id).eq('event_id', eventId).eq('pass_id', p.passId);
    }
  }

  // Audit
  await supabase.from('pos_audit_log').insert({
    action: 'create_pos_order',
    performed_by_type: 'pos_user',
    performed_by_id: auth.posUser.id,
    performed_by_email: auth.posUser.email,
    pos_outlet_id: outlet.id,
    target_type: 'order',
    target_id: order.id,
    details: {},
    ip_address: getClientIp(req),
    user_agent: req.headers['user-agent'] || null
  });

  // SMS
  try {
    const smsTpl = (await import('../smsTemplates.cjs')).default;
    const msg = smsTpl.buildPosClientOrderReceivedSMS({
      order,
      passes: validatedPasses.map((x) => ({ pass_type: x.passName, quantity: x.quantity })),
      outletName: outlet.name
    });
    const ph = formatPhoneNumber(order.user_phone);
    if (ph && process.env.WINSMS_API_KEY) {
      const smsRes = await sendSms(ph, msg);
      await supabase.from('sms_logs').insert({
        phone_number: order.user_phone,
        message: msg.trim(),
        status: (smsRes.data?.code === 'ok' || smsRes.data?.code === '200') ? 'sent' : 'failed',
        api_response: JSON.stringify(smsRes.data || {}),
        sent_at: (smsRes.data?.code === 'ok' || smsRes.data?.code === '200') ? new Date().toISOString() : null,
        error_message: (smsRes.data?.code === 'ok' || smsRes.data?.code === '200') ? null : (smsRes.data?.message || 'SMS failed')
      });
    }
  } catch (smsE) { console.warn('POS order SMS failed:', smsE); }

  // Email (same structure as Payment Processing / ambassador order-received)
  if (order.user_email && process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      const nodemailer = (await import('nodemailer')).default;
      const transport = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587', 10),
        secure: false,
        requireTLS: true,
        auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS }
      });
      const on = (order.order_number != null) ? `#${order.order_number}` : order.id.slice(0, 8);
      const passesRows = validatedPasses.map((p) =>
        `<tr><td>${(p.passName || '').replace(/</g, '&lt;')}</td><td style="text-align:center">${p.quantity}</td><td style="text-align:right">${(p.price || 0).toFixed(2)} TND</td></tr>`
      ).join('');
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light dark"><title>Payment Processing – Andiamo Events</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;line-height:1.6;color:#1A1A1A;background:#FFF}@media(prefers-color-scheme:dark){body{color:#FFF;background:#1A1A1A}}a{color:#E21836!important;text-decoration:none}.email-wrapper{max-width:600px;margin:0 auto;background:#FFF}@media(prefers-color-scheme:dark){.email-wrapper{background:#1A1A1A}}.content-card{background:#F5F5F5;margin:0 20px 30px;border-radius:12px;padding:50px 40px;border:1px solid rgba(0,0,0,0.1)}@media(prefers-color-scheme:dark){.content-card{background:#1F1F1F;border:1px solid rgba(42,42,42,0.5)}}.title-section{text-align:center;margin-bottom:40px;padding-bottom:30px;border-bottom:1px solid rgba(0,0,0,0.1)}@media(prefers-color-scheme:dark){.title-section{border-bottom:1px solid rgba(255,255,255,0.1)}}.title{font-size:32px;font-weight:700;color:#1A1A1A;margin-bottom:12px}@media(prefers-color-scheme:dark){.title{color:#FFF}}.subtitle{font-size:16px;color:#666}@media(prefers-color-scheme:dark){.subtitle{color:#B0B0B0}}.greeting{font-size:18px;color:#1A1A1A;margin-bottom:30px;line-height:1.7}@media(prefers-color-scheme:dark){.greeting{color:#FFF}}.greeting strong{color:#E21836;font-weight:600}.message{font-size:16px;color:#666;margin-bottom:25px;line-height:1.7}@media(prefers-color-scheme:dark){.message{color:#B0B0B0}}.order-info-block{background:#E8E8E8;border:1px solid rgba(0,0,0,0.15);border-radius:8px;padding:30px;margin:40px 0}@media(prefers-color-scheme:dark){.order-info-block{background:#252525;border:1px solid rgba(42,42,42,0.8)}}.info-row{margin-bottom:20px}.info-row:last-child{margin-bottom:0}.info-label{font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:10px;font-weight:600}@media(prefers-color-scheme:dark){.info-label{color:#6B6B6B}}.info-value{font-family:'Courier New',monospace;font-size:18px;color:#1A1A1A;font-weight:500}@media(prefers-color-scheme:dark){.info-value{color:#FFF}}.passes-table{width:100%;border-collapse:collapse;margin:20px 0}.passes-table th{text-align:left;padding:12px 0;color:#E21836;font-weight:600;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid rgba(226,24,54,0.3)}.passes-table td{padding:12px 0;color:#1A1A1A;font-size:15px}@media(prefers-color-scheme:dark){.passes-table td{color:#FFF}}.total-row{border-top:2px solid rgba(226,24,54,0.3);margin-top:10px;padding-top:15px}.total-row td{font-weight:700;font-size:18px;color:#E21836;padding-top:15px}.support-section{background:#E8E8E8;border-left:3px solid rgba(226,24,54,0.3);padding:20px 25px;margin:35px 0;border-radius:4px}@media(prefers-color-scheme:dark){.support-section{background:#252525}}.support-text{font-size:14px;color:#666;line-height:1.7}@media(prefers-color-scheme:dark){.support-text{color:#B0B0B0}}.closing-section{text-align:center;margin:50px 0 40px;padding-top:40px;border-top:1px solid rgba(0,0,0,0.1)}@media(prefers-color-scheme:dark){.closing-section{border-top:1px solid rgba(255,255,255,0.1)}}.slogan{font-size:24px;font-style:italic;color:#E21836;font-weight:300;margin-bottom:30px}.signature{font-size:16px;color:#666;line-height:1.7}@media(prefers-color-scheme:dark){.signature{color:#B0B0B0}}.footer{margin-top:50px;padding:40px 20px 30px;text-align:center;border-top:1px solid rgba(0,0,0,0.1)}@media(prefers-color-scheme:dark){.footer{border-top:1px solid rgba(255,255,255,0.05)}}.footer-text{font-size:12px;color:#999;margin-bottom:20px;line-height:1.6}@media(prefers-color-scheme:dark){.footer-text{color:#6B6B6B}}.footer-links{margin:15px auto 0;text-align:center}.footer-link{color:#999;text-decoration:none;font-size:13px;margin:0 8px}@media(prefers-color-scheme:dark){.footer-link{color:#6B6B6B}}@media only screen and (max-width:600px){.content-card{margin:0 15px 20px;padding:35px 25px}.title{font-size:26px}.order-info-block{padding:25px 20px}}</style></head><body><div class="email-wrapper"><div class="content-card"><div class="title-section"><h1 class="title">Payment Processing</h1><p class="subtitle">Payment Processing – Andiamo Events</p></div><p class="greeting">Dear <strong>${(order.user_name || 'Valued Customer').replace(/</g, '&lt;')}</strong>,</p><p class="message">Your order has been received via our Point de vente <strong>${(outlet.name || '').replace(/</g, '&lt;')}</strong>.<br><br>Your order is pending approval by our team. Once approved, you will receive a final confirmation email with your tickets (QR codes). Please check your spam folder.</p><div class="order-info-block"><div class="info-row"><div class="info-label">Order Number</div><div class="info-value">${on}</div></div><div class="info-row"><div class="info-label">Point de vente</div><div style="font-size:18px;color:#E21836;font-weight:600">${(outlet.name || '').replace(/</g, '&lt;')}</div></div></div><div class="order-info-block"><h3 style="color:#E21836;margin-bottom:20px;font-size:18px;font-weight:600">Passes Purchased</h3><table class="passes-table"><thead><tr><th>Pass Type</th><th style="text-align:center">Quantity</th><th style="text-align:right">Price</th></tr></thead><tbody>${passesRows}<tr class="total-row"><td colspan="2" style="text-align:right;padding-right:20px"><strong>Total Amount:</strong></td><td style="text-align:right"><strong>${totalPrice.toFixed(2)} TND</strong></td></tr></tbody></table></div><div class="support-section"><p class="support-text">Need assistance? Contact us at <a href="mailto:Contact@andiamoevents.com" style="color:#E21836!important;text-decoration:none;font-weight:500">Contact@andiamoevents.com</a> or on Instagram <a href="https://www.instagram.com/andiamo.events/" target="_blank" style="color:#E21836!important;text-decoration:none;font-weight:500">@andiamo.events</a> or call <a href="tel:28070128" style="color:#E21836!important;text-decoration:none;font-weight:500">28070128</a>.</p></div><div class="closing-section"><p class="slogan">We Create Memories</p><p class="signature">Best regards,<br>The Andiamo Events Team</p></div></div><div class="footer"><p class="footer-text">Developed by <span style="color:#E21836!important">Malek Ben Amor</span></p><div class="footer-links"><a href="https://www.instagram.com/malekbenamor.dev/" target="_blank" class="footer-link">Instagram</a><span style="color:#999">•</span><a href="https://malekbenamor.dev/" target="_blank" class="footer-link">Website</a></div></div></div></body></html>`;
      await transport.sendMail({
        from: '"Andiamo Events" <contact@andiamoevents.com>',
        replyTo: '"Andiamo Events" <contact@andiamoevents.com>',
        to: order.user_email,
        subject: 'Order Received – Pending Approval – Andiamo Events',
        html
      });
    } catch (emE) { console.warn('POS order email failed:', emE); }
  }

  res.setHeader('Content-Type', 'application/json');
  return res.status(201).json({ success: true, order: { ...order, order_passes: orderPassesData } });
}

// --- Main handler ---

export default async (req, res) => {
  // Handle CORS (including preflight)
  const corsResult = await setCORSHeaders(res, req);
  if (corsResult === false) {
    return; // CORS error already handled
  }

  const parsed = parsePosPath(req.url);
  if (!parsed) return res.status(404).json({ error: 'Not found' });

  const { outletSlug, action, actionId } = parsed;
  let supabase;
  try {
    supabase = await getSupabase();
  } catch (e) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // POST /api/pos/:outletSlug/login
  if (action === 'login' && req.method === 'POST') return handleLogin(req, res, supabase, outletSlug);
  // POST /api/pos/:outletSlug/logout
  if (action === 'logout' && req.method === 'POST') return handleLogout(req, res, supabase, outletSlug);
  // GET /api/pos/:outletSlug/verify
  if (action === 'verify' && req.method === 'GET') return handleVerify(req, res, supabase, outletSlug);
  // GET /api/pos/:outletSlug/events
  if (action === 'events' && req.method === 'GET') return handleEvents(req, res, supabase, outletSlug);
  // GET /api/pos/:outletSlug/passes/:eventId
  if (action === 'passes' && req.method === 'GET' && actionId) return handlePasses(req, res, supabase, outletSlug, actionId);
  // POST /api/pos/:outletSlug/orders/create
  if (action === 'orders' && actionId === 'create' && req.method === 'POST') return handleOrdersCreate(req, res, supabase, outletSlug);

  return res.status(404).json({ error: 'Not found' });
};
