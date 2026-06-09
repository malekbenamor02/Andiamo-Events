import { describe, expect, it } from 'vitest';
import { isPromoBadgeColor, resolvePromoBadgeColor } from './promoOrder';

describe('resolvePromoBadgeColor', () => {
  it('uses stored badge_color from promo snapshot', () => {
    expect(
      resolvePromoBadgeColor({ badge_color: '#16a34a' }, null)
    ).toBe('#16a34a');
  });

  it('uses joined event_promo_codes when snapshot has no color', () => {
    expect(
      resolvePromoBadgeColor(
        { code: 'GOOBA' },
        { event_promo_codes: { badge_color: '#2563eb' } }
      )
    ).toBe('#2563eb');
  });

  it('does not derive color from code name', () => {
    expect(resolvePromoBadgeColor({ code: 'CHABIBA' }, null)).toBe('#e11d48');
    expect(resolvePromoBadgeColor({ code: 'GOOBA' }, null)).toBe('#e11d48');
  });
});

describe('isPromoBadgeColor', () => {
  it('accepts palette values only', () => {
    expect(isPromoBadgeColor('#7c3aed')).toBe(true);
    expect(isPromoBadgeColor('#ffffff')).toBe(false);
  });
});
