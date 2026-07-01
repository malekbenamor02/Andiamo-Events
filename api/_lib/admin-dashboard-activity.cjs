'use strict';

/**
 * Overview Activity chart — server-side daily aggregates.
 *
 * Timezone policy: all day buckets use UTC (start/end of UTC calendar day).
 * Order/revenue bucket timestamp: completed_at when set, else payment_status_set_at
 * for paid online orders, else created_at.
 */

const {
  getOrderTicketsAndRevenue,
  getOrderReportRevenue,
} = require('./reports-order-helpers.cjs');

const UTC_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const COD_PAID_STATUSES = ['PAID', 'COMPLETED', 'MANUAL_COMPLETED'];
const COD_SOURCES = ['platform_cod', 'ambassador_manual'];
const POS_PAID_STATUSES = ['PAID', 'COMPLETED'];

const ORDER_SELECT =
  'id, created_at, completed_at, payment_status_set_at, total_price, total_with_fees, status, payment_status, payment_method, source, notes, quantity, total, order_passes (quantity, price)';

async function fetchAllPaginated(buildPageQuery, pageSize = 1000) {
  const all = [];
  let offset = 0;
  while (true) {
    const { data, error } = await buildPageQuery(offset, pageSize);
    if (error) throw error;
    const chunk = data || [];
    all.push(...chunk);
    if (chunk.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

/** Last N UTC calendar days including today. */
function buildUtcDayBuckets(dayCount) {
  const days = [];
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (let i = dayCount - 1; i >= 0; i--) {
    const ms = todayUtc - i * 86400000;
    const d = new Date(ms);
    const date = d.toISOString().slice(0, 10);
    days.push({
      date,
      name: UTC_DAY_NAMES[d.getUTCDay()],
      startIso: `${date}T00:00:00.000Z`,
      endIso: `${date}T23:59:59.999Z`,
    });
  }
  return days;
}

function isPaidOnlineActivityOrder(order) {
  if (order.source !== 'platform_online') return false;
  if (order.status === 'REMOVED_BY_ADMIN') return false;
  if (order.payment_status === 'REFUNDED' || order.status === 'REFUNDED') return false;
  return (
    order.payment_status === 'PAID' ||
    order.status === 'PAID' ||
    order.status === 'COMPLETED'
  );
}

function isPaidCodActivityOrder(order) {
  if (order.payment_method !== 'ambassador_cash') return false;
  if (!COD_SOURCES.includes(order.source)) return false;
  if (order.status === 'REMOVED_BY_ADMIN') return false;
  return COD_PAID_STATUSES.includes(order.status);
}

function isPaidPosActivityOrder(order) {
  if (order.source !== 'point_de_vente') return false;
  if (order.status === 'REMOVED_BY_ADMIN') return false;
  return POS_PAID_STATUSES.includes(order.status);
}

function isActivityOrder(order, { includePos = false } = {}) {
  return (
    isPaidOnlineActivityOrder(order) ||
    isPaidCodActivityOrder(order) ||
    (includePos && isPaidPosActivityOrder(order))
  );
}

/** Bucket date (YYYY-MM-DD UTC) for paid/collected activity orders. */
function getActivityBucketDateUtc(order) {
  if (order.completed_at) {
    return new Date(order.completed_at).toISOString().slice(0, 10);
  }
  if (
    order.payment_status === 'PAID' &&
    order.payment_status_set_at &&
    order.payment_method === 'online'
  ) {
    return new Date(order.payment_status_set_at).toISOString().slice(0, 10);
  }
  if (order.created_at) {
    return new Date(order.created_at).toISOString().slice(0, 10);
  }
  return null;
}

function activityOrderRevenue(order) {
  if (isPaidOnlineActivityOrder(order)) {
    return getOrderReportRevenue(order);
  }
  return getOrderTicketsAndRevenue(order).revenue;
}

/**
 * Pure aggregation for tests — merge order rows into day buckets.
 */
function aggregateActivityFromOrders(orders, dayBuckets, { includePos = false } = {}) {
  const byDate = new Map(dayBuckets.map((d) => [d.date, { ...d, applications: 0, orders: 0, revenue: 0 }]));
  const validDates = new Set(dayBuckets.map((d) => d.date));

  for (const order of orders) {
    if (!isActivityOrder(order, { includePos })) continue;
    const bucketDate = getActivityBucketDateUtc(order);
    if (!bucketDate || !validDates.has(bucketDate)) continue;
    const row = byDate.get(bucketDate);
    row.orders += 1;
    row.revenue += activityOrderRevenue(order);
  }

  return dayBuckets.map((d) => {
    const row = byDate.get(d.date);
    return {
      name: row.name,
      date: row.date,
      applications: row.applications,
      orders: row.orders,
      revenue: Math.round(row.revenue),
    };
  });
}

function applyApplicationCounts(buckets, countsByDate) {
  return buckets.map((row) => ({
    ...row,
    applications: countsByDate.get(row.date) ?? 0,
  }));
}

async function countApplicationsByDay(db, dayBuckets) {
  const counts = new Map();
  await Promise.all(
    dayBuckets.map(async (day) => {
      const { count, error } = await db
        .from('ambassador_applications')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', day.startIso)
        .lte('created_at', day.endIso);
      if (error) throw error;
      counts.set(day.date, count ?? 0);
    }),
  );
  return counts;
}

async function fetchActivityOrdersForEvent(db, eventId, includePos) {
  const onlineRows = await fetchAllPaginated((offset, pageSize) =>
    db
      .from('orders')
      .select(ORDER_SELECT)
      .eq('event_id', eventId)
      .eq('source', 'platform_online')
      .neq('status', 'REMOVED_BY_ADMIN')
      .or('payment_status.eq.PAID,status.eq.PAID,status.eq.COMPLETED')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1),
  );

  const codRows = await fetchAllPaginated((offset, pageSize) =>
    db
      .from('orders')
      .select(ORDER_SELECT)
      .eq('event_id', eventId)
      .eq('payment_method', 'ambassador_cash')
      .in('source', COD_SOURCES)
      .in('status', COD_PAID_STATUSES)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1),
  );

  let posRows = [];
  if (includePos) {
    posRows = await fetchAllPaginated((offset, pageSize) =>
      db
        .from('orders')
        .select(ORDER_SELECT)
        .eq('event_id', eventId)
        .eq('source', 'point_de_vente')
        .in('status', POS_PAID_STATUSES)
        .neq('status', 'REMOVED_BY_ADMIN')
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1),
    );
  }

  const seen = new Set();
  const merged = [];
  for (const row of [...onlineRows, ...codRows, ...posRows]) {
    if (!row?.id || seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged;
}

async function buildDashboardActivity(db, { eventId, days = 7, includePos = false }) {
  const dayCount = Math.min(30, Math.max(1, Number(days) || 7));
  const dayBuckets = buildUtcDayBuckets(dayCount);

  const [applicationCounts, orders] = await Promise.all([
    countApplicationsByDay(db, dayBuckets),
    fetchActivityOrdersForEvent(db, eventId, includePos),
  ]);

  const aggregated = aggregateActivityFromOrders(orders, dayBuckets, { includePos });
  return applyApplicationCounts(aggregated, applicationCounts);
}

module.exports = {
  buildUtcDayBuckets,
  getActivityBucketDateUtc,
  isActivityOrder,
  isPaidOnlineActivityOrder,
  isPaidCodActivityOrder,
  isPaidPosActivityOrder,
  aggregateActivityFromOrders,
  buildDashboardActivity,
};
