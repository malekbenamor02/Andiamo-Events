import type { EventPromoCodeAdminRow } from './discountDraft';

export function formatEventPromoCodeDiscountSummary(
  c: Pick<
    EventPromoCodeAdminRow,
    'discount_mode' | 'discount_type' | 'discount_value' | 'pass_discounts'
  >,
  language: 'en' | 'fr'
): string {
  const isEn = language === 'en';
  if (c.discount_mode === 'per_pass') {
    const n = (c.pass_discounts || []).filter((p) => p.discount_value > 0).length;
    if (n === 0) {
      return isEn ? 'Per pass (none configured)' : 'Par pass (aucune configurée)';
    }
    return isEn ? `Per pass (${n} rules)` : `Par pass (${n} règles)`;
  }
  if (c.discount_type === 'percent') {
    return isEn ? `${c.discount_value}% off` : `-${c.discount_value}%`;
  }
  return isEn ? `${c.discount_value} TND / pass` : `${c.discount_value} TND / pass`;
}

export type PromoPassBreakdownRow = {
  pass_id?: string;
  pass_name?: string;
  discount_type?: string;
  discount_value?: number;
};

export function formatPromoPassBreakdownRule(
  row: PromoPassBreakdownRow,
  language: 'en' | 'fr'
): string {
  const label = row.pass_name || row.pass_id || (language === 'en' ? 'Pass' : 'Pass');
  if (row.discount_type === 'percent' && row.discount_value != null) {
    return `${label}: ${Number(row.discount_value).toFixed(0)}%`;
  }
  if (row.discount_value != null) {
    return `${label}: ${Number(row.discount_value).toFixed(2)} TND`;
  }
  return label;
}
