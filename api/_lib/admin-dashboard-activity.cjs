'use strict';

/**
 * Overview Activity chart — server-side daily aggregates.
 *
 * Timezone: UTC calendar days for all series.
 * Applications: ambassador_applications.created_at
 * Orders/revenue: orders.created_at (creation date, not payment/completion date)
 *
 * Main chart lines: paid orders + paid revenue only.
 * Tooltip extras: pending orders + pending pipeline (line subtotal, no online fees).
 */

const {
  getOrderTicketsAndRevenue,
  getOrderReportRevenue,
} = require('./reports-order-helpers.cjs');

const UTC_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const COD_PAID_STATUSES = ['PAID', 'COMPLETED', 'MANUAL_COMPLETED'];
const COD_PENDING_STATUSES = [
  'PENDING_CASH',
  'PENDING_ADMIN_APPROVAL',
  'PENDING_AMBASSADOR_CONFIRMATION',
  'APPROVED',
];
const COD_SOURCES = ['platform_cod', 'ambassador_manual'];
const POS_PAID_STATUSES = ['PAID', 'COMPLETED'];
const POS_PENDING_STATUSES = ['PENDING_ADMIN_APPROVAL'];
const EXCLUDED_SOURCES = new Set(['official_invitation', 'Invitation']);
const ONLINE_TERMINAL_STATUSES = new Set([
  'CANCELLED',
  'CANCELLED_BY_ADMIN',
  'CANCELLED_BY_AMBASSADOR',
  'REJECTED',
  'FAILED',
  'REFUNDED',
  'EXPIRED',
  'REMOVED_BY_ADMIN',
]);

const ORDER_SELECT =
  'id, created_at, completed_at, payment_status_set_at, total_price, total_with_fees, status, payment_status, payment_method, source, notes, quantity, order_passes (quantity, price)';

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

function isExcludedActivitySource(order) {
  return EXCLUDED_SOURCES.has(order.source);
}

function isPaidOnlineActivityOrder(order) {
  if (order.source !== 'platform_online') return false;
  if (order.payment_method !== 'online') return false;
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

function isActivityOrder(order) {
  return (
    isPaidOnlineActivityOrder(order) ||
    isPaidCodActivityOrder(order) ||
    isPaidPosActivityOrder(order)
  );
}

function isPendingOnlineActivityOrder(order) {
  if (order.source !== 'platform_online') return false;
  if (order.payment_method !== 'online') return false;
  if (isPaidOnlineActivityOrder(order)) return false;
  if (ONLINE_TERMINAL_STATUSES.has(order.status)) return false;
  if (
    order.payment_status === 'FAILED' ||
    order.payment_status === 'REFUNDED' ||
    order.payment_status === 'EXPIRED'
  ) {
    return false;
  }
  return (
    order.status === 'PENDING_ONLINE' ||
    order.status === 'REDIRECTED' ||
    order.payment_status === 'PENDING_PAYMENT' ||
    order.payment_status == null
  );
}

function isPendingCodActivityOrder(order) {
  if (order.payment_method !== 'ambassador_cash') return false;
  if (!COD_SOURCES.includes(order.source)) return false;
  if (order.status === 'REMOVED_BY_ADMIN') return false;
  if (isPaidCodActivityOrder(order)) return false;
  return COD_PENDING_STATUSES.includes(order.status);
}

function isPendingPosActivityOrder(order) {
  if (order.source !== 'point_de_vente') return false;
  if (order.status === 'REMOVED_BY_ADMIN') return false;
  if (isPaidPosActivityOrder(order)) return false;
  return POS_PENDING_STATUSES.includes(order.status);
}

function isPendingActivityOrder(order) {
  return (
    isPendingOnlineActivityOrder(order) ||
    isPendingCodActivityOrder(order) ||
    isPendingPosActivityOrder(order)
  );
}

/** Bucket date (YYYY-MM-DD UTC) from orders.created_at for Activity chart. */
function getActivityCreatedAtBucketDateUtc(order) {
  if (!order.created_at) return null;
  return new Date(order.created_at).toISOString().slice(0, 10);
}

function activityPaidRevenue(order) {
  if (isPaidOnlineActivityOrder(order)) {
    return getOrderReportRevenue(order);
  }
  return getOrderTicketsAndRevenue(order).revenue;
}

/** Pending pipeline: line subtotal only (no online payment fees until paid). */
function activityPendingRevenue(order) {
  return getOrderTicketsAndRevenue(order).revenue;
}

/**
 * Pure aggregation for tests — merge order rows into day buckets by created_at.
 */
function aggregateActivityFromOrders(orders, dayBuckets) {
  const byDate = new Map(
    dayBuckets.map((d) => [
      d.date,
      { ...d, applications: 0, orders: 0, revenue: 0, pendingOrders: 0, pendingRevenue: 0 },
    ]),
  );
  const validDates = new Set(dayBuckets.map((d) => d.date));

  for (const order of orders) {
    if (isExcludedActivitySource(order)) continue;
    const bucketDate = getActivityCreatedAtBucketDateUtc(order);
    if (!bucketDate || !validDates.has(bucketDate)) continue;
    const row = byDate.get(bucketDate);

    if (isActivityOrder(order)) {
      row.orders += 1;
      row.revenue += activityPaidRevenue(order);
    } else if (isPendingActivityOrder(order)) {
      row.pendingOrders += 1;
      row.pendingRevenue += activityPendingRevenue(order);
    }
  }

  return dayBuckets.map((d) => {
    const row = byDate.get(d.date);
    const revenue = Math.round(row.revenue);
    const pendingRevenue = Math.round(row.pendingRevenue);
    return {
      name: row.name,
      date: row.date,
      applications: row.applications,
      orders: row.orders,
      revenue,
      pendingOrders: row.pendingOrders,
      pendingRevenue,
      totalCreatedOrders: row.orders + row.pendingOrders,
      totalPotentialRevenue: revenue + pendingRevenue,
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

async function fetchActivityOrdersForEvent(db, eventId, windowStart, windowEnd) {
  const onlineRows = await fetchAllPaginated((offset, pageSize) =>
    db
      .from('orders')
      .select(ORDER_SELECT)
      .eq('event_id', eventId)
      .eq('source', 'platform_online')
      .gte('created_at', windowStart)
      .lte('created_at', windowEnd)
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
      .gte('created_at', windowStart)
      .lte('created_at', windowEnd)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1),
  );

  const posRows = await fetchAllPaginated((offset, pageSize) =>
    db
      .from('orders')
      .select(ORDER_SELECT)
      .eq('event_id', eventId)
      .eq('source', 'point_de_vente')
      .gte('created_at', windowStart)
      .lte('created_at', windowEnd)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1),
  );

  const seen = new Set();
  const merged = [];
  for (const row of [...onlineRows, ...codRows, ...posRows]) {
    if (!row?.id || seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged;
}

async function buildDashboardActivity(db, { eventId, days = 7 }) {
  const dayCount = Math.min(30, Math.max(1, Number(days) || 7));
  const dayBuckets = buildUtcDayBuckets(dayCount);
  const windowStart = dayBuckets[0].startIso;
  const windowEnd = dayBuckets[dayBuckets.length - 1].endIso;

  const [applicationCounts, orders] = await Promise.all([
    countApplicationsByDay(db, dayBuckets),
    fetchActivityOrdersForEvent(db, eventId, windowStart, windowEnd),
  ]);

  const aggregated = aggregateActivityFromOrders(orders, dayBuckets);
  return applyApplicationCounts(aggregated, applicationCounts);
}

module.exports = {
  buildUtcDayBuckets,
  getActivityCreatedAtBucketDateUtc,
  isActivityOrder,
  isPendingActivityOrder,
  isPaidOnlineActivityOrder,
  isPaidCodActivityOrder,
  isPaidPosActivityOrder,
  isPendingOnlineActivityOrder,
  isPendingCodActivityOrder,
  isPendingPosActivityOrder,
  isExcludedActivitySource,
  activityPaidRevenue,
  activityPendingRevenue,
  aggregateActivityFromOrders,
  buildDashboardActivity,
  COD_PAID_STATUSES,
  COD_PENDING_STATUSES,
  POS_PAID_STATUSES,
  POS_PENDING_STATUSES,
  EXCLUDED_SOURCES,
};
