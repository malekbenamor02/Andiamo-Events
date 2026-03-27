import type { OrderPass } from '@/types/orders';

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
