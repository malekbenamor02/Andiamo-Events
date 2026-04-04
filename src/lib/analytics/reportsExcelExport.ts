/**
 * Branded Excel export for Reports (online, ambassador cash, and POS paid orders).
 */

import ExcelJS from 'exceljs';
import type { WorksheetProtection } from 'exceljs';
import { supabase } from '@/integrations/supabase/client';
import { OrderStatus, PaymentMethod } from '@/lib/constants/orderStatuses';
import { getDateRangeFilter, getDateRangeLabel, type DateRange } from '@/hooks/useAnalytics';
import {
  isPaidOnlineOrder,
  isPaidAmbassadorCashOrder,
  isPaidOnlineOrAmbassadorOrder,
  isPaidPosOrder,
} from '@/lib/orders/orderAnalytics';
import { getOrderReportRevenue, getOrderTicketsAndRevenue } from '@/lib/orders/orderRevenue';

/** PostgREST often returns HTTP 400 with message "Bad Request" while the real cause is in `details`. */
function supabaseErrorMessage(err: { message?: string; details?: string; hint?: string }): string {
  const m = (err.message || 'Unknown error').trim();
  const d = (err.details || '').trim();
  const h = (err.hint || '').trim();
  if (d.length > 0 && d.toLowerCase() !== m.toLowerCase()) {
    return h.length > 0 ? `${m} — ${d} (${h})` : `${m} — ${d}`;
  }
  return h.length > 0 ? `${m} (${h})` : m;
}

/** Keeps `.in('id', …)` URLs under typical proxy limits for large events. */
const ORDERS_BY_ID_CHUNK = 120;

const THEME = {
  primary: { argb: 'FFE21836' },
  dark: { argb: 'FF1A1A1A' },
  header: { argb: 'FF2A2A2A' },
  headerDeep: { argb: 'FF242424' },
  stripeA: { argb: 'FF262626' },
  stripeB: { argb: 'FF303030' },
  summaryBar: { argb: 'FF2F2F2F' },
  white: { argb: 'FFFFFFFF' },
  muted: { argb: 'FFB8B8B8' },
  green: { argb: 'FF10B981' },
  teal: { argb: 'FF14B8A6' },
  border: { argb: 'FF444444' },
  goldMuted: { argb: 'FFFBBF24' },
};

type Lang = 'en' | 'fr';

const COPY: Record<
  Lang,
  {
    workbookTitle: string;
    summarySheet: string;
    onlineSheet: string;
    ambSheet: string;
    posSheet: string;
    summaryColChannel: string;
    summaryAllChannelsPaid: string;
    period: string;
    event: string;
    allEvents: string;
    genAt: string;
    totalOrders: string;
    totalTickets: string;
    totalRevenue: string;
    tnd: string;
    allOrders: string;
    byAmbassador: string;
    ambColAmbassador: string;
    ambColPhone: string;
    ambColOrders: string;
    ambColTickets: string;
    ambColRevenue: string;
    passesStockSheet: string;
    stockSection: string;
    passType: string;
    soldOnline: string;
    soldAmbassador: string;
    soldOtherChannels: string;
    soldTotal: string;
    stockPaidOnlyNote: string;
    stockPaidOnlyNoteEvent: string;
    stockStripOnline: string;
    stockStripAmbassador: string;
    stockStripOther: string;
    stockStripAll: string;
  }
> = {
  en: {
    workbookTitle: 'ANDIAMO EVENTS — SALES REPORT',
    summarySheet: 'Summary',
    onlineSheet: 'Online payments',
    ambSheet: 'Ambassador sales',
    posSheet: 'POS sales',
    summaryColChannel: 'Channel',
    summaryAllChannelsPaid: 'All channels (paid)',
    passesStockSheet: 'Passes stock',
    period: 'Period',
    event: 'Event',
    allEvents: 'All events',
    genAt: 'Generated',
    totalOrders: 'Total orders',
    totalTickets: 'Total tickets',
    totalRevenue: 'Total revenue',
    tnd: 'TND',
    allOrders: 'All orders (paid)',
    byAmbassador: 'Summary by ambassador',
    ambColAmbassador: 'Ambassador',
    ambColPhone: 'Ambassador phone',
    ambColOrders: 'Orders',
    ambColTickets: 'Tickets',
    ambColRevenue: 'Revenue (TND)',
    stockSection: 'Pass stock by sales channel',
    passType: 'Pass',
    soldOnline: 'Online (qty)',
    soldAmbassador: 'Ambassador (qty)',
    soldOtherChannels: 'Other (POS / external) (qty)',
    soldTotal: 'Total sold (Pass Stock)',
    stockPaidOnlyNote:
      'No event filter: pass names from paid orders only, for the report date range. Quantities include online, ambassador cash, and POS (point de vente).',
    stockPaidOnlyNoteEvent:
      'Paid online, ambassador cash, and POS (point de vente). Quantities from order_passes by pass id. Total = Online + Ambassador + POS for each pass.',
    stockStripOnline: 'Online passes (total qty)',
    stockStripAmbassador: 'Ambassador passes (total qty)',
    stockStripOther: 'Other channels (total qty)',
    stockStripAll: 'Total sold (Pass Stock)',
  },
  fr: {
    workbookTitle: 'ANDIAMO EVENTS — RAPPORT DES VENTES',
    summarySheet: 'Synthèse',
    onlineSheet: 'Paiements en ligne',
    ambSheet: 'Ventes ambassadeurs',
    posSheet: 'Ventes PDV',
    summaryColChannel: 'Canal',
    summaryAllChannelsPaid: 'Tous canaux (payés)',
    period: 'Période',
    event: 'Événement',
    allEvents: 'Tous les événements',
    genAt: 'Généré',
    totalOrders: 'Total commandes',
    totalTickets: 'Total billets',
    totalRevenue: 'Revenu total',
    tnd: 'TND',
    allOrders: 'Toutes les commandes (payées)',
    byAmbassador: 'Synthèse par ambassadeur',
    ambColAmbassador: 'Ambassadeur',
    ambColPhone: 'Téléphone ambassadeur',
    ambColOrders: 'Commandes',
    ambColTickets: 'Billets',
    ambColRevenue: 'Revenu (TND)',
    passesStockSheet: 'Stock billets',
    stockSection: 'Stock des passes par canal',
    passType: 'Pass',
    soldOnline: 'En ligne (qté)',
    soldAmbassador: 'Ambassadeurs (qté)',
    soldOtherChannels: 'Autre (POS / externe) (qté)',
    soldTotal: 'Total vendu (stock)',
    stockPaidOnlyNote:
      'Sans événement : noms issus des commandes payées, selon la période du rapport. Quantités : en ligne, ambassadeurs et PDV (point de vente).',
    stockPaidOnlyNoteEvent:
      'Paiements en ligne, ambassadeurs (espèces) et PDV (point de vente). Quantités via order_passes par pass. Total = En ligne + Ambassadeurs + PDV pour chaque pass.',
    stockStripOnline: 'Billets en ligne (qté totale)',
    stockStripAmbassador: 'Billets ambassadeurs (qté totale)',
    stockStripOther: 'Autres canaux (qté totale)',
    stockStripAll: 'Total vendu (stock passes)',
  },
};

const COL = {
  en: {
    orderNum: 'Order #',
    orderId: 'Order ID',
    created: 'Created',
    status: 'Status',
    customer: 'Customer',
    phone: 'Phone',
    email: 'Email',
    city: 'City',
    ville: 'Area',
    passes: 'Passes (detail)',
    tickets: 'Tickets',
    lineRevenue: 'Total without fees',
    totalPrice: 'Total price',
    paymentMethod: 'Payment method',
    source: 'Source',
    completed: 'Completed at',
    adminNotes: 'Admin notes',
    ambassador: 'Ambassador',
    ambPhone: 'Amb. phone',
    event: 'Event',
  },
  fr: {
    orderNum: 'N° commande',
    orderId: 'ID commande',
    created: 'Créée le',
    status: 'Statut',
    customer: 'Client',
    phone: 'Téléphone',
    email: 'E-mail',
    city: 'Ville',
    ville: 'Zone',
    passes: 'Billets (détail)',
    tickets: 'Quantité',
    lineRevenue: 'Total hors frais',
    totalPrice: 'Prix total',
    paymentMethod: 'Moyen de paiement',
    source: 'Source',
    completed: 'Complétée le',
    adminNotes: 'Notes admin',
    ambassador: 'Ambassadeur',
    ambPhone: 'Tél. amb.',
    event: 'Événement',
  },
};

function thinBorder(color = THEME.border) {
  return {
    top: { style: 'thin' as const, color },
    bottom: { style: 'thin' as const, color },
    left: { style: 'thin' as const, color },
    right: { style: 'thin' as const, color },
  };
}

function formatDt(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(lang === 'fr' ? 'fr-TN' : 'en-GB', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return String(iso);
  }
}

function formatPasses(order: any): string {
  const passes = order.order_passes;
  if (passes && Array.isArray(passes) && passes.length > 0) {
    return passes
      .map((p: any) => `${p.pass_type} ×${p.quantity} @ ${p.price} TND`)
      .join(' | ');
  }
  if (order.pass_type) {
    return `${order.pass_type} ×${order.quantity ?? 1}`;
  }
  return '—';
}

function safeStr(v: unknown, max = 500): string {
  if (v == null || v === '') return '—';
  const s = String(v);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

async function fetchPaidOrdersForExport(eventId: string | null, dateRange: DateRange) {
  const { startDate, endDate } = getDateRangeFilter(dateRange);
  let query = supabase
    .from('orders')
    .select(
      `
      *,
      order_passes (*),
      ambassadors ( id, full_name, phone, email ),
      events ( id, name, date, venue, city )
    `,
      { count: 'exact' }
    )
    .in('status', [OrderStatus.PAID, 'COMPLETED'])
    .in('payment_method', [PaymentMethod.ONLINE, PaymentMethod.AMBASSADOR_CASH])
    .order('created_at', { ascending: false })
    .limit(15000);

  if (eventId) {
    query = query.eq('event_id', eventId);
  }
  if (startDate) {
    query = query.gte('created_at', startDate.toISOString());
  }
  if (endDate) {
    query = query.lte('created_at', endDate.toISOString());
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }
  const rows = (data || []) as any[];
  const onlineAndAmb = rows.filter(isPaidOnlineOrAmbassadorOrder);

  let posQuery = supabase
    .from('orders')
    .select(
      `
      *,
      order_passes (*),
      ambassadors ( id, full_name, phone, email ),
      events ( id, name, date, venue, city )
    `,
      { count: 'exact' }
    )
    .eq('source', 'point_de_vente')
    .in('status', [OrderStatus.PAID, 'COMPLETED'])
    .order('created_at', { ascending: false })
    .limit(15000);

  if (eventId) {
    posQuery = posQuery.eq('event_id', eventId);
  }
  if (startDate) {
    posQuery = posQuery.gte('created_at', startDate.toISOString());
  }
  if (endDate) {
    posQuery = posQuery.lte('created_at', endDate.toISOString());
  }

  const { data: posData, error: posError } = await posQuery;
  if (posError) {
    throw new Error(supabaseErrorMessage(posError));
  }
  const posRows = ((posData || []) as any[]).filter(isPaidPosOrder);

  return [...onlineAndAmb, ...posRows];
}

function splitOrders(orders: any[]) {
  const online = orders.filter((o) => o.payment_method === PaymentMethod.ONLINE);
  const ambassador = orders.filter((o) => o.payment_method === PaymentMethod.AMBASSADOR_CASH);
  const pos = orders.filter((o) => isPaidPosOrder(o));
  return { online, ambassador, pos };
}

/** Alphabetical by ambassador name, then by order date for stable grouping. */
function sortAmbassadorOrdersAlphabetically(orders: any[], lang: Lang): any[] {
  const locale = lang === 'fr' ? 'fr' : 'en';
  return [...orders].sort((a, b) => {
    const nameA = String(a.ambassadors?.full_name || '\uFFFF');
    const nameB = String(b.ambassadors?.full_name || '\uFFFF');
    const byName = nameA.localeCompare(nameB, locale, { sensitivity: 'base' });
    if (byName !== 0) return byName;
    return String(a.created_at || '').localeCompare(String(b.created_at || ''));
  });
}

type AmbassadorAgg = {
  name: string;
  phone: string;
  orders: number;
  tickets: number;
  revenue: number;
  passesByType: Map<string, number>;
};

function ambassadorAggregateMap(ambassadorOrders: any[]): Map<string, AmbassadorAgg> {
  const map = new Map<string, AmbassadorAgg>();
  for (const o of ambassadorOrders) {
    const id = o.ambassador_id || '_none';
    const name = o.ambassadors?.full_name || '—';
    const phone = o.ambassadors?.phone || '—';
    const tickets = getOrderTicketsAndRevenue(o).tickets;
    const revenue = getOrderReportRevenue(o);
    let cur = map.get(id);
    if (!cur) {
      cur = { name, phone, orders: 0, tickets: 0, revenue: 0, passesByType: new Map() };
      map.set(id, cur);
    }
    cur.orders += 1;
    cur.tickets += tickets;
    cur.revenue += revenue;
    if (name !== '—') cur.name = name;
    if (phone !== '—') cur.phone = phone;
    if (o.order_passes?.length) {
      for (const p of o.order_passes) {
        const pt = String(p.pass_type || '—');
        cur.passesByType.set(pt, (cur.passesByType.get(pt) || 0) + (Number(p.quantity) || 0));
      }
    } else if (o.pass_type) {
      const pt = String(o.pass_type);
      cur.passesByType.set(pt, (cur.passesByType.get(pt) || 0) + (Number(o.quantity) || 1));
    }
  }
  return map;
}

function collectPassTypesFromOrders(orders: any[]): string[] {
  const s = new Set<string>();
  for (const o of orders) {
    if (o.order_passes?.length) {
      for (const p of o.order_passes) {
        if (p.pass_type) s.add(String(p.pass_type));
      }
    } else if (o.pass_type) {
      s.add(String(o.pass_type));
    }
  }
  return Array.from(s);
}

async function fetchEventPassTypeNames(eventId: string): Promise<string[]> {
  const { data, error } = await supabase.from('event_passes').select('name').eq('event_id', eventId);
  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }
  return (data || []).map((p: { name?: string }) => p.name).filter(Boolean) as string[];
}

type RosterRow = { id: string; full_name: string; phone: string };

/** DB may not have migrations applied; PostgREST / Postgres errors vary by version. */
function isMissingRelationError(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const m = (err.message || '').toLowerCase();
  const c = err.code || '';
  return (
    m.includes('does not exist') ||
    (m.includes('schema cache') && m.includes('ambassador_events')) ||
    c === '42P01' ||
    c === 'PGRST205'
  );
}

async function fetchAmbassadorsByIds(orderedIds: string[]): Promise<RosterRow[]> {
  if (orderedIds.length === 0) return [];
  const { data: amRows, error: amError } = await supabase
    .from('ambassadors')
    .select('id, full_name, phone')
    .in('id', orderedIds);
  if (amError) {
    throw new Error(supabaseErrorMessage(amError));
  }
  const byId = new Map(
    (amRows || []).map((a: { id: string; full_name?: string; phone?: string }) => [
      a.id,
      { full_name: a.full_name ?? '—', phone: a.phone ?? '—' },
    ])
  );
  return orderedIds
    .map((id) => {
      const meta = byId.get(id);
      return {
        id,
        full_name: meta?.full_name ?? '—',
        phone: meta?.phone ?? '—',
      };
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'fr', { sensitivity: 'base' }));
}

async function fetchAllAmbassadorsRoster(): Promise<RosterRow[]> {
  const { data, error } = await supabase.from('ambassadors').select('id, full_name, phone').order('full_name');
  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }
  return (data || []).map((a: { id: string; full_name?: string; phone?: string }) => ({
    id: a.id,
    full_name: a.full_name ?? '—',
    phone: a.phone ?? '—',
  }));
}

/**
 * Event roster from ambassador_events when the table exists; otherwise all ambassadors (DB without that migration).
 */
async function fetchAmbassadorRosterForExport(eventId: string | null): Promise<RosterRow[]> {
  if (!eventId) {
    return fetchAllAmbassadorsRoster();
  }
  const { data: links, error: linksError } = await supabase
    .from('ambassador_events')
    .select('ambassador_id')
    .eq('event_id', eventId);
  if (linksError) {
    if (isMissingRelationError(linksError)) {
      return fetchAllAmbassadorsRoster();
    }
    throw new Error(supabaseErrorMessage(linksError));
  }
  const ids = Array.from(
    new Set((links || []).map((r: { ambassador_id?: string }) => r.ambassador_id).filter(Boolean) as string[])
  );
  if (ids.length === 0) {
    return [];
  }
  return fetchAmbassadorsByIds(ids);
}

async function resolvePassTypeColumns(
  eventId: string | null,
  ambassadorOrders: any[],
  lang: Lang
): Promise<string[]> {
  const fromOrders = collectPassTypesFromOrders(ambassadorOrders);
  const fromEvent = eventId ? await fetchEventPassTypeNames(eventId) : [];
  const locale = lang === 'fr' ? 'fr' : 'en';
  return Array.from(new Set([...fromEvent, ...fromOrders])).sort((a, b) =>
    a.localeCompare(b, locale, { sensitivity: 'base' })
  );
}

/** Quantity sold per pass name from paid orders (order_passes or legacy pass_type). */
function accumulatePassesSoldByType(orders: any[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const o of orders) {
    if (o.order_passes?.length) {
      for (const p of o.order_passes) {
        const pt = String(p.pass_type || '—');
        m.set(pt, (m.get(pt) || 0) + (Number(p.quantity) || 0));
      }
    } else if (o.pass_type) {
      const pt = String(o.pass_type);
      m.set(pt, (m.get(pt) || 0) + (Number(o.quantity) || 1));
    }
  }
  return m;
}

export type PassStockSheetRow = {
  name: string;
  online: number;
  ambassador: number;
  other: number;
  total: number;
};

/**
 * One row per event_pass: paid online vs ambassador vs POS via order_passes.pass_id
 * (same scope as Overview / Reports — non-paid stock states excluded).
 */
async function fetchPassStockBreakdownForEvent(eventId: string): Promise<PassStockSheetRow[]> {
  const { data: passes, error: pErr } = await supabase
    .from('event_passes')
    .select('id, name, release_version, is_primary, price')
    .eq('event_id', eventId)
    .order('release_version', { ascending: false })
    .order('is_primary', { ascending: false })
    .order('price', { ascending: true });

  if (pErr) throw new Error(supabaseErrorMessage(pErr));
  const list = (passes || []) as Array<{
    id: string;
    name: string;
  }>;
  const passIds = list.map((p) => p.id).filter(Boolean);
  if (passIds.length === 0) return [];

  const { data: orderPassesRows, error: opErr } = await supabase
    .from('order_passes')
    .select('order_id, pass_id, quantity')
    .in('pass_id', passIds);
  if (opErr) throw new Error(supabaseErrorMessage(opErr));

  const opRows = orderPassesRows || [];
  const orderIds = [
    ...new Set(
      opRows
        .map((op: { order_id?: string | null }) => op.order_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ),
  ];

  type Bucket = { online: number; ambassador: number; other: number };
  const breakdown: Record<string, Bucket> = {};
  for (const p of list) {
    breakdown[p.id] = { online: 0, ambassador: 0, other: 0 };
  }

  if (orderIds.length > 0) {
    const ordersRows: any[] = [];
    for (let i = 0; i < orderIds.length; i += ORDERS_BY_ID_CHUNK) {
      const chunk = orderIds.slice(i, i + ORDERS_BY_ID_CHUNK);
      const { data: chunkRows, error: oErr } = await supabase
        .from('orders')
        .select('id, payment_method, status, payment_status, event_id, source')
        .in('id', chunk);
      if (oErr) throw new Error(supabaseErrorMessage(oErr));
      if (chunkRows?.length) ordersRows.push(...chunkRows);
    }

    const orderById = new Map(ordersRows.map((o: any) => [o.id, o]));

    for (const op of opRows) {
      const oid = op.order_id as string | undefined | null;
      if (!oid) continue;
      const o = orderById.get(oid);
      if (!o) continue;
      if (!(o.event_id === eventId || o.event_id == null)) continue;
      if (!isPaidOnlineOrder(o) && !isPaidAmbassadorCashOrder(o) && !isPaidPosOrder(o)) continue;
      const pid = op.pass_id as string;
      if (!breakdown[pid]) continue;
      const q = Number(op.quantity) || 0;
      if (isPaidOnlineOrder(o)) {
        breakdown[pid].online += q;
      } else if (isPaidAmbassadorCashOrder(o)) {
        breakdown[pid].ambassador += q;
      } else if (isPaidPosOrder(o)) {
        breakdown[pid].other += q;
      }
    }
  }

  return list.map((p) => {
    const b = breakdown[p.id] || { online: 0, ambassador: 0, other: 0 };
    const online = b.online;
    const ambassador = b.ambassador;
    const other = b.other;
    return {
      name: p.name,
      online,
      ambassador,
      other,
      total: online + ambassador + other,
    };
  });
}

async function resolvePassTypesForStockSheet(
  eventId: string | null,
  onlineOrders: any[],
  ambassadorOrders: any[],
  posOrders: any[],
  lang: Lang
): Promise<string[]> {
  const fromOnline = collectPassTypesFromOrders(onlineOrders);
  const fromAmb = collectPassTypesFromOrders(ambassadorOrders);
  const fromPos = collectPassTypesFromOrders(posOrders);
  const fromEvent = eventId ? await fetchEventPassTypeNames(eventId) : [];
  const locale = lang === 'fr' ? 'fr' : 'en';
  return Array.from(new Set([...fromEvent, ...fromOnline, ...fromAmb, ...fromPos])).sort((a, b) =>
    a.localeCompare(b, locale, { sensitivity: 'base' })
  );
}

function styleTitleRow(sheet: ExcelJS.Worksheet, rowIndex: number, lastCol: number, title: string, subtitle: string) {
  sheet.mergeCells(rowIndex, 1, rowIndex, lastCol);
  const row = sheet.getRow(rowIndex);
  row.height = 36;
  const cell = row.getCell(1);
  cell.value = title;
  cell.font = { name: 'Arial', size: 18, bold: true, color: THEME.white };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: THEME.primary };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = thinBorder(THEME.primary);

  sheet.mergeCells(rowIndex + 1, 1, rowIndex + 1, lastCol);
  const sub = sheet.getRow(rowIndex + 1);
  sub.height = 22;
  const c2 = sub.getCell(1);
  c2.value = subtitle;
  c2.font = { name: 'Arial', size: 11, color: THEME.muted };
  c2.fill = { type: 'pattern', pattern: 'solid', fgColor: THEME.dark };
  c2.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  c2.border = thinBorder();
}

function setHeaderRow(sheet: ExcelJS.Worksheet, rowIndex: number, labels: string[]) {
  const row = sheet.getRow(rowIndex);
  row.height = 26;
  labels.forEach((text, i) => {
    const cell = row.getCell(i + 1);
    cell.value = text;
    cell.font = { name: 'Arial', size: 11, bold: true, color: THEME.white };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: THEME.header };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = thinBorder();
  });
}

function setDataRow(
  sheet: ExcelJS.Worksheet,
  rowIndex: number,
  values: (string | number)[],
  stripe: boolean,
  highlightColIndexes: number[] = []
) {
  const row = sheet.getRow(rowIndex);
  row.height = 20;
  const bg = stripe ? THEME.stripeA : THEME.stripeB;
  values.forEach((val, i) => {
    const cell = row.getCell(i + 1);
    cell.value = val;
    const isNum = typeof val === 'number';
    const bold = highlightColIndexes.includes(i);
    cell.font = {
      name: 'Arial',
      size: 10,
      bold,
      color: isNum ? THEME.goldMuted : THEME.muted,
    };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: bg };
    cell.alignment = {
      vertical: 'middle',
      horizontal: isNum ? 'right' : 'left',
      wrapText: true,
    };
    cell.border = thinBorder();
    if (isNum && !Number.isInteger(val)) {
      cell.numFmt = '0.00';
    }
  });
}

function setSummaryStrip(
  sheet: ExcelJS.Worksheet,
  rowIndex: number,
  lastCol: number,
  items: { label: string; value: string }[],
  accent: 'green' | 'teal'
) {
  const clr = accent === 'green' ? THEME.green : THEME.teal;
  sheet.mergeCells(rowIndex, 1, rowIndex, lastCol);
  const row = sheet.getRow(rowIndex);
  row.height = 28;
  const cell = row.getCell(1);
  cell.value = items.map((x) => `${x.label}: ${x.value}`).join('   •   ');
  cell.font = { name: 'Arial', size: 12, bold: true, color: THEME.white };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: clr };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = thinBorder();
}

function setSectionLabel(sheet: ExcelJS.Worksheet, rowIndex: number, lastCol: number, text: string) {
  sheet.mergeCells(rowIndex, 1, rowIndex, lastCol);
  const row = sheet.getRow(rowIndex);
  row.height = 24;
  const cell = row.getCell(1);
  cell.value = text;
  cell.font = { name: 'Arial', size: 13, bold: true, color: THEME.white };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: THEME.headerDeep };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  cell.border = thinBorder();
}

function setColumnWidths(sheet: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });
}

/** Online paid orders: includes Order ID; no payment_status / transaction ref. */
function orderRowOnline(order: any, lang: Lang): (string | number)[] {
  const tickets = getOrderTicketsAndRevenue(order).tickets;
  const revenue = getOrderTicketsAndRevenue(order).revenue;
  const evt = order.events;
  const eventLabel = evt?.name
    ? `${evt.name}${evt.date ? ` (${String(evt.date).slice(0, 10)})` : ''}`
    : '—';
  return [
    order.order_number ?? '—',
    order.id,
    formatDt(order.created_at, lang),
    order.status ?? '—',
    safeStr(order.user_name, 200),
    safeStr(order.user_phone || order.phone, 80),
    safeStr(order.user_email || order.email, 120),
    safeStr(order.city, 80),
    safeStr(order.ville, 80),
    eventLabel,
    formatPasses(order),
    tickets,
    Math.round(revenue * 100) / 100,
    Number(order.total_price) || 0,
    order.payment_method ?? '—',
    order.source ?? '—',
    formatDt(order.completed_at, lang),
    safeStr(order.admin_notes, 300),
  ];
}

/** Ambassador cash orders: no Order ID column; no payment_status / transaction ref. */
function orderRowAmbassadorTable(order: any, lang: Lang): (string | number)[] {
  const tickets = getOrderTicketsAndRevenue(order).tickets;
  const evt = order.events;
  const eventLabel = evt?.name
    ? `${evt.name}${evt.date ? ` (${String(evt.date).slice(0, 10)})` : ''}`
    : '—';
  return [
    safeStr(order.ambassadors?.full_name, 120),
    safeStr(order.ambassadors?.phone, 40),
    order.order_number ?? '—',
    formatDt(order.created_at, lang),
    order.status ?? '—',
    safeStr(order.user_name, 200),
    safeStr(order.user_phone || order.phone, 80),
    safeStr(order.user_email || order.email, 120),
    safeStr(order.city, 80),
    safeStr(order.ville, 80),
    eventLabel,
    formatPasses(order),
    tickets,
    Number(order.total_price) || 0,
    order.payment_method ?? '—',
    order.source ?? '—',
    formatDt(order.completed_at, lang),
    safeStr(order.admin_notes, 300),
  ];
}

function onlineHeaders(lang: Lang): string[] {
  const L = COL[lang];
  return [
    L.orderNum,
    L.orderId,
    L.created,
    L.status,
    L.customer,
    L.phone,
    L.email,
    L.city,
    L.ville,
    L.event,
    L.passes,
    L.tickets,
    L.lineRevenue,
    L.totalPrice,
    L.paymentMethod,
    L.source,
    L.completed,
    L.adminNotes,
  ];
}

function ambassadorOrderHeaders(lang: Lang): string[] {
  const L = COL[lang];
  return [
    L.ambassador,
    L.ambPhone,
    L.orderNum,
    L.created,
    L.status,
    L.customer,
    L.phone,
    L.email,
    L.city,
    L.ville,
    L.event,
    L.passes,
    L.tickets,
    L.totalPrice,
    L.paymentMethod,
    L.source,
    L.completed,
    L.adminNotes,
  ];
}

function ambassadorSummaryHeaders(lang: Lang, passTypes: string[]): string[] {
  const c = COPY[lang];
  return [c.ambColAmbassador, c.ambColPhone, c.ambColOrders, ...passTypes, c.ambColTickets, c.ambColRevenue];
}

function buildAmbassadorSummaryRows(
  roster: { id: string; full_name: string; phone: string }[],
  aggMap: Map<string, AmbassadorAgg>,
  passTypes: string[],
  lang: Lang
): (string | number)[][] {
  const rows: (string | number)[][] = [];
  for (const a of roster) {
    const g = aggMap.get(a.id);
    const orders = g?.orders ?? 0;
    const tickets = g?.tickets ?? 0;
    const revenue = Math.round((g?.revenue ?? 0) * 100) / 100;
    const passCells = passTypes.map((pt) => g?.passesByType.get(pt) ?? 0);
    rows.push([a.full_name, a.phone, orders, ...passCells, tickets, revenue]);
  }
  if (aggMap.has('_none')) {
    const g = aggMap.get('_none')!;
    const passCells = passTypes.map((pt) => g.passesByType.get(pt) ?? 0);
    const unassigned = lang === 'fr' ? 'Non assigné' : 'Unassigned';
    rows.push([unassigned, '—', g.orders, ...passCells, g.tickets, Math.round(g.revenue * 100) / 100]);
  }
  return rows;
}

/**
 * Strip totals must match summing the sheet rows: each row shows line revenue rounded to 2 decimals,
 * so we accumulate per-order rounded cents — not round(sum of full-precision) once.
 */
function totalsLine(orders: any[]) {
  let tickets = 0;
  let revenueCents = 0;
  for (const o of orders) {
    tickets += getOrderTicketsAndRevenue(o).tickets;
    revenueCents += Math.round(getOrderReportRevenue(o) * 100);
  }
  return {
    count: orders.length,
    tickets,
    revenue: revenueCents / 100,
  };
}

function slugify(s: string) {
  return s.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'event';
}

const ADMIN_EXPORT_ROLES = new Set(['admin', 'super_admin']);

/** Only `admin` and `super_admin` may run the Excel export (UI should match). */
export function canDownloadReportsExcel(adminRole: string | null | undefined): boolean {
  return adminRole != null && ADMIN_EXPORT_ROLES.has(adminRole);
}

/**
 * Password to unprotect sheets in Excel (Review → Unprotect Sheet).
 * Override in production via VITE_REPORTS_EXCEL_LOCK_PASSWORD.
 */
function getWorkbookLockPassword(): string {
  const fromEnv = import.meta.env.VITE_REPORTS_EXCEL_LOCK_PASSWORD;
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }
  return 'AndiamoEventsReports';
}

async function protectWorkbookWorksheets(workbook: ExcelJS.Workbook, password: string): Promise<void> {
  const options: Partial<WorksheetProtection> = {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: false,
    insertHyperlinks: false,
    deleteColumns: false,
    deleteRows: false,
    sort: false,
    autoFilter: true,
    pivotTables: false,
    objects: false,
    scenarios: false,
  };
  for (const worksheet of workbook.worksheets) {
    await worksheet.protect(password, options);
  }
}

export async function downloadReportsExcel(params: {
  eventId: string | null;
  eventName: string | null;
  dateRange: DateRange;
  language?: Lang;
  /** Required: only admin and super_admin should call this (enforced here). */
  adminRole: string | null | undefined;
}) {
  const lang = params.language ?? 'en';
  if (!canDownloadReportsExcel(params.adminRole)) {
    throw new Error(
      lang === 'fr'
        ? 'Seuls les administrateurs peuvent télécharger ce rapport.'
        : 'Only administrators can download this report.'
    );
  }
  const c = COPY[lang];
  const orders = await fetchPaidOrdersForExport(params.eventId, params.dateRange);
  const { startDate, endDate } = getDateRangeFilter(params.dateRange);
  const periodLabel = getDateRangeLabel(params.dateRange);
  const eventLine = params.eventName
    ? `${c.event}: ${params.eventName}`
    : `${c.event}: ${c.allEvents}`;
  const metaBits = [
    eventLine,
    `${c.period}: ${periodLabel}${
      startDate && endDate
        ? ` (${startDate.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB')} – ${endDate.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB')})`
        : ''
    }`,
    `${c.genAt}: ${new Date().toLocaleString(lang === 'fr' ? 'fr-TN' : 'en-GB')}`,
  ];
  const subtitle = metaBits.join('  ·  ');

  const { online, ambassador: ambassadorRaw, pos } = splitOrders(orders);
  const ambassador = sortAmbassadorOrdersAlphabetically(ambassadorRaw, lang);
  const onlineTot = totalsLine(online);
  const ambTot = totalsLine(ambassador);
  const posTot = totalsLine(pos);
  const grandTot = totalsLine(orders);
  const aggMap = ambassadorAggregateMap(ambassador);
  const passTypes = await resolvePassTypeColumns(params.eventId, ambassador, lang);
  let roster = await fetchAmbassadorRosterForExport(params.eventId);
  const rosterIds = new Set(roster.map((x) => x.id));
  for (const [id, g] of aggMap) {
    if (id === '_none') continue;
    if (!rosterIds.has(id)) {
      roster.push({ id, full_name: g.name, phone: g.phone });
      rosterIds.add(id);
    }
  }
  const loc = lang === 'fr' ? 'fr' : 'en';
  roster = roster.sort((a, b) => a.full_name.localeCompare(b.full_name, loc, { sensitivity: 'base' }));
  const summaryRows = buildAmbassadorSummaryRows(roster, aggMap, passTypes, lang);

  let stockPassTypes: string[] = [];
  let onlineByPass = new Map<string, number>();
  let ambByPass = new Map<string, number>();
  let posByPass = new Map<string, number>();
  let passStockEventRows: PassStockSheetRow[] | null = null;
  if (params.eventId) {
    passStockEventRows = await fetchPassStockBreakdownForEvent(params.eventId);
  } else {
    stockPassTypes = await resolvePassTypesForStockSheet(null, online, ambassador, pos, lang);
    onlineByPass = accumulatePassesSoldByType(online);
    ambByPass = accumulatePassesSoldByType(ambassador);
    posByPass = accumulatePassesSoldByType(pos);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Andiamo Events';
  workbook.created = new Date();

  const lastColOnline = onlineHeaders(lang).length;
  const lastColAmbOrder = ambassadorOrderHeaders(lang).length;
  const sumColCount = ambassadorSummaryHeaders(lang, passTypes).length;
  const lastColAmbSheet = Math.max(lastColAmbOrder, sumColCount);
  const lastColSummary = 4;

  const wsSum = workbook.addWorksheet(c.summarySheet, {
    views: [{ state: 'frozen', ySplit: 6 }],
  });
  styleTitleRow(wsSum, 1, lastColSummary, c.workbookTitle, subtitle);
  let rSum = 3;
  wsSum.getRow(rSum).height = 8;
  rSum += 1;
  setSummaryStrip(
    wsSum,
    rSum,
    lastColSummary,
    [
      { label: c.totalOrders, value: String(grandTot.count) },
      { label: c.totalTickets, value: String(grandTot.tickets) },
      { label: c.totalRevenue, value: `${grandTot.revenue.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB')} ${c.tnd}` },
    ],
    'teal'
  );
  rSum += 1;
  wsSum.getRow(rSum).height = 6;
  rSum += 1;
  setHeaderRow(wsSum, rSum, [c.summaryColChannel, c.totalOrders, c.totalTickets, c.totalRevenue]);
  rSum += 1;
  const sumRows: (string | number)[][] = [
    [c.onlineSheet, onlineTot.count, onlineTot.tickets, Math.round(onlineTot.revenue * 100) / 100],
    [c.ambSheet, ambTot.count, ambTot.tickets, Math.round(ambTot.revenue * 100) / 100],
    [c.posSheet, posTot.count, posTot.tickets, Math.round(posTot.revenue * 100) / 100],
  ];
  sumRows.forEach((cells, i) => {
    setDataRow(wsSum, rSum, cells, i % 2 === 0, [1, 2, 3]);
    rSum += 1;
  });
  const sumTotRow: (string | number)[] = [
    c.summaryAllChannelsPaid,
    grandTot.count,
    grandTot.tickets,
    Math.round(grandTot.revenue * 100) / 100,
  ];
  setDataRow(wsSum, rSum, sumTotRow, true, [1, 2, 3]);
  const sumTotalRow = wsSum.getRow(rSum);
  for (let col = 1; col <= lastColSummary; col++) {
    const cell = sumTotalRow.getCell(col);
    cell.font = { name: 'Arial', size: 10, bold: true, color: THEME.white };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: THEME.primary };
    cell.border = thinBorder(THEME.primary);
  }
  rSum += 1;
  setColumnWidths(wsSum, [36, 14, 14, 22]);

  const wsOn = workbook.addWorksheet(c.onlineSheet, {
    views: [{ state: 'frozen', ySplit: 7 }],
  });

  styleTitleRow(wsOn, 1, lastColOnline, c.workbookTitle, subtitle);
  let r = 3;
  wsOn.getRow(r).height = 8;
  r += 1;

  setSummaryStrip(
    wsOn,
    r,
    lastColOnline,
    [
      { label: c.totalOrders, value: String(onlineTot.count) },
      { label: c.totalTickets, value: String(onlineTot.tickets) },
      { label: c.totalRevenue, value: `${onlineTot.revenue.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB')} ${c.tnd}` },
    ],
    'teal'
  );
  r += 1;
  wsOn.getRow(r).height = 6;
  r += 1;
  setSectionLabel(wsOn, r, lastColOnline, c.allOrders);
  r += 1;
  setHeaderRow(wsOn, r, onlineHeaders(lang));
  r += 1;

  const revCol = onlineHeaders(lang).indexOf(COL[lang].lineRevenue);
  online.forEach((order, i) => {
    setDataRow(wsOn, r, orderRowOnline(order, lang), i % 2 === 0, [revCol, revCol + 1]);
    r += 1;
  });

  setColumnWidths(wsOn, [
    10, 38, 18, 12, 22, 14, 28, 14, 14, 36, 42, 10, 14, 12, 14, 16, 18, 32,
  ]);

  const wsAm = workbook.addWorksheet(c.ambSheet, {
    views: [{ state: 'frozen', ySplit: 7 }],
  });

  styleTitleRow(wsAm, 1, lastColAmbSheet, c.workbookTitle, subtitle);
  r = 3;
  wsAm.getRow(r).height = 8;
  r += 1;

  setSummaryStrip(
    wsAm,
    r,
    lastColAmbSheet,
    [
      { label: c.totalOrders, value: String(ambTot.count) },
      { label: c.totalTickets, value: String(ambTot.tickets) },
      { label: c.totalRevenue, value: `${ambTot.revenue.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB')} ${c.tnd}` },
    ],
    'green'
  );
  r += 1;
  wsAm.getRow(r).height = 6;
  r += 1;
  setSectionLabel(wsAm, r, lastColAmbSheet, c.allOrders);
  r += 1;
  setHeaderRow(wsAm, r, ambassadorOrderHeaders(lang));
  r += 1;

  const hdr = ambassadorOrderHeaders(lang);
  const totColAm = hdr.indexOf(COL[lang].totalPrice);
  ambassador.forEach((order, i) => {
    setDataRow(wsAm, r, orderRowAmbassadorTable(order, lang), i % 2 === 0, [0, 1, totColAm]);
    r += 1;
  });

  r += 1;
  wsAm.getRow(r).height = 8;
  r += 1;
  setSectionLabel(wsAm, r, lastColAmbSheet, c.byAmbassador);
  r += 1;
  setHeaderRow(wsAm, r, ambassadorSummaryHeaders(lang, passTypes));
  r += 1;

  const nPass = passTypes.length;
  const ticketIdx = 3 + nPass;
  const revIdx = 4 + nPass;
  const summaryHighlights = [2, ticketIdx, revIdx, ...Array.from({ length: nPass }, (_, i) => 3 + i)];

  summaryRows.forEach((cells, i) => {
    setDataRow(wsAm, r, cells, i % 2 === 0, summaryHighlights);
    r += 1;
  });

  const totOrdersAmb = summaryRows.reduce((s, row) => s + Number(row[2]), 0);
  const passTotals = passTypes.map((_, i) => summaryRows.reduce((s, row) => s + Number(row[3 + i]), 0));
  const totTicketsAmb = summaryRows.reduce((s, row) => s + Number(row[ticketIdx]), 0);
  const totRevAmb =
    Math.round(summaryRows.reduce((s, row) => s + Number(row[revIdx]), 0) * 100) / 100;
  const totalCells = ['TOTAL', '—', totOrdersAmb, ...passTotals, totTicketsAmb, totRevAmb];
  setDataRow(wsAm, r, totalCells, true, summaryHighlights);
  const totalRow = wsAm.getRow(r);
  for (let col = 1; col <= totalCells.length; col++) {
    const cell = totalRow.getCell(col);
    cell.font = { name: 'Arial', size: 10, bold: true, color: THEME.white };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: THEME.primary };
    cell.border = thinBorder(THEME.primary);
  }
  r += 1;

  const ambOrderWidths = [20, 14, 10, 18, 12, 22, 14, 28, 14, 14, 36, 42, 10, 12, 14, 16, 18, 32];
  const ambWidths = [...ambOrderWidths];
  while (ambWidths.length < sumColCount) {
    ambWidths.push(12);
  }
  setColumnWidths(wsAm, ambWidths);

  const wsPos = workbook.addWorksheet(c.posSheet, {
    views: [{ state: 'frozen', ySplit: 7 }],
  });

  styleTitleRow(wsPos, 1, lastColOnline, c.workbookTitle, subtitle);
  r = 3;
  wsPos.getRow(r).height = 8;
  r += 1;

  setSummaryStrip(
    wsPos,
    r,
    lastColOnline,
    [
      { label: c.totalOrders, value: String(posTot.count) },
      { label: c.totalTickets, value: String(posTot.tickets) },
      { label: c.totalRevenue, value: `${posTot.revenue.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB')} ${c.tnd}` },
    ],
    'green'
  );
  r += 1;
  wsPos.getRow(r).height = 6;
  r += 1;
  setSectionLabel(wsPos, r, lastColOnline, c.allOrders);
  r += 1;
  setHeaderRow(wsPos, r, onlineHeaders(lang));
  r += 1;

  const revColPos = onlineHeaders(lang).indexOf(COL[lang].lineRevenue);
  pos.forEach((order, i) => {
    setDataRow(wsPos, r, orderRowOnline(order, lang), i % 2 === 0, [revColPos, revColPos + 1]);
    r += 1;
  });

  setColumnWidths(wsPos, [
    10, 38, 18, 12, 22, 14, 28, 14, 14, 36, 42, 10, 14, 12, 14, 16, 18, 32,
  ]);

  // --- Passes stock: event → same basis as Pass Stock Management; all-events → paid orders in period by pass_type string ---
  const wsStock = workbook.addWorksheet(c.passesStockSheet, {
    views: [{ state: 'frozen', ySplit: 8 }],
  });
  let rs = 3;
  if (passStockEventRows) {
    const lastColStock = 5;
    const totO = passStockEventRows.reduce((s, r) => s + r.online, 0);
    const totA = passStockEventRows.reduce((s, r) => s + r.ambassador, 0);
    const totOther = passStockEventRows.reduce((s, r) => s + r.other, 0);
    const totSoldQty = passStockEventRows.reduce((s, r) => s + r.total, 0);
    styleTitleRow(wsStock, 1, lastColStock, c.workbookTitle, subtitle);
    wsStock.getRow(rs).height = 8;
    rs += 1;
    setSummaryStrip(
      wsStock,
      rs,
      lastColStock,
      [
        { label: c.stockStripOnline, value: String(totO) },
        { label: c.stockStripAmbassador, value: String(totA) },
        { label: c.stockStripOther, value: String(totOther) },
        { label: c.stockStripAll, value: String(totSoldQty) },
      ],
      'teal'
    );
    rs += 1;
    wsStock.getRow(rs).height = 6;
    rs += 1;
    setSectionLabel(wsStock, rs, lastColStock, c.stockSection);
    rs += 1;
    wsStock.mergeCells(rs, 1, rs, lastColStock);
    const noteRowEv = wsStock.getRow(rs);
    noteRowEv.height = 20;
    const noteCellEv = noteRowEv.getCell(1);
    noteCellEv.value = c.stockPaidOnlyNoteEvent;
    noteCellEv.font = { name: 'Arial', size: 9, italic: true, color: THEME.muted };
    noteCellEv.fill = { type: 'pattern', pattern: 'solid', fgColor: THEME.dark };
    noteCellEv.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    noteCellEv.border = thinBorder();
    rs += 1;
    setHeaderRow(wsStock, rs, [
      c.passType,
      c.soldOnline,
      c.soldAmbassador,
      c.soldOtherChannels,
      c.soldTotal,
    ]);
    rs += 1;
    const stockHighlightsEv = [1, 2, 3, 4, 5];
    passStockEventRows.forEach((row, i) => {
      setDataRow(
        wsStock,
        rs,
        [row.name, row.online, row.ambassador, row.other, row.total],
        i % 2 === 0,
        stockHighlightsEv
      );
      rs += 1;
    });
    const stockTotalCellsEv: (string | number)[] = ['TOTAL', totO, totA, totOther, totSoldQty];
    setDataRow(wsStock, rs, stockTotalCellsEv, true, stockHighlightsEv);
    const stockTotalRowEv = wsStock.getRow(rs);
    for (let col = 1; col <= lastColStock; col++) {
      const cell = stockTotalRowEv.getCell(col);
      cell.font = { name: 'Arial', size: 10, bold: true, color: THEME.white };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: THEME.primary };
      cell.border = thinBorder(THEME.primary);
    }
    rs += 1;
    setColumnWidths(wsStock, [42, 16, 18, 22, 18]);
  } else {
    const lastColStock = 5;
    const totalOnlinePassesQty = [...onlineByPass.values()].reduce((a, b) => a + b, 0);
    const totalAmbPassesQty = [...ambByPass.values()].reduce((a, b) => a + b, 0);
    const totalPosPassesQty = [...posByPass.values()].reduce((a, b) => a + b, 0);
    styleTitleRow(wsStock, 1, lastColStock, c.workbookTitle, subtitle);
    wsStock.getRow(rs).height = 8;
    rs += 1;
    setSummaryStrip(
      wsStock,
      rs,
      lastColStock,
      [
        { label: c.stockStripOnline, value: String(totalOnlinePassesQty) },
        { label: c.stockStripAmbassador, value: String(totalAmbPassesQty) },
        { label: c.stockStripOther, value: String(totalPosPassesQty) },
        { label: c.stockStripAll, value: String(totalOnlinePassesQty + totalAmbPassesQty + totalPosPassesQty) },
      ],
      'teal'
    );
    rs += 1;
    wsStock.getRow(rs).height = 6;
    rs += 1;
    setSectionLabel(wsStock, rs, lastColStock, c.stockSection);
    rs += 1;
    wsStock.mergeCells(rs, 1, rs, lastColStock);
    const noteRow = wsStock.getRow(rs);
    noteRow.height = 20;
    const noteCell = noteRow.getCell(1);
    noteCell.value = c.stockPaidOnlyNote;
    noteCell.font = { name: 'Arial', size: 9, italic: true, color: THEME.muted };
    noteCell.fill = { type: 'pattern', pattern: 'solid', fgColor: THEME.dark };
    noteCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    noteCell.border = thinBorder();
    rs += 1;
    setHeaderRow(wsStock, rs, [
      c.passType,
      c.soldOnline,
      c.soldAmbassador,
      c.soldOtherChannels,
      c.soldTotal,
    ]);
    rs += 1;
    const stockHighlights = [1, 2, 3, 4, 5];
    stockPassTypes.forEach((pt, i) => {
      const oq = onlineByPass.get(pt) ?? 0;
      const aq = ambByPass.get(pt) ?? 0;
      const pq = posByPass.get(pt) ?? 0;
      setDataRow(wsStock, rs, [pt, oq, aq, pq, oq + aq + pq], i % 2 === 0, stockHighlights);
      rs += 1;
    });
    const totO = stockPassTypes.reduce((s, pt) => s + (onlineByPass.get(pt) ?? 0), 0);
    const totA = stockPassTypes.reduce((s, pt) => s + (ambByPass.get(pt) ?? 0), 0);
    const totP = stockPassTypes.reduce((s, pt) => s + (posByPass.get(pt) ?? 0), 0);
    const stockTotalCells: (string | number)[] = ['TOTAL', totO, totA, totP, totO + totA + totP];
    setDataRow(wsStock, rs, stockTotalCells, true, stockHighlights);
    const stockTotalRow = wsStock.getRow(rs);
    for (let col = 1; col <= lastColStock; col++) {
      const cell = stockTotalRow.getCell(col);
      cell.font = { name: 'Arial', size: 10, bold: true, color: THEME.white };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: THEME.primary };
      cell.border = thinBorder(THEME.primary);
    }
    rs += 1;
    setColumnWidths(wsStock, [42, 16, 18, 22, 18]);
  }

  try {
    await protectWorkbookWorksheets(workbook, getWorkbookLockPassword());
  } catch (e) {
    console.warn('[reportsExcelExport] Worksheet protection failed:', e);
  }

  const buf = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const name = `Andiamo_Report_${params.eventId ? slugify(params.eventName || 'event') : 'all_events'}_${periodLabel.replace(/\s+/g, '_')}_${Date.now()}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
