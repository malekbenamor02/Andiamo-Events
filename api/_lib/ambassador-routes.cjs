'use strict';

const {
  appendSetCookie,
  clearAmbassadorAuth,
  createAmbassadorDbClient,
  createAmbassadorSession,
  pickSafeAmbassador,
  requireAmbassadorAuth,
  revokeAmbassadorSession,
  revokeAllAmbassadorSessions,
} = require('./ambassador-auth.cjs');

function normalizePhone(phoneNum) {
  if (!phoneNum) return '';
  let cleaned = String(phoneNum).replace(/[\s\-()]/g, '').trim();
  if (cleaned.startsWith('+216')) cleaned = cleaned.substring(4);
  else if (cleaned.startsWith('216')) cleaned = cleaned.substring(3);
  else if (cleaned.startsWith('00216')) cleaned = cleaned.substring(5);
  cleaned = cleaned.replace(/^0+/, '');
  return cleaned;
}

function getAmbassadorDb() {
  const db = createAmbassadorDbClient();
  if (!db) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for ambassador sessions');
  }
  return db;
}

function parseQuery(req) {
  const queryString = req.url && req.url.includes('?') ? req.url.split('?')[1] : '';
  return new URLSearchParams(queryString);
}

async function verifyRecaptcha(recaptchaToken) {
  if (!recaptchaToken || recaptchaToken === 'localhost-bypass-token') return true;
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return true;
  const verifyResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${secret}&response=${recaptchaToken}`,
  });
  const verifyData = await verifyResponse.json();
  return !!verifyData.success;
}

async function findAmbassadorByPhone(db, phone) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return null;

  const { data: byNormalized } = await db
    .from('ambassadors')
    .select('*')
    .eq('phone', normalizedPhone)
    .maybeSingle();
  if (byNormalized) return byNormalized;

  const { data: byExact } = await db
    .from('ambassadors')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();
  if (byExact) return byExact;

  const { data: allAmbassadors, error } = await db.from('ambassadors').select('*');
  if (error || !allAmbassadors) return null;
  return (
    allAmbassadors.find((amb) => normalizePhone(amb.phone || '') === normalizedPhone) || null
  );
}

async function handleAmbassadorLogin(req, res, deps) {
  const { parseBody, getClientIp, checkAmbassadorLoginRateLimit } = deps;
  try {
    const ip = getClientIp(req);
    if (checkAmbassadorLoginRateLimit && !checkAmbassadorLoginRateLimit(ip)) {
      return res.status(429).json({ error: 'Too many login attempts, please try again later.' });
    }

    const bodyData = await parseBody(req);
    const { phone, password, recaptchaToken } = bodyData || {};

    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone number and password are required' });
    }

    if (!process.env.SUPABASE_URL) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const recaptchaOk = await verifyRecaptcha(recaptchaToken);
    if (!recaptchaOk) {
      return res.status(400).json({ error: 'reCAPTCHA verification failed' });
    }

    const db = getAmbassadorDb();
    const normalizedPhone = normalizePhone(phone);
    if (!/^[2459]\d{7}$/.test(normalizedPhone)) {
      return res.status(400).json({
        error: 'Invalid phone number format',
        details: 'Phone number must be 8 digits starting with 2, 4, 5, or 9',
      });
    }

    const { data: directMatch, error: lookupError } = await db
      .from('ambassadors')
      .select('*')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (lookupError && lookupError.code !== 'PGRST116') {
      return res.status(500).json({ error: 'Database error' });
    }

    const ambassador = directMatch || (await findAmbassadorByPhone(db, phone));

    if (!ambassador) {
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    const bcrypt = await import('bcryptjs');
    const isPasswordValid = await bcrypt.default.compare(password, ambassador.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    if (ambassador.status === 'pending') {
      return res.status(403).json({ error: 'Your application is under review' });
    }
    if (ambassador.status === 'rejected') {
      return res.status(403).json({ error: 'Your application was not approved' });
    }
    if (ambassador.status === 'suspended') {
      return res.status(403).json({ error: 'Your account is suspended' });
    }
    if (ambassador.status !== 'approved') {
      return res.status(403).json({ error: 'Account not active' });
    }

    const session = await createAmbassadorSession(db, ambassador.id, req);
    appendSetCookie(res, session.cookieHeader);

    return res.status(200).json({
      success: true,
      ambassador: pickSafeAmbassador(ambassador),
    });
  } catch (error) {
    console.error('Ambassador login error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
}

async function handleAmbassadorMe(req, res) {
  try {
    const db = getAmbassadorDb();
    const auth = await requireAmbassadorAuth(req, res, db);
    if (!auth) return null;
    return res.status(200).json({
      success: true,
      valid: true,
      ambassador: pickSafeAmbassador(auth.ambassador),
    });
  } catch (error) {
    console.error('Ambassador me error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleAmbassadorLogout(req, res) {
  try {
    const db = getAmbassadorDb();
    const auth = await requireAmbassadorAuth(req, res, db);
    if (auth) {
      await revokeAmbassadorSession(db, auth.sessionId, 'logout');
    }
    clearAmbassadorAuth(res, req);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Ambassador logout error:', error);
    clearAmbassadorAuth(res, req);
    return res.status(200).json({ success: true });
  }
}

async function handleAmbassadorOrders(req, res) {
  try {
    const db = getAmbassadorDb();
    const auth = await requireAmbassadorAuth(req, res, db);
    if (!auth) return null;

    const searchParams = parseQuery(req);
    const clientAmbassadorId = searchParams.get('ambassadorId');
    if (clientAmbassadorId && clientAmbassadorId !== auth.ambassador.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const eventIdRaw = searchParams.get('event_id');
    const eventId = eventIdRaw && String(eventIdRaw).trim() !== '' ? String(eventIdRaw).trim() : null;
    const ambassadorId = auth.ambassador.id;

    let query = db
      .from('orders')
      .select('*, order_passes (*)')
      .eq('ambassador_id', ambassadorId)
      .neq('status', 'REMOVED_BY_ADMIN')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      if (status === 'REMOVED_BY_ADMIN') {
        query = db
          .from('orders')
          .select('*, order_passes (*)')
          .eq('ambassador_id', ambassadorId)
          .eq('status', 'REMOVED_BY_ADMIN')
          .order('created_at', { ascending: false })
          .limit(limit);
      } else {
        query = query.eq('status', status);
      }
    }

    if (eventId) {
      query = query.eq('event_id', eventId);
    }

    try {
      await db.rpc('auto_reject_expired_pending_cash_orders');
    } catch (rejectError) {
      console.warn('Warning: Failed to auto-reject expired orders:', rejectError);
    }

    const { data: orders, error: ordersError } = await query;
    if (ordersError) {
      return res.status(500).json({ error: 'Failed to fetch orders', details: ordersError.message });
    }

    return res.status(200).json({
      success: true,
      data: orders || [],
      count: orders?.length || 0,
    });
  } catch (error) {
    console.error('Error in /api/ambassador/orders:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleAmbassadorPerformance(req, res) {
  try {
    const db = getAmbassadorDb();
    const auth = await requireAmbassadorAuth(req, res, db);
    if (!auth) return null;

    const searchParams = parseQuery(req);
    const clientAmbassadorId = searchParams.get('ambassadorId');
    if (clientAmbassadorId && clientAmbassadorId !== auth.ambassador.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const perfEventIdRaw = searchParams.get('event_id');
    const perfEventId =
      perfEventIdRaw && String(perfEventIdRaw).trim() !== '' ? String(perfEventIdRaw).trim() : null;
    const ambassadorId = auth.ambassador.id;

    let perfQuery = db
      .from('orders')
      .select('*, order_passes (*)')
      .eq('ambassador_id', ambassadorId)
      .neq('status', 'REMOVED_BY_ADMIN');

    if (perfEventId) {
      perfQuery = perfQuery.eq('event_id', perfEventId);
    }

    const { data: allOrders, error: ordersError } = await perfQuery;
    if (ordersError) {
      return res.status(500).json({ error: 'Failed to fetch orders', details: ordersError.message });
    }

    const activeOrders = allOrders || [];
    const total = activeOrders.length;
    const paid = activeOrders.filter((o) => o.status === 'PAID').length;
    const cancelled = activeOrders.filter(
      (o) =>
        o.status === 'CANCELLED' ||
        o.status === 'CANCELLED_BY_AMBASSADOR' ||
        o.status === 'CANCELLED_BY_ADMIN'
    ).length;
    const rejected = activeOrders.filter((o) => o.status === 'REJECTED').length;
    const ignored = activeOrders.filter(
      (o) =>
        o.status === 'PENDING' &&
        o.assigned_at &&
        new Date(o.assigned_at).getTime() < Date.now() - 15 * 60 * 1000 &&
        !o.accepted_at
    ).length;

    const revenueOrders = activeOrders.filter((o) => o.status === 'PAID');
    let totalRevenue = 0;
    let totalPassesSold = 0;

    revenueOrders.forEach((order) => {
      if (order.order_passes && Array.isArray(order.order_passes)) {
        order.order_passes.forEach((pass) => {
          totalRevenue += parseFloat(pass.price || 0) * parseInt(pass.quantity || 0, 10);
          totalPassesSold += parseInt(pass.quantity || 0, 10);
        });
      } else {
        totalRevenue += parseFloat(order.total_price || 0);
        totalPassesSold += 1;
      }
    });

    const acceptedOrders = activeOrders.filter((o) => o.accepted_at && o.assigned_at);
    let averageResponseTime = 0;
    if (acceptedOrders.length > 0) {
      const totalResponseTime = acceptedOrders.reduce((sum, order) => {
        const assigned = new Date(order.assigned_at);
        const accepted = new Date(order.accepted_at);
        return sum + (accepted.getTime() - assigned.getTime());
      }, 0);
      averageResponseTime = totalResponseTime / acceptedOrders.length / 1000 / 60;
    }

    return res.status(200).json({
      success: true,
      data: {
        total,
        paid,
        cancelled,
        rejected,
        ignored,
        revenue: totalRevenue,
        passesSold: totalPassesSold,
        totalPassesSold,
        totalRevenue,
        averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Error in /api/ambassador/performance:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleAmbassadorUpdatePassword(req, res, deps) {
  const { parseBody } = deps;
  try {
    const db = getAmbassadorDb();
    const auth = await requireAmbassadorAuth(req, res, db);
    if (!auth) return null;

    const bodyData = await parseBody(req);
    const { newPassword } = bodyData || {};

    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.default.hash(newPassword, 10);

    const { error } = await db
      .from('ambassadors')
      .update({ password: hashedPassword, updated_at: new Date().toISOString() })
      .eq('id', auth.ambassador.id);

    if (error) {
      return res.status(500).json({ error: 'Failed to update password', details: error.message });
    }

    await revokeAllAmbassadorSessions(db, auth.ambassador.id, 'password_changed');
    clearAmbassadorAuth(res, req);

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully. Please log in again.',
      requiresLogin: true,
    });
  } catch (error) {
    console.error('Ambassador password update error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleAmbassadorCancelOrder(req, res, deps) {
  const { parseBody } = deps;
  try {
    const db = getAmbassadorDb();
    const auth = await requireAmbassadorAuth(req, res, db);
    if (!auth) return null;

    const bodyData = await parseBody(req);
    const { orderId, reason } = bodyData || {};

    if (!orderId || !reason || !String(reason).trim()) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'orderId and reason are required',
      });
    }

    const { data: order, error: orderError } = await db
      .from('orders')
      .select('id, ambassador_id, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.ambassador_id !== auth.ambassador.id) {
      return res.status(403).json({ error: 'Order does not belong to this ambassador' });
    }

    const blocked = ['CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN', 'COMPLETED', 'PAID'];
    if (blocked.includes(order.status)) {
      return res.status(400).json({
        error: 'Order cannot be cancelled',
        details: `Order status is ${order.status}`,
      });
    }

    const trimmedReason = String(reason).trim();
    const { error: updateError } = await db
      .from('orders')
      .update({
        status: 'CANCELLED',
        cancelled_by: 'ambassador',
        cancellation_reason: trimmedReason,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to cancel order', details: updateError.message });
    }

    try {
      await db.rpc('release_order_stock_internal', { order_id_param: orderId });
    } catch (stockError) {
      console.warn('Failed to release stock on ambassador cancel:', stockError);
    }

    try {
      await db.from('order_logs').insert({
        order_id: orderId,
        action: 'cancelled',
        performed_by: auth.ambassador.id,
        performed_by_type: 'ambassador',
        details: { reason: trimmedReason, cancelled_by: 'ambassador' },
      });
    } catch (logError) {
      console.warn('Failed to log cancellation (non-fatal):', logError);
    }

    return res.status(200).json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error in /api/ambassador/cancel-order:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleAmbassadorConfirmCash(req, res, deps) {
  const { parseBody } = deps;
  try {
    const db = getAmbassadorDb();
    const auth = await requireAmbassadorAuth(req, res, db);
    if (!auth) return null;

    const bodyData = await parseBody(req);
    const { orderId } = bodyData || {};

    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }

    const { data: order, error: orderError } = await db
      .from('orders')
      .select('id, ambassador_id, status, user_name, total_price')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.ambassador_id !== auth.ambassador.id) {
      return res.status(403).json({ error: 'Order does not belong to this ambassador' });
    }

    if (order.status !== 'PENDING_CASH') {
      return res.status(400).json({
        error: 'Order cannot be confirmed',
        details: `Order status is ${order.status}`,
      });
    }

    const { error: updateError } = await db
      .from('orders')
      .update({
        status: 'PENDING_ADMIN_APPROVAL',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to confirm cash payment', details: updateError.message });
    }

    try {
      await db.from('order_logs').insert({
        order_id: orderId,
        action: 'cash_confirmed',
        performed_by: auth.ambassador.id,
        performed_by_type: 'ambassador',
        details: { from_status: 'PENDING_CASH', to_status: 'PENDING_ADMIN_APPROVAL' },
      });
    } catch (logError) {
      console.warn('Failed to log cash confirmation (non-fatal):', logError);
    }

    return res.status(200).json({
      success: true,
      message: 'Cash payment confirmed',
      order: {
        id: order.id,
        user_name: order.user_name,
        total_price: order.total_price,
      },
    });
  } catch (error) {
    console.error('Error in /api/ambassador/confirm-cash:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

module.exports = {
  handleAmbassadorLogin,
  handleAmbassadorMe,
  handleAmbassadorLogout,
  handleAmbassadorOrders,
  handleAmbassadorPerformance,
  handleAmbassadorUpdatePassword,
  handleAmbassadorCancelOrder,
  handleAmbassadorConfirmCash,
  normalizePhone,
};
