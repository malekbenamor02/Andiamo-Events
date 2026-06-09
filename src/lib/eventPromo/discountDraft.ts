import type { EventPass } from '@/pages/admin/types';

export type PassDiscountDraft = {
  discount_type: 'percent' | 'fixed';
  discount_value: string;
};

export type PromoDiscountEditDraft = {
  discount_mode: 'uniform' | 'per_pass';
  discount_type: 'percent' | 'fixed';
  discount_value: string;
  per_pass: Record<string, PassDiscountDraft>;
};

export type EventPromoPassDiscountRow = {
  event_pass_id: string;
  pass_name: string | null;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
};

export type EventPromoCodeAdminRow = {
  id: string;
  code: string;
  badge_color?: string;
  discount_mode: 'uniform' | 'per_pass';
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  applies_to_all?: boolean;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  pass_discounts?: EventPromoPassDiscountRow[];
};

export function emptyPerPassDrafts(passes: EventPass[]): Record<string, PassDiscountDraft> {
  const out: Record<string, PassDiscountDraft> = {};
  for (const p of passes) {
    if (p.id) {
      out[p.id] = { discount_type: 'percent', discount_value: '' };
    }
  }
  return out;
}

export function discountEditDraftFromCode(
  c: EventPromoCodeAdminRow,
  passes: EventPass[]
): PromoDiscountEditDraft {
  const per_pass = emptyPerPassDrafts(passes);
  for (const row of c.pass_discounts || []) {
    if (per_pass[row.event_pass_id]) {
      per_pass[row.event_pass_id] = {
        discount_type: row.discount_type,
        discount_value: String(row.discount_value),
      };
    }
  }
  return {
    discount_mode: c.discount_mode === 'per_pass' ? 'per_pass' : 'uniform',
    discount_type: c.discount_type === 'fixed' ? 'fixed' : 'percent',
    discount_value: String(c.discount_value),
    per_pass,
  };
}

export function buildPassDiscountPayload(
  mode: 'uniform' | 'per_pass',
  perPass: Record<string, PassDiscountDraft>
): { event_pass_id: string; discount_type: string; discount_value: number }[] {
  if (mode !== 'per_pass') return [];
  return Object.entries(perPass)
    .map(([event_pass_id, row]) => {
      const val = parseFloat(String(row.discount_value).trim());
      if (!Number.isFinite(val) || val <= 0) return null;
      return {
        event_pass_id,
        discount_type: row.discount_type,
        discount_value: val,
      };
    })
    .filter((r): r is { event_pass_id: string; discount_type: string; discount_value: number } =>
      r != null
    );
}
