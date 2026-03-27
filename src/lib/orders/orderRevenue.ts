import type { OrderPass } from '@/types/orders';
import { PaymentMethod } from '@/lib/constants/orderStatuses';

/**
 * Revenue and ticket count from line items when present; otherwise total_price / total.
 * Matches Reports & Analytics (useAnalytics) so overview and dashboards stay consistent.
 */
export function getOrderTicketsAndRevenue(order: {
  order_passes?: OrderPass[] | null;
  passes?: Array<{ quantity?: number; price?: number }> | null;
  quantity?: number | null;
  total_price?: number | string | null;
  total?: number | string | null;
  pass_type?: string | null;
}): { tickets: number; revenue: number } {
  const passes = order.order_passes;
  if (passes && Array.isArray(passes) && passes.length > 0) {
    let revenue = 0;
    let tickets = 0;
    passes.forEach((op) => {
      const q = op.quantity || 0;
      tickets += q;
      revenue += (op.price || 0) * q;
    });
    return { tickets, revenue };
  }

  const legacy = order.passes;
  if (legacy && Array.isArray(legacy) && legacy.length > 0) {
    let revenue = 0;
    let tickets = 0;
    legacy.forEach((op) => {
      const q = op.quantity || 0;
      tickets += q;
      revenue += (Number(op.price) || 0) * q;
    });
    return { tickets, revenue };
  }

  const tickets = order.quantity || 0;
  const fromPrice = Number(order.total_price);
  const fromTotal = Number(order.total);
  const revenue = Number.isFinite(fromPrice)
    ? fromPrice
    : Number.isFinite(fromTotal)
      ? fromTotal
      : 0;
  return { tickets, revenue };
}

export function getOrderLineRevenue(order: Parameters<typeof getOrderTicketsAndRevenue>[0]): number {
  return getOrderTicketsAndRevenue(order).revenue;
}

/** Parse `notes.payment_fees` when present (same shape as admin order dialogs). */
export function getPaymentFeesFromNotes(order: { notes?: string | Record<string, unknown> | null }): {
  subtotal?: number;
  fee_amount?: number;
  total_with_fees?: number;
} | null {
  if (order.notes == null || order.notes === '') return null;
  try {
    const notesData =
      typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
    const f = (notesData as Record<string, unknown>)?.payment_fees as
      | { subtotal?: number; fee_amount?: number; total_with_fees?: number }
      | undefined;
    if (!f) return null;
    return {
      subtotal: typeof f.subtotal === 'number' ? f.subtotal : undefined,
      fee_amount: typeof f.fee_amount === 'number' ? f.fee_amount : undefined,
      total_with_fees: typeof f.total_with_fees === 'number' ? f.total_with_fees : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Revenue for KPIs, exports, and channel totals.
 * Paid online: amount including payment fees (`total_with_fees`, notes, or line subtotal × 1.05).
 * Pending online: line subtotal only (fees not applied until paid).
 * Other methods (e.g. ambassador cash): same as {@link getOrderLineRevenue}.
 */
export function getOrderReportRevenue(order: {
  payment_method?: string | null;
  payment_status?: string | null;
  status?: string | null;
  total_with_fees?: number | string | null;
  total_price?: number | string | null;
  notes?: string | Record<string, unknown> | null;
  order_passes?: OrderPass[] | null;
  passes?: Array<{ quantity?: number; price?: number }> | null;
  quantity?: number | null;
  total?: number | string | null;
  pass_type?: string | null;
}): number {
  const line = getOrderLineRevenue(order);
  if (order.payment_method !== PaymentMethod.ONLINE) {
    return line;
  }

  const paidOnline =
    order.payment_status === 'PAID' || order.status === 'PAID' || order.status === 'COMPLETED';
  if (!paidOnline) {
    return line;
  }

  const twf = Number(order.total_with_fees);
  if (Number.isFinite(twf)) {
    return twf;
  }

  const fromNotes = getPaymentFeesFromNotes(order);
  if (fromNotes?.total_with_fees != null) {
    return fromNotes.total_with_fees;
  }

  if (line > 0) {
    return Number((line * 1.05).toFixed(2));
  }

  const tp = Number(order.total_price);
  return Number.isFinite(tp) ? tp : line;
}
