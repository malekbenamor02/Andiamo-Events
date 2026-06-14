import { describe, expect, it } from 'vitest';
import { buildFbcFromFbclid, isValidFbc } from './attribution';

describe('buildFbcFromFbclid', () => {
  it('creates Meta-compatible fbc from fbclid', () => {
    const fbc = buildFbcFromFbclid('TEST_FBCLID_123', 1_700_000_000_000);
    expect(fbc).toBe('fb.1.1700000000000.TEST_FBCLID_123');
    expect(isValidFbc(fbc)).toBe(true);
  });

  it('trims fbclid whitespace', () => {
    const fbc = buildFbcFromFbclid('  ABC  ', 1000);
    expect(fbc).toBe('fb.1.1000.ABC');
  });
});

describe('isValidFbc', () => {
  it('accepts valid Meta fbc values', () => {
    expect(isValidFbc('fb.1.1700000000000.TEST_FBCLID_123')).toBe(true);
  });

  it('rejects invalid values', () => {
    expect(isValidFbc('')).toBe(false);
    expect(isValidFbc('not-fbc')).toBe(false);
    expect(isValidFbc('fb.2.123.abc')).toBe(false);
  });
});
