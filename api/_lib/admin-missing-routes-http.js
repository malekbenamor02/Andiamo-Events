/**
 * Vercel misc.js handlers ported from server.cjs (missing from production before 2026-06-28).
 */
import { gateAdminPermission } from './admin-permission-gate-http.js';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const requireFromRoot = createRequire(import.meta.url);
const { releaseOrderStock } = requireFromRoot(path.join(__dirname, 'release-order-stock.cjs'));

const PAYMENT_OPTION_TYPES = new Set(['online', 'external_app', 'ambassador_cash']);

/**
 * @returns {Promise<boolean>} true if request was handled
 */
export async function handleAdminMissingRoutes(req, res, routePath, method, { parseBody, createAdminDbClient }) {
  if (method === 'POST' && routePath === '/api/admin/cancel-order') {
    await handleAdminCancelOrder(req, res, { parseBody, createAdminDbClient });
    return true;
  }
  if (method === 'POST' && routePath === '/api/admin/reject-order') {
    await handleAdminRejectOrder(req, res, { parseBody, createAdminDbClient });
    return true;
  }
  if (method === 'GET' && routePath === '/api/admin/payment-options') {
    await handleAdminPaymentOptionsGet(req, res, { createAdminDbClient });
    return true;
  }
  if (method === 'PUT' && routePath.startsWith('/api/admin/payment-options/')) {
    const type = routePath.slice('/api/admin/payment-options/'.length);
    await handleAdminPaymentOptionsPut(req, res, type, { parseBody, createAdminDbClient });
    return true;
  }
  if (method === 'GET' && routePath === '/api/admin/ambassador-sales/overview') {
    await handleAmbassadorSalesOverview(req, res, { createAdminDbClient });
    return true;
  }
  if (method === 'GET' && routePath === '/api/admin/ambassador-sales/logs') {
    await handleAmbassadorSalesLogs(req, res, { createAdminDbClient });
    return true;
  }
  return false;
}

async function handleAdminCancelOrder(req, res, { parseBody, createAdminDbClient }) {
  try {
    const authResult = await gateAdminPermission(req, res, 'orders:manage');
    if (!authResult) return;

    const bodyData = await parseBody(req);
    const { orderId, reason } = bodyData;
    const adminId = authResult.admin?.id;

    if (!orderId || !reason) {
      res.status(400).json({
        error: 'Missing required fields',
        details: 'orderId and reason are required',
      });
      return;
    }

    const dbClient = await createAdminDbClient(res);
    if (!dbClient) return;

    const { data: order, error: orderError } = await dbClient
      .from('orders')
      .select('id, status, payment_status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const cancelStatus =
      order.status === 'PAID' || order.payment_status === 'PAID'
        ? 'REFUNDED'
        : 'CANCELLED_BY_AMBASSADOR';

    const updateData = {
      status: cancelStatus,
      payment_status: cancelStatus === 'REFUNDED' ? 'REFUNDED' : order.payment_status,
      cancelled_by: 'admin',
      cancellation_reason: String(reason).trim(),
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await dbClient.from('orders').update(updateData).eq('id', orderId);
    if (updateError) {
      res.status(500).json({ error: 'Failed to cancel order', details: updateError.message });
      return;
    }

    try {
      await releaseOrderStock(dbClient, orderId, `Cancelled/Refunded by admin: ${String(reason).trim()}`);
    } catch (stockError) {
      console.error('Error releasing stock on admin cancel:', stockError);
    }

    try {
      await dbClient.from('order_logs').insert({
        order_id: orderId,
        action: cancelStatus === 'REFUNDED' ? 'admin_refunded' : 'cancelled',
        performed_by: adminId,
        performed_by_type: 'admin',
        details: {
          reason: String(reason).trim(),
          cancelled_by: 'admin',
          previous_status: order.status,
          new_status: cancelStatus,
        },
      });
    } catch (logError) {
      console.warn('Failed to log cancellation (non-fatal):', logError);
    }

    res.status(200).json({
      success: true,
      message: `Order ${cancelStatus === 'REFUNDED' ? 'refunded' : 'cancelled'} successfully`,
      newStatus: cancelStatus,
    });
  } catch (error) {
    console.error('Error in /api/admin/cancel-order:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleAdminRejectOrder(req, res, { parseBody, createAdminDbClient }) {
  try {
    const authResult = await gateAdminPermission(req, res, 'orders:manage');
    if (!authResult) return;

    const bodyData = await parseBody(req);
    const { orderId, reason } = bodyData;
    const adminId = authResult.admin?.id;

    if (!orderId) {
      res.status(400).json({ error: 'Order ID is required' });
      return;
    }

    const dbClient = await createAdminDbClient(res);
    if (!dbClient) return;

    const { data: order, error: orderError } = await dbClient
      .from('orders')
      .select('id, status, payment_method')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    if (order.status !== 'PENDING_ADMIN_APPROVAL' && order.status !== 'PENDING_CASH') {
      res.status(400).json({
        error: 'Order cannot be rejected',
        details: `Order status must be PENDING_ADMIN_APPROVAL or PENDING_CASH, current: ${order.status}`,
      });
      return;
    }

    const rejectedByNameSnapshot =
      (authResult.admin?.name && String(authResult.admin.name).trim()) ||
      (authResult.admin?.email && String(authResult.admin.email).trim()) ||
      null;

    const updateData = {
      status: 'REJECTED',
      rejected_at: new Date().toISOString(),
      rejection_reason: reason || null,
      rejected_by: adminId || null,
      rejected_by_name: rejectedByNameSnapshot,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await dbClient.from('orders').update(updateData).eq('id', orderId);
    if (updateError) {
      res.status(500).json({ error: 'Failed to reject order', details: updateError.message });
      return;
    }

    try {
      await releaseOrderStock(dbClient, orderId, `Rejected by admin: ${reason || 'No reason provided'}`);
    } catch (stockError) {
      console.error('Error releasing stock on admin reject:', stockError);
    }

    try {
      await dbClient.from('order_logs').insert({
        order_id: orderId,
        action: 'rejected',
        performed_by: adminId,
        performed_by_type: 'admin',
        details: {
          old_status: order.status,
          new_status: 'REJECTED',
          rejection_reason: reason || null,
          rejected_by_name: rejectedByNameSnapshot,
          rejected_by_id: adminId || null,
          admin_action: true,
        },
      });
    } catch (logError) {
      console.warn('Failed to log rejection (non-fatal):', logError);
    }

    res.status(200).json({ success: true, message: 'Order rejected successfully' });
  } catch (error) {
    console.error('Error in /api/admin/reject-order:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleAdminPaymentOptionsGet(req, res, { createAdminDbClient }) {
  try {
    const authResult = await gateAdminPermission(req, res, 'settings:manage');
    if (!authResult) return;

    const dbClient = await createAdminDbClient(res);
    if (!dbClient) return;

    const { data, error } = await dbClient.from('payment_options').select('*').order('option_type');
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Error in admin payment-options GET:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch payment options' });
  }
}

async function handleAdminPaymentOptionsPut(req, res, type, { parseBody, createAdminDbClient }) {
  try {
    const authResult = await gateAdminPermission(req, res, 'settings:manage');
    if (!authResult) return;

    if (!PAYMENT_OPTION_TYPES.has(type)) {
      res.status(400).json({ error: 'Invalid payment option type' });
      return;
    }

    const bodyData = await parseBody(req);
    const { enabled, app_name, external_link, app_image } = bodyData;

    const dbClient = await createAdminDbClient(res);
    if (!dbClient) return;

    const updateData = { updated_at: new Date().toISOString() };
    if (enabled !== undefined) updateData.enabled = enabled;
    if (type === 'external_app') {
      if (app_name !== undefined) updateData.app_name = app_name;
      if (external_link !== undefined) updateData.external_link = external_link;
      if (app_image !== undefined) updateData.app_image = app_image;
    }

    const { data, error } = await dbClient
      .from('payment_options')
      .update(updateData)
      .eq('option_type', type)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in admin payment-options PUT:', error);
    res.status(500).json({ error: error.message || 'Failed to update payment option' });
  }
}

async function handleAmbassadorSalesOverview(req, res, { createAdminDbClient }) {
  try {
    const authResult = await gateAdminPermission(req, res, 'ambassador_sales:manage');
    if (!authResult) return;

    const dbClient = await createAdminDbClient(res);
    if (!dbClient) return;

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data: allOrders, error: ordersError } = await dbClient
      .from('orders')
      .select('id, total_price, ambassador_id, created_at, status, ambassadors!inner(full_name)')
      .eq('payment_method', 'ambassador_cash')
      .neq('status', 'REMOVED_BY_ADMIN');

    if (ordersError) {
      res.status(500).json({ error: ordersError.message });
      return;
    }

    const orders = allOrders || [];
    const thisWeekOrders = orders.filter((o) => new Date(o.created_at) >= startOfWeek);
    const thisMonthOrders = orders.filter((o) => new Date(o.created_at) >= startOfMonth);

    const totalOrders = {
      allTime: orders.length,
      thisMonth: thisMonthOrders.length,
      thisWeek: thisWeekOrders.length,
    };

    const totalRevenue = {
      allTime: orders.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0),
      thisMonth: thisMonthOrders.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0),
      thisWeek: thisWeekOrders.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0),
    };

    const calculateCommission = (revenue) => revenue * 0.1;
    const totalCommissions = {
      allTime: calculateCommission(totalRevenue.allTime),
      thisMonth: calculateCommission(totalRevenue.thisMonth),
      thisWeek: calculateCommission(totalRevenue.thisWeek),
    };

    const averageOrderValue = totalOrders.allTime > 0 ? totalRevenue.allTime / totalOrders.allTime : 0;
    const uniqueAmbassadors = new Set(orders.map((o) => o.ambassador_id).filter(Boolean));
    const averageOrdersPerAmbassador =
      uniqueAmbassadors.size > 0 ? totalOrders.allTime / uniqueAmbassadors.size : 0;

    const ambassadorStats = new Map();
    orders.forEach((order) => {
      if (!order.ambassador_id) return;
      const existing = ambassadorStats.get(order.ambassador_id) || {
        ambassador_id: order.ambassador_id,
        ambassador_name: order.ambassadors?.full_name || 'Unknown',
        total_orders: 0,
        total_revenue: 0,
      };
      existing.total_orders += 1;
      existing.total_revenue += parseFloat(order.total_price) || 0;
      ambassadorStats.set(order.ambassador_id, existing);
    });

    const topPerformers = Array.from(ambassadorStats.values())
      .map((stat) => ({
        ...stat,
        total_commissions: calculateCommission(stat.total_revenue),
      }))
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 10);

    res.json({
      success: true,
      data: {
        totalOrders,
        totalRevenue,
        totalCommissions,
        averageOrderValue,
        averageOrdersPerAmbassador,
        topPerformers,
      },
    });
  } catch (error) {
    console.error('Error in ambassador-sales/overview:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch sales overview' });
  }
}

async function handleAmbassadorSalesLogs(req, res, { createAdminDbClient }) {
  try {
    const authResult = await gateAdminPermission(req, res, 'reports:view');
    if (!authResult) return;

    const dbClient = await createAdminDbClient(res);
    if (!dbClient) return;

    const queryString = req.url && req.url.includes('?') ? req.url.split('?')[1] : '';
    const params = new URLSearchParams(queryString);
    const date_from = params.get('date_from');
    const date_to = params.get('date_to');
    const action = params.get('action');
    const ambassador_id = params.get('ambassador_id');
    const order_id = params.get('order_id');
    const limit = params.get('limit') || '100';
    const offset = params.get('offset') || '0';

    let query = dbClient
      .from('order_logs')
      .select('*, orders!inner(payment_method)', { count: 'exact' })
      .eq('orders.payment_method', 'ambassador_cash')
      .order('created_at', { ascending: false })
      .range(parseInt(offset, 10), parseInt(offset, 10) + parseInt(limit, 10) - 1);

    if (date_from) query = query.gte('created_at', date_from);
    if (date_to) query = query.lte('created_at', date_to);
    if (action) query = query.eq('action', action);
    if (ambassador_id) query = query.eq('performed_by', ambassador_id);
    if (order_id) query = query.eq('order_id', order_id);

    const { data, error, count } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true, data: data || [], count: count || 0 });
  } catch (error) {
    console.error('Error in ambassador-sales/logs:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch order logs' });
  }
}
