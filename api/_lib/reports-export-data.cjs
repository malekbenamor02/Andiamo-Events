'use strict';

const {
  isPaidOnlineOrder,
  isPaidAmbassadorCashOrder,
  isPaidOnlineOrAmbassadorOrder,
  isPaidPosOrder,
} = require('./reports-order-helpers.cjs');

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
  events ( id, name, date )
`;

const ORDERS_BY_ID_CHUNK = 120;

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

async function fetchPaidOrdersForExport(db, eventId, dateRange) {
  const { startDate, endDate } = parseDateRange(String(dateRange || 'ALL_TIME'));

  let paidQuery = db
    .from('orders')
    .select(EXPORT_ORDER_SELECT)
    .in('status', ['PAID', 'COMPLETED'])
    .in('payment_method', ['online', 'ambassador_cash'])
    .order('created_at', { ascending: false })
    .limit(15000);

  let posQuery = db
    .from('orders')
    .select(EXPORT_ORDER_SELECT)
    .eq('source', 'point_de_vente')
    .in('status', ['PAID', 'COMPLETED'])
    .order('created_at', { ascending: false })
    .limit(15000);

  if (eventId) {
    paidQuery = paidQuery.eq('event_id', eventId);
    posQuery = posQuery.eq('event_id', eventId);
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
  if (paidRes.error) throw new Error(paidRes.error.message);
  if (posRes.error) throw new Error(posRes.error.message);

  const rows = [...(paidRes.data || []), ...(posRes.data || [])];
  const onlineAndAmb = rows.filter(isPaidOnlineOrAmbassadorOrder);
  const posRows = rows.filter(isPaidPosOrder);
  return [...onlineAndAmb, ...posRows];
}

async function fetchAmbassadorRoster(db) {
  const { data, error } = await db
    .from('ambassadors')
    .select('id, full_name, phone')
    .order('full_name', { ascending: true })
    .limit(5000);
  if (error) throw new Error(error.message);
  return (data || []).map((a) => ({
    id: a.id,
    full_name: a.full_name ?? '—',
    phone: a.phone ?? '—',
  }));
}

async function fetchEventPassNames(db, eventId) {
  const { data, error } = await db
    .from('event_passes')
    .select('name')
    .eq('event_id', eventId)
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((p) => p.name).filter(Boolean);
}

async function fetchPassStockBreakdownForEvent(db, eventId) {
  const { data: passes, error: passErr } = await db
    .from('event_passes')
    .select('id, name')
    .eq('event_id', eventId)
    .order('name', { ascending: true });
  if (passErr) throw new Error(passErr.message);
  const list = passes || [];
  const passIds = list.map((p) => p.id).filter(Boolean);
  if (passIds.length === 0) return [];

  const { data: orderPassesRows, error: opErr } = await db
    .from('order_passes')
    .select('order_id, pass_id, quantity')
    .in('pass_id', passIds);
  if (opErr) throw new Error(opErr.message);

  const orderIds = [
    ...new Set(
      (orderPassesRows || [])
        .map((op) => op.order_id)
        .filter((id) => typeof id === 'string' && id.length > 0)
    ),
  ];

  const breakdown = {};
  for (const p of list) {
    breakdown[p.id] = { online: 0, ambassador: 0, other: 0 };
  }

  if (orderIds.length > 0) {
    const ordersRows = [];
    for (let i = 0; i < orderIds.length; i += ORDERS_BY_ID_CHUNK) {
      const chunk = orderIds.slice(i, i + ORDERS_BY_ID_CHUNK);
      const { data, error } = await db
        .from('orders')
        .select('id, payment_method, status, payment_status, event_id, source')
        .in('id', chunk);
      if (error) throw new Error(error.message);
      if (data?.length) ordersRows.push(...data);
    }

    const orderById = new Map(ordersRows.map((o) => [o.id, o]));
    for (const op of orderPassesRows || []) {
      const oid = op.order_id;
      if (!oid) continue;
      const o = orderById.get(oid);
      if (!o) continue;
      if (!(o.event_id === eventId || o.event_id == null)) continue;
      if (!isPaidOnlineOrder(o) && !isPaidAmbassadorCashOrder(o) && !isPaidPosOrder(o)) continue;
      const pid = op.pass_id;
      if (!breakdown[pid]) continue;
      const q = Number(op.quantity) || 0;
      if (isPaidOnlineOrder(o)) breakdown[pid].online += q;
      else if (isPaidAmbassadorCashOrder(o)) breakdown[pid].ambassador += q;
      else if (isPaidPosOrder(o)) breakdown[pid].other += q;
    }
  }

  return list.map((p) => {
    const b = breakdown[p.id] || { online: 0, ambassador: 0, other: 0 };
    return {
      name: p.name,
      online: b.online,
      ambassador: b.ambassador,
      other: b.other,
      total: b.online + b.ambassador + b.other,
    };
  });
}

async function loadReportsExportPayload(db, { eventId, dateRange }) {
  const orders = await fetchPaidOrdersForExport(db, eventId || null, dateRange);
  const ambassadorRoster = await fetchAmbassadorRoster(db);
  let eventPassNames;
  let passStockRows = null;
  if (eventId) {
    eventPassNames = await fetchEventPassNames(db, eventId);
    passStockRows = await fetchPassStockBreakdownForEvent(db, eventId);
  }
  return { orders, ambassadorRoster, eventPassNames, passStockRows };
}

module.exports = {
  loadReportsExportPayload,
  parseDateRange,
  fetchPaidOrdersForExport,
};
