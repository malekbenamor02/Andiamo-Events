import { describe, expect, it } from 'vitest';
import { ACADEMY_FORMULAS } from '@/data/academyContent';
import type { AcademyFormulaId } from '@/types/academy';

/** Authoritative server prices — keep in sync with api/_lib/academy-pricing.cjs */
const SERVER_FORMULA_PRICES_DT: Record<AcademyFormulaId, number> = {
  essentielle: 850,
  pro: 1100,
  premium: 2500,
};

describe('academy pricing sync', () => {
  it('keeps display prices aligned with server-side authoritative prices', () => {
    for (const formula of ACADEMY_FORMULAS) {
      expect(formula.priceDt).toBe(SERVER_FORMULA_PRICES_DT[formula.id]);
    }
  });
});
