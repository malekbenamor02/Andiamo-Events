'use strict';

const { hasEffectivePermission } = require('../../shared/admin/permissions.cjs');

const COD_SOURCES = ['platform_cod', 'ambassador_manual'];
const COD_PAID_STATUSES = ['PAID', 'COMPLETED', 'MANUAL_COMPLETED'];
const AMBASSADOR_STATUS_NOTIFY = [
  ...COD_PAID_STATUSES,
  'CANCELLED',
  'REJECTED',
  'EXPIRED',
  'FAILED',
];

const ORDER_BATCH_LIMIT = 100;
const APPLICATION_BATCH_LIMIT = 50;
const FEED_PAGE_SIZE = 50;
const MAX_ORDER_BATCHES = 20;
const MAX_APPLICATION_BATCHES = 10;

const ORDER_SELECT =
  'id, created_at, updated_at, event_id, source, payment_method, payment_status, status, order_number, total_price, total_with_fees, quantity, payment_status_set_at, order_passes(quantity)';

const APPLICATION_SELECT = 'id, created_at, updated_at, status, city';

const PII_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\b\d{8}\b/g,
  /\+?\d{10,15}/g,
];

function parseSince(sinceRaw) {
  if (!sinceRaw || typeof sinceRaw !== 'string') return null;
  const d = new Date(sinceRaw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

const FEED_CURSOR_SEP = '#';

/**
 * Parse feed cursor: plain ISO timestamp or compound "occurredAt#eventId".
 */
function parseFeedCursor(cursorRaw) {
  if (!cursorRaw || typeof cursorRaw !== 'string') return null;

  const sepIdx = cursorRaw.lastIndexOf(FEED_CURSOR_SEP);
  if (sepIdx > 0) {
    const occurredPart = cursorRaw.slice(0, sepIdx);
    const afterId = cursorRaw.slice(sepIdx + 1);
    const occurredAt = parseSince(occurredPart);
    if (!occurredAt || !afterId) return null;
    return { occurredAt, afterId, raw: cursorRaw };
  }

  const occurredAt = parseSince(cursorRaw);
  if (!occurredAt) return null;
  return { occurredAt, afterId: null, raw: cursorRaw };
}

function encodeFeedCursor(occurredAt, eventId) {
  return `${occurredAt}${FEED_CURSOR_SEP}${eventId}`;
}

function isEventAfterCursor(event, cursor) {
  if (!cursor.afterId) return true;
  const t = new Date(event.occurredAt).getTime();
  const ct = new Date(cursor.occurredAt).getTime();
  if (t > ct) return true;
  if (t < ct) return false;
  return event.id.localeCompare(cursor.afterId) > 0;
}

function filterEventsAfterCursor(events, cursor) {
  if (!cursor?.afterId) return events;
  return events.filter((ev) => isEventAfterCursor(ev, cursor));
}

function isAtOrAfter(iso, sinceIso) {
  if (!iso) return false;
  return new Date(iso).getTime() >= new Date(sinceIso).getTime();
}

function isBefore(iso, sinceIso) {
  if (!iso) return true;
  return new Date(iso).getTime() < new Date(sinceIso).getTime();
}

function isAfter(iso, sinceIso) {
  if (!iso) return false;
  return new Date(iso).getTime() > new Date(sinceIso).getTime();
}

function formatOrderNumber(order) {
  if (order.order_number != null && String(order.order_number).trim() !== '') {
    const n = String(order.order_number).replace(/^#/, '');
    return `#${n}`;
  }
  const short = String(order.id || '').slice(0, 8);
  return short ? `#${short}` : 'Order';
}

function countPasses(order) {
  const passes = order.order_passes;
  if (Array.isArray(passes) && passes.length > 0) {
    return passes.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
  }
  return Number(order.quantity) || 0;
}

function formatAmountTnd(order) {
  const raw =
    typeof order.total_with_fees === 'number'
      ? order.total_with_fees
      : typeof order.total_price === 'number'
        ? order.total_price
        : null;
  if (raw == null) return null;
  return `${Number(raw).toFixed(0)} TND`;
}

function sanitizeText(text) {
  if (!text) return '';
  let out = String(text);
  for (const re of PII_PATTERNS) {
    out = out.replace(re, '***');
  }
  return out.trim();
}

function assertSanitizedMessage(message) {
  return sanitizeText(message);
}

function isPaidOnlineOrder(order) {
  return (
    order.payment_status === 'PAID' ||
    order.status === 'PAID' ||
    order.status === 'COMPLETED'
  );
}

function isPaidAmbassadorOrder(order) {
  return COD_PAID_STATUSES.includes(order.status);
}

function buildOnlineOrderEvents(order, sinceIso) {
  const events = [];
  const orderLabel = formatOrderNumber(order);
  const passes = countPasses(order);
  const amount = formatAmountTnd(order);
  const passPart = passes > 0 ? `${passes} pass${passes === 1 ? '' : 'es'}` : 'passes';
  const amountPart = amount ? ` • ${amount}` : '';
  const baseMessage = `Order ${orderLabel} • ${passPart}${amountPart}`;
  const createdInWindow = isAtOrAfter(order.created_at, sinceIso);
  const paidAtCreation = createdInWindow && isPaidOnlineOrder(order);

  if (createdInWindow) {
    events.push({
      id: `order:${order.id}:created`,
      type: 'online_order_created',
      kind: 'online_order',
      eventId: order.event_id || null,
      recordId: order.id,
      occurredAt: order.created_at,
      title: paidAtCreation ? 'Online order paid' : 'New online order',
      message: assertSanitizedMessage(
        paidAtCreation ? `Order ${orderLabel} marked paid` : baseMessage,
      ),
      severity: paidAtCreation ? 'success' : 'info',
      tabTarget: 'online-orders',
      playSound: true,
      showDesktop: true,
    });
  }

  const paidInWindow =
    isPaidOnlineOrder(order) &&
    !paidAtCreation &&
    (isAtOrAfter(order.payment_status_set_at, sinceIso) ||
      (isAtOrAfter(order.updated_at, sinceIso) && isBefore(order.created_at, sinceIso)));

  if (paidInWindow) {
    events.push({
      id: `order:${order.id}:paid`,
      type: 'online_order_paid',
      kind: 'online_order',
      eventId: order.event_id || null,
      recordId: order.id,
      occurredAt: order.payment_status_set_at || order.updated_at || order.created_at,
      title: 'Online order paid',
      message: assertSanitizedMessage(`Order ${orderLabel} marked paid`),
      severity: 'success',
      tabTarget: 'online-orders',
      playSound: true,
      showDesktop: true,
    });
  }

  const terminalStatuses = ['FAILED', 'EXPIRED', 'REFUNDED'];
  const statusLabel = order.payment_status || order.status;
  const statusIsTerminal =
    terminalStatuses.includes(order.payment_status) ||
    terminalStatuses.includes(order.status);
  const statusTimestamp = order.payment_status_set_at || order.updated_at;
  const statusChangedInWindow =
    statusIsTerminal &&
    isAtOrAfter(statusTimestamp, sinceIso) &&
    isBefore(order.created_at, sinceIso) &&
    !paidInWindow;

  if (statusChangedInWindow) {
    events.push({
      id: `order:${order.id}:status:${statusLabel}`,
      type: 'online_order_status_changed',
      kind: 'online_order',
      eventId: order.event_id || null,
      recordId: order.id,
      occurredAt: statusTimestamp || order.created_at,
      title: 'Online order updated',
      message: assertSanitizedMessage(`Order ${orderLabel} → ${statusLabel}`),
      severity: 'warning',
      tabTarget: 'online-orders',
      playSound: false,
      showDesktop: false,
    });
  }

  return events;
}

function buildAmbassadorSaleEvents(order, sinceIso) {
  const events = [];
  const orderLabel = formatOrderNumber(order);
  const passes = countPasses(order);
  const amount = formatAmountTnd(order);
  const passPart = passes > 0 ? `${passes} pass${passes === 1 ? '' : 'es'}` : 'passes';
  const amountPart = amount ? ` • ${amount}` : '';

  if (isAtOrAfter(order.created_at, sinceIso)) {
    events.push({
      id: `order:${order.id}:created`,
      type: 'ambassador_sale_created',
      kind: 'ambassador_order',
      eventId: order.event_id || null,
      recordId: order.id,
      occurredAt: order.created_at,
      title: 'New ambassador sale',
      message: assertSanitizedMessage(`COD order ${orderLabel} • ${passPart}${amountPart}`),
      severity: 'info',
      tabTarget: 'ambassador-sales',
      playSound: true,
      showDesktop: true,
    });
  }

  if (
    isAtOrAfter(order.updated_at, sinceIso) &&
    isBefore(order.created_at, sinceIso) &&
    AMBASSADOR_STATUS_NOTIFY.includes(order.status)
  ) {
    const statusLabel = order.status || 'updated';
    const paid = isPaidAmbassadorOrder(order);
    events.push({
      id: `order:${order.id}:status:${statusLabel}`,
      type: 'ambassador_sale_status_changed',
      kind: 'ambassador_order',
      eventId: order.event_id || null,
      recordId: order.id,
      occurredAt: order.updated_at || order.created_at,
      title: 'Ambassador sale updated',
      message: assertSanitizedMessage(`Order ${orderLabel} → ${statusLabel}`),
      severity: paid ? 'success' : 'info',
      tabTarget: 'ambassador-sales',
      playSound: paid,
      showDesktop: true,
    });
  }

  return events;
}

function buildApplicationEvents(app, sinceIso) {
  const events = [];

  if (isAtOrAfter(app.created_at, sinceIso)) {
    events.push({
      id: `application:${app.id}:created`,
      type: 'ambassador_application_created',
      kind: 'ambassador_application',
      eventId: null,
      recordId: app.id,
      occurredAt: app.created_at,
      title: 'New ambassador application',
      message: 'New application submitted',
      severity: 'info',
      tabTarget: 'applications',
      playSound: true,
      showDesktop: true,
    });
  }

  if (
    isAfter(app.updated_at, sinceIso) &&
    isBefore(app.created_at, sinceIso) &&
    ['approved', 'rejected', 'suspended', 'removed'].includes(app.status)
  ) {
    const statusLabel =
      app.status === 'approved'
        ? 'approved'
        : app.status === 'rejected'
          ? 'rejected'
          : app.status;
    events.push({
      id: `application:${app.id}:status:${app.status}`,
      type: 'ambassador_application_status_changed',
      kind: 'ambassador_application',
      eventId: null,
      recordId: app.id,
      occurredAt: app.updated_at || app.created_at,
      title: 'Application reviewed',
      message: assertSanitizedMessage(`Application ${statusLabel}`),
      severity: app.status === 'approved' ? 'success' : 'warning',
      tabTarget: 'applications',
      playSound: false,
      showDesktop: false,
    });
  }

  return events;
}

function sortEventsAscending(events) {
  return [...events].sort((a, b) => {
    const t = new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime();
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Paginate merged feed events with safe cursor advancement.
 */
function computeFeedPage(allEvents, serverTime, options = {}) {
  const pageSize = options.pageSize ?? FEED_PAGE_SIZE;
  const sourceTruncated = options.sourceTruncated === true;
  const cursor =
    options.cursorAfterId != null
      ? { occurredAt: options.cursorOccurredAt, afterId: options.cursorAfterId }
      : null;

  const byId = new Map();
  for (const ev of allEvents) {
    if (!byId.has(ev.id)) byId.set(ev.id, ev);
  }

  const sorted = sortEventsAscending([...byId.values()]);
  const pool = cursor ? filterEventsAfterCursor(sorted, cursor) : sorted;
  const page = pool.slice(0, pageSize);
  const hasMore = pool.length > pageSize || sourceTruncated;

  let nextCursor = serverTime;
  if (hasMore && page.length > 0) {
    const last = page[page.length - 1];
    nextCursor = encodeFeedCursor(last.occurredAt, last.id);
  }

  return {
    serverTime,
    nextCursor,
    hasMore,
    events: page,
  };
}

/**
 * Simulate client pagination until hasMore is false (for tests).
 */
function simulateFeedPagination(allEvents, startCursorRaw, serverTime, options = {}) {
  const delivered = [];
  const seen = new Set();
  let since = startCursorRaw;
  let guard = 0;

  while (guard++ < 50) {
    const cursor = parseFeedCursor(since);
    if (!cursor) break;

    const pageResult = computeFeedPage(allEvents, serverTime, {
      pageSize: options.pageSize,
      sourceTruncated: options.sourceTruncated,
      cursorOccurredAt: cursor.occurredAt,
      cursorAfterId: cursor.afterId,
    });

    for (const ev of pageResult.events) {
      if (seen.has(ev.id)) {
        const err = new Error(`duplicate event id in pagination: ${ev.id}`);
        err.code = 'PAGINATION_DUPLICATE';
        throw err;
      }
      seen.add(ev.id);
      delivered.push(ev);
    }

    if (!pageResult.hasMore) break;
    since = pageResult.nextCursor;
  }

  return delivered;
}

async function fetchChangedOrdersBatch(db, sinceIso, filterBuilder, batchSince) {
  let query = db
    .from('orders')
    .select(ORDER_SELECT)
    .neq('status', 'REMOVED_BY_ADMIN')
    .or(`created_at.gte.${batchSince},updated_at.gte.${batchSince}`)
    .order('updated_at', { ascending: true })
    .limit(ORDER_BATCH_LIMIT);

  query = filterBuilder(query);

  const { data, error } = await query;
  if (error) throw error;
  const rows = data || [];
  return {
    rows,
    hitLimit: rows.length >= ORDER_BATCH_LIMIT,
  };
}

async function fetchAllChangedOrders(db, sinceIso, filterBuilder) {
  const byId = new Map();
  let batchSince = sinceIso;
  let sourceTruncated = false;

  for (let i = 0; i < MAX_ORDER_BATCHES; i++) {
    const { rows, hitLimit } = await fetchChangedOrdersBatch(db, sinceIso, filterBuilder, batchSince);
    if (rows.length === 0) break;

    for (const row of rows) {
      byId.set(row.id, row);
    }

    if (!hitLimit) break;
    sourceTruncated = true;
    const last = rows[rows.length - 1];
    const nextSince = last.updated_at || last.created_at;
    if (!nextSince || nextSince === batchSince) break;
    batchSince = nextSince;
  }

  return { rows: [...byId.values()], sourceTruncated };
}

async function fetchChangedApplicationsBatch(db, batchSince) {
  const { data, error } = await db
    .from('ambassador_applications')
    .select(APPLICATION_SELECT)
    .or(`created_at.gte.${batchSince},updated_at.gte.${batchSince}`)
    .order('updated_at', { ascending: true })
    .limit(APPLICATION_BATCH_LIMIT);

  if (error) throw error;
  const rows = data || [];
  return {
    rows,
    hitLimit: rows.length >= APPLICATION_BATCH_LIMIT,
  };
}

async function fetchAllChangedApplications(db, sinceIso) {
  const byId = new Map();
  let batchSince = sinceIso;
  let sourceTruncated = false;

  for (let i = 0; i < MAX_APPLICATION_BATCHES; i++) {
    const { rows, hitLimit } = await fetchChangedApplicationsBatch(db, batchSince);
    if (rows.length === 0) break;

    for (const row of rows) {
      byId.set(row.id, row);
    }

    if (!hitLimit) break;
    sourceTruncated = true;
    const last = rows[rows.length - 1];
    const nextSince = last.updated_at || last.created_at;
    if (!nextSince || nextSince === batchSince) break;
    batchSince = nextSince;
  }

  return { rows: [...byId.values()], sourceTruncated };
}

/**
 * Build sanitized admin notification feed events (read-only).
 */
async function buildAdminNotificationsFeed(db, options) {
  const { since: sinceRaw, eventId, permissions } = options;
  const feedCursor = parseFeedCursor(sinceRaw);
  if (!feedCursor) {
    const err = new Error('Invalid or missing since parameter (ISO timestamp or compound cursor required)');
    err.code = 'INVALID_SINCE';
    throw err;
  }
  const sinceIso = feedCursor.occurredAt;

  const serverTime = new Date().toISOString();
  const events = [];
  let sourceTruncated = false;

  const canOnlineOrders = hasEffectivePermission(permissions, 'orders:manage');
  const canAmbassadorSales = hasEffectivePermission(permissions, 'ambassador_sales:manage');
  const canApplications = hasEffectivePermission(permissions, 'applications:manage');

  if (canOnlineOrders) {
    const { rows, sourceTruncated: truncated } = await fetchAllChangedOrders(db, sinceIso, (q) => {
      let query = q.eq('source', 'platform_online');
      if (eventId) query = query.eq('event_id', eventId);
      return query;
    });
    if (truncated) sourceTruncated = true;
    for (const order of rows) {
      events.push(...buildOnlineOrderEvents(order, sinceIso));
    }
  }

  if (canAmbassadorSales) {
    const { rows, sourceTruncated: truncated } = await fetchAllChangedOrders(db, sinceIso, (q) => {
      let query = q.eq('payment_method', 'ambassador_cash').in('source', COD_SOURCES);
      if (eventId) query = query.eq('event_id', eventId);
      return query;
    });
    if (truncated) sourceTruncated = true;
    for (const order of rows) {
      events.push(...buildAmbassadorSaleEvents(order, sinceIso));
    }
  }

  if (canApplications) {
    const { rows, sourceTruncated: truncated } = await fetchAllChangedApplications(db, sinceIso);
    if (truncated) sourceTruncated = true;
    for (const app of rows) {
      events.push(...buildApplicationEvents(app, sinceIso));
    }
  }

  return computeFeedPage(events, serverTime, {
    pageSize: FEED_PAGE_SIZE,
    sourceTruncated,
    cursorOccurredAt: feedCursor.occurredAt,
    cursorAfterId: feedCursor.afterId,
  });
}

module.exports = {
  buildAdminNotificationsFeed,
  buildOnlineOrderEvents,
  buildAmbassadorSaleEvents,
  buildApplicationEvents,
  computeFeedPage,
  simulateFeedPagination,
  sortEventsAscending,
  parseFeedCursor,
  encodeFeedCursor,
  isEventAfterCursor,
  sanitizeText,
  assertSanitizedMessage,
  parseSince,
  formatOrderNumber,
  FEED_PAGE_SIZE,
};
