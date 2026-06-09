import { formatEventPromoCodeDiscountSummary } from './discountPolicy';

/** Palette for promo badges (colors are assigned randomly in DB per code, not from the code name). */
export const PROMO_BADGE_PALETTE = [
  '#e11d48',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0891b2',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#0d9488',
  '#4f46e5',
] as const;

const PALETTE_SET = new Set<string>(PROMO_BADGE_PALETTE);

export function isPromoBadgeColor(value: unknown): value is string {
  return typeof value === 'string' && PALETTE_SET.has(value);
}

export type PromoPassBreakdownRow = {
  pass_id?: string;
  pass_name?: string;
  discount_type?: string;
  discount_value?: number;
  unit_list?: number;
  unit_discounted?: number;
  quantity?: number;
};

export type PromoOrderSnapshot = {
  code_id?: string;
  code?: string;
  /** Stored on the promo code at creation; copied into order notes. */
  badge_color?: string;
  discount_mode?: 'uniform' | 'per_pass';
  discount_type?: string;
  discount_value?: number;
  original_subtotal?: number;
  discounted_subtotal?: number;
  discount_amount?: number;
  uses_claimed?: number;
  pass_breakdown?: PromoPassBreakdownRow[];
};

type PromoColorSource = {
  badge_color?: string | null;
  event_promo_codes?: { badge_color?: string | null } | { badge_color?: string | null }[] | null;
};

/** Resolve display color from stored DB value (never from code string). */
export function resolvePromoBadgeColor(
  promo: { badge_color?: string | null } | null | undefined,
  order?: PromoColorSource | null
): string {
  if (promo?.badge_color && isPromoBadgeColor(promo.badge_color)) {
    return promo.badge_color;
  }
  const joined = order?.event_promo_codes;
  if (joined && typeof joined === 'object') {
    const row = Array.isArray(joined) ? joined[0] : joined;
    if (row?.badge_color && isPromoBadgeColor(row.badge_color)) {
      return row.badge_color;
    }
  }
  return PROMO_BADGE_PALETTE[0];
}

/** @deprecated Use resolvePromoBadgeColor with stored badge_color */
export function getPromoBadgeColor(_code: string): string {
  return PROMO_BADGE_PALETTE[0];
}

export function parsePromoOrderSnapshot(raw: unknown): PromoOrderSnapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  const badgeColor = typeof p.badge_color === 'string' ? p.badge_color : undefined;
  return {
    code_id: typeof p.code_id === 'string' ? p.code_id : undefined,
    code: typeof p.code === 'string' ? p.code : undefined,
    badge_color: isPromoBadgeColor(badgeColor) ? badgeColor : undefined,
    discount_type: typeof p.discount_type === 'string' ? p.discount_type : undefined,
    discount_value: typeof p.discount_value === 'number' ? p.discount_value : undefined,
    original_subtotal:
      typeof p.original_subtotal === 'number' ? p.original_subtotal : undefined,
    discounted_subtotal:
      typeof p.discounted_subtotal === 'number' ? p.discounted_subtotal : undefined,
    discount_amount: typeof p.discount_amount === 'number' ? p.discount_amount : undefined,
    uses_claimed: typeof p.uses_claimed === 'number' ? p.uses_claimed : undefined,
    discount_mode: p.discount_mode === 'per_pass' ? 'per_pass' : 'uniform',
    pass_breakdown: Array.isArray(p.pass_breakdown)
      ? (p.pass_breakdown as Record<string, unknown>[]).map((row) => ({
          pass_id: typeof row.pass_id === 'string' ? row.pass_id : undefined,
          pass_name: typeof row.pass_name === 'string' ? row.pass_name : undefined,
          discount_type: typeof row.discount_type === 'string' ? row.discount_type : undefined,
          discount_value:
            typeof row.discount_value === 'number' ? row.discount_value : undefined,
        }))
      : undefined,
  };
}

export function parsePromoFromOrder(order: {
  notes?: string | Record<string, unknown> | null;
}): PromoOrderSnapshot | null {
  try {
    const rawNotes = order?.notes;
    if (rawNotes == null || rawNotes === '') return null;
    const notesData =
      typeof rawNotes === 'string' ? JSON.parse(rawNotes) : rawNotes;
    if (!notesData || typeof notesData !== 'object') return null;
    return parsePromoOrderSnapshot((notesData as Record<string, unknown>).promo);
  } catch {
    return null;
  }
}

export function orderHasPromoAttribution(order: {
  event_promo_code_id?: string | null;
  notes?: string | Record<string, unknown> | null;
}): boolean {
  if (order.event_promo_code_id) return true;
  const promo = parsePromoFromOrder(order);
  return !!(promo?.code || promo?.code_id);
}

export function formatPromoOrderDiscountLabel(
  snapshot: PromoOrderSnapshot | null,
  language: 'en' | 'fr'
): string | null {
  if (!snapshot) return null;
  if (snapshot.discount_mode === 'per_pass') {
    return language === 'en' ? 'Per pass' : 'Par pass';
  }
  if (snapshot.discount_value == null) return null;
  if (snapshot.discount_type === 'percent') {
    return `${Number(snapshot.discount_value).toFixed(0)}%`;
  }
  return `${Number(snapshot.discount_value).toFixed(2)} TND`;
}

export { formatEventPromoCodeDiscountSummary as formatPromoCodeDiscountSummary };
