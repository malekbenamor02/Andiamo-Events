'use strict';

const ONLINE_ORDERS_SELECT =
  'id, created_at, updated_at, event_id, source, user_name, user_phone, user_email, city, ville, ambassador_id, quantity, total_price, total_with_fees, status, payment_status, payment_method, payment_gateway_reference, payment_confirm_response, order_number, notes, admin_notes, cancelled_at, cancellation_reason, accepted_at, completed_at, assigned_at, presale_code_id, event_promo_code_id, event_promo_codes(badge_color), payment_status_set_by, payment_status_set_at, payment_status_set_by_name, order_passes(id, order_id, pass_type, quantity, price, created_at, updated_at)';

const ANALYTICS_ORDER_SELECT = `
  *,
  order_passes (*),
  ambassadors (
    id,
    full_name
  )
`;

function requireServiceDb(supabaseService, res) {
  if (!supabaseService) {
    res.status(503).json({
      error: 'Server configuration error',
      details: 'SUPABASE_SERVICE_ROLE_KEY is required for admin order APIs',
    });
    return null;
  }
  return supabaseService;
}

function parseDateRange(dateRange) {
  const now = new Date();
  if (dateRange === 'LAST_7_DAYS') {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { startDate: start, endDate: now };
  }
  if (dateRange === 'LAST_30_DAYS') {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return { startDate: start, endDate: now };
  }
  return { startDate: null, endDate: null };
}

/**
 * Admin order reads/writes — service role only (RLS-safe).
 */
function registerAdminOrdersRoutes(app, deps) {
  const {
    supabaseService,
    requireAdminAuth,
    requireAdminPermission,
    generateTicketsAndSendEmail,
  } = deps;

  // GET /api/admin/orders/online
  app.get(
    '/api/admin/orders/online',
    requireAdminAuth,
    requireAdminPermission('orders:manage'),
    async (req, res) => {
      try {
        const db = requireServiceDb(supabaseService, res);
        if (!db) return;

        const {
          event_id,
          payment_status,
          city,
          date_from,
          date_to,
          limit = '4000',
        } = req.query;

        const lim = Math.min(parseInt(limit, 10) || 4000, 4000);
        let query = db
          .from('orders')
          .select(ONLINE_ORDERS_SELECT)
          .eq('source', 'platform_online')
          .neq('status', 'REMOVED_BY_ADMIN')
          .order('created_at', { ascending: false })
          .limit(lim);

        if (event_id) query = query.eq('event_id', event_id);
        if (city) query = query.eq('city', city);
        if (date_from) query = query.gte('created_at', date_from);
        if (date_to) query = query.lte('created_at', date_to);
        if (payment_status && payment_status !== 'all') {
          if (payment_status === 'PENDING_PAYMENT') {
            query = query.or('payment_status.eq.PENDING_PAYMENT,payment_status.is.null');
          } else {
            query = query.eq('payment_status', payment_status);
          }
        }

        const { data, error } = await query;
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, data: data || [] });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
  );

  // GET /api/admin/orders/chart — last 7 days online orders for overview chart
  app.get(
    '/api/admin/orders/chart',
    requireAdminAuth,
    requireAdminPermission('orders:manage'),
    async (req, res) => {
      try {
        const db = requireServiceDb(supabaseService, res);
        if (!db) return;

        const { event_id } = req.query;
        if (!event_id) {
          return res.status(400).json({ error: 'event_id is required' });
        }

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data, error } = await db
          .from('orders')
          .select(
            'id, created_at, total_price, total_with_fees, status, payment_status, payment_method, notes, order_passes (quantity, price)'
          )
          .eq('source', 'platform_online')
          .gte('created_at', sevenDaysAgo.toISOString())
          .eq('event_id', event_id);

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, data: data || [] });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
  );

  // GET /api/admin/orders/pos-overview — super-admin overview KPIs
  app.get(
    '/api/admin/orders/pos-overview',
    requireAdminAuth,
    requireAdminPermission('reports:view'),
    async (req, res) => {
      try {
        const db = requireServiceDb(supabaseService, res);
        if (!db) return;

        const { event_id } = req.query;
        if (!event_id) {
          return res.status(400).json({ error: 'event_id is required' });
        }

        const { data, error } = await db
          .from('orders')
          .select('*, order_passes (*)')
          .eq('source', 'point_de_vente')
          .neq('status', 'REMOVED_BY_ADMIN')
          .eq('event_id', event_id)
          .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, data: data || [] });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
  );

  // GET /api/admin/analytics/orders — raw rows for Reports analytics (client-side aggregation unchanged)
  app.get(
    '/api/admin/analytics/orders',
    requireAdminAuth,
    requireAdminPermission('reports:view'),
    async (req, res) => {
      try {
        const db = requireServiceDb(supabaseService, res);
        if (!db) return;

        const { event_id, date_range, start_date, end_date } = req.query;
        let startDate = null;
        let endDate = null;
        if (start_date && end_date) {
          startDate = new Date(String(start_date));
          endDate = new Date(String(end_date));
        } else {
          const parsed = parseDateRange(String(date_range || 'ALL_TIME'));
          startDate = parsed.startDate;
          endDate = parsed.endDate;
        }

        let paidQuery = db
          .from('orders')
          .select(ANALYTICS_ORDER_SELECT, { count: 'exact' })
          .in('status', ['PAID', 'COMPLETED'])
          .in('payment_method', ['online', 'ambassador_cash'])
          .order('created_at', { ascending: false })
          .limit(10000);

        let posQuery = db
          .from('orders')
          .select(ANALYTICS_ORDER_SELECT, { count: 'exact' })
          .eq('source', 'point_de_vente')
          .in('status', ['PAID', 'COMPLETED'])
          .order('created_at', { ascending: false })
          .limit(10000);

        let pendingQuery = db
          .from('orders')
          .select('*, order_passes (*)')
          .in('status', ['PENDING_CASH', 'PENDING_ADMIN_APPROVAL']);

        if (event_id) {
          paidQuery = paidQuery.eq('event_id', event_id);
          posQuery = posQuery.eq('event_id', event_id);
          pendingQuery = pendingQuery.eq('event_id', event_id);
        }
        if (startDate) {
          const iso = startDate.toISOString();
          paidQuery = paidQuery.gte('created_at', iso);
          posQuery = posQuery.gte('created_at', iso);
          pendingQuery = pendingQuery.gte('created_at', iso);
        }
        if (endDate) {
          const iso = endDate.toISOString();
          paidQuery = paidQuery.lte('created_at', iso);
          posQuery = posQuery.lte('created_at', iso);
          pendingQuery = pendingQuery.lte('created_at', iso);
        }

        const [paidRes, posRes, pendingRes] = await Promise.all([
          paidQuery,
          posQuery,
          pendingQuery,
        ]);

        if (paidRes.error) return res.status(500).json({ error: paidRes.error.message });
        if (posRes.error) return res.status(500).json({ error: posRes.error.message });
        if (pendingRes.error) return res.status(500).json({ error: pendingRes.error.message });

        let allOrdersQuery = db
          .from('orders')
          .select('id, ambassador_id, status, created_at');

        if (event_id) allOrdersQuery = allOrdersQuery.eq('event_id', event_id);
        if (startDate) allOrdersQuery = allOrdersQuery.gte('created_at', startDate.toISOString());
        if (endDate) allOrdersQuery = allOrdersQuery.lte('created_at', endDate.toISOString());

        const allOrdersRes = await allOrdersQuery;

        if (allOrdersRes.error) {
          return res.status(500).json({ error: allOrdersRes.error.message });
        }

        return res.json({
          success: true,
          paidOrders: paidRes.data || [],
          posOrders: posRes.data || [],
          pendingOrders: pendingRes.data || [],
          allOrders: allOrdersRes.data || [],
        });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
  );

  const EXPORT_ORDER_SELECT = `
    id,
    created_at,
    updated_at,
    event_id,
    source,
    user_name,
    user_phone,
    user_email,
    city,
    ville,
    ambassador_id,
    quantity,
    total_price,
    total_with_fees,
    status,
    payment_status,
    payment_method,
    order_number,
    admin_notes,
    completed_at,
    order_passes ( id, order_id, pass_id, pass_type, quantity, price ),
    ambassadors ( id, full_name, phone ),
    events ( id, name, date, venue, city )
  `;

  // GET /api/admin/analytics/export-orders — legacy JSON order dump (prefer /api/admin/reports/export)
  app.get(
    '/api/admin/analytics/export-orders',
    requireAdminAuth,
    requireAdminPermission('reports:view'),
    async (req, res) => {
      try {
        const db = requireServiceDb(supabaseService, res);
        if (!db) return;

        const { event_id, date_range } = req.query;
        const { startDate, endDate } = parseDateRange(String(date_range || 'ALL_TIME'));

        let paidQuery = db
          .from('orders')
          .select(EXPORT_ORDER_SELECT, { count: 'exact' })
          .in('status', ['PAID', 'COMPLETED'])
          .in('payment_method', ['online', 'ambassador_cash'])
          .order('created_at', { ascending: false })
          .limit(15000);

        let posQuery = db
          .from('orders')
          .select(EXPORT_ORDER_SELECT, { count: 'exact' })
          .eq('source', 'point_de_vente')
          .in('status', ['PAID', 'COMPLETED'])
          .order('created_at', { ascending: false })
          .limit(15000);

        if (event_id) {
          paidQuery = paidQuery.eq('event_id', event_id);
          posQuery = posQuery.eq('event_id', event_id);
        }
        if (startDate) {
          const iso = startDate.toISOString();
          paidQuery = paidQuery.gte('created_at', iso);
          posQuery = posQuery.gte('created_at', iso);
        }
        if (endDate) {
          const iso = endDate.toISOString();
          paidQuery = paidQuery.lte('created_at', iso);
          posQuery = posQuery.lte('created_at', iso);
        }

        const [paidRes, posRes] = await Promise.all([paidQuery, posQuery]);
        if (paidRes.error) return res.status(500).json({ error: paidRes.error.message });
        if (posRes.error) return res.status(500).json({ error: posRes.error.message });

        return res.json({
          success: true,
          data: [...(paidRes.data || []), ...(posRes.data || [])],
        });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
  );

  // POST /api/admin/analytics/order-summaries — lightweight order rows by id (presale breakdown)
  app.post(
    '/api/admin/analytics/order-summaries',
    requireAdminAuth,
    requireAdminPermission('reports:view'),
    async (req, res) => {
      try {
        const db = requireServiceDb(supabaseService, res);
        if (!db) return;

        const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(Boolean) : [];
        if (ids.length === 0) return res.json({ success: true, data: [] });

        const chunkSize = 200;
        const rows = [];
        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize);
          const { data, error } = await db
            .from('orders')
            .select('id, payment_method, status, payment_status, event_id, source')
            .in('id', chunk);
          if (error) return res.status(500).json({ error: error.message });
          if (data?.length) rows.push(...data);
        }

        return res.json({ success: true, data: rows });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
  );

  // GET /api/admin/order-logs — recent order activity (ambassador sales tab)
  app.get(
    '/api/admin/order-logs',
    requireAdminAuth,
    requireAdminPermission('ambassador_sales:manage'),
    async (req, res) => {
      try {
        const db = requireServiceDb(supabaseService, res);
        if (!db) return;

        const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
        const { data, error } = await db
          .from('order_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, data: data || [] });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
  );

  // PATCH /api/admin/orders/:id/payment-status
  app.patch(
    '/api/admin/orders/:id/payment-status',
    requireAdminAuth,
    requireAdminPermission('orders:manage'),
    async (req, res) => {
      try {
        const db = requireServiceDb(supabaseService, res);
        if (!db) return;

        const { payment_status, old_payment_status } = req.body || {};
        const allowed = ['PENDING_PAYMENT', 'PAID', 'FAILED', 'REFUNDED', 'EXPIRED'];
        if (!payment_status || !allowed.includes(payment_status)) {
          return res.status(400).json({ error: 'Invalid payment_status' });
        }

        const admin = req.admin;
        const { error: updateError } = await db
          .from('orders')
          .update({
            payment_status,
            payment_status_set_by: admin?.id || null,
            payment_status_set_at: new Date().toISOString(),
            payment_status_set_by_name: (admin?.name && String(admin.name).trim()) || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', req.params.id);

        if (updateError) return res.status(500).json({ error: updateError.message });

        try {
          await db.from('order_logs').insert({
            order_id: req.params.id,
            action: 'payment_status_changed',
            performed_by: admin?.id || null,
            performed_by_type: 'admin',
            details: {
              old_payment_status: old_payment_status ?? null,
              new_payment_status: payment_status,
              action: `Marked as ${payment_status}`,
            },
          });
        } catch (logErr) {
          console.warn('order_logs insert failed (non-fatal):', logErr);
        }

        return res.json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
  );

  // PATCH /api/admin/orders/:id/complete
  app.patch(
    '/api/admin/orders/:id/complete',
    requireAdminAuth,
    requireAdminPermission('orders:manage'),
    async (req, res) => {
      try {
        const db = requireServiceDb(supabaseService, res);
        if (!db) return;

        const { data: order, error: fetchError } = await db
          .from('orders')
          .select('id, status, payment_method')
          .eq('id', req.params.id)
          .single();

        if (fetchError || !order) {
          return res.status(404).json({ error: 'Order not found' });
        }

        if (order.payment_method === 'ambassador_cash' && order.status !== 'APPROVED') {
          return res.status(400).json({
            error: 'COD orders must be approved before they can be completed',
          });
        }

        const oldStatus = order.status;
        const { error: updateError } = await db
          .from('orders')
          .update({
            status: 'COMPLETED',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', req.params.id);

        if (updateError) return res.status(500).json({ error: updateError.message });

        try {
          await db.from('order_logs').insert({
            order_id: req.params.id,
            action: 'completed',
            performed_by: req.admin?.id || null,
            performed_by_type: 'admin',
            details: { old_status: oldStatus, new_status: 'COMPLETED', admin_action: true },
          });
        } catch (logErr) {
          console.warn('order_logs insert failed (non-fatal):', logErr);
        }

        return res.json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
  );

  // POST /api/admin/orders/:id/approve-email-sms — PAID → APPROVED after ticket/email delivery
  app.post(
    '/api/admin/orders/:id/approve-email-sms',
    requireAdminAuth,
    requireAdminPermission('orders:manage'),
    async (req, res) => {
      try {
        const db = requireServiceDb(supabaseService, res);
        if (!db) return;

        const orderId = req.params.id;
        const { data: order, error: fetchError } = await db
          .from('orders')
          .select('id, status, user_email')
          .eq('id', orderId)
          .single();

        if (fetchError || !order) {
          return res.status(404).json({ error: 'Order not found' });
        }

        if (order.status !== 'PAID') {
          return res.status(400).json({
            error: 'Only PAID orders can have email/SMS delivery approved',
          });
        }

        if (order.user_email && typeof generateTicketsAndSendEmail === 'function') {
          try {
            await generateTicketsAndSendEmail(orderId);
          } catch (ticketErr) {
            console.error('approve-email-sms ticket generation failed:', ticketErr);
            return res.status(500).json({
              error: 'Failed to generate tickets or send email',
              details: ticketErr.message,
            });
          }
        }

        const { error: updateError } = await db
          .from('orders')
          .update({
            status: 'APPROVED',
            approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);

        if (updateError) return res.status(500).json({ error: updateError.message });

        try {
          await db.from('order_logs').insert({
            order_id: orderId,
            action: 'email_sms_delivery_approved',
            performed_by: req.admin?.id || null,
            performed_by_type: 'admin',
            details: { old_status: 'PAID', new_status: 'APPROVED', email_sent: true },
          });
        } catch (logErr) {
          console.warn('order_logs insert failed (non-fatal):', logErr);
        }

        return res.json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
  );
}

module.exports = { registerAdminOrdersRoutes, ONLINE_ORDERS_SELECT };
