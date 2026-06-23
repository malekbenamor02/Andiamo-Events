import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { buildFbcFromFbclid, isValidFbc, getMetaAttributionContext } from './attribution';

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

describe('getMetaAttributionContext', () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        clear: () => storage.clear(),
      },
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        cookie: '_fbp=fb.1.testbp; _fbc=fb.1.1700000000000.clid',
      },
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: { href: 'https://example.com/ambassador', search: '' },
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: originalDocument,
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  });

  it('reads fbp and fbc from cookies', () => {
    const ctx = getMetaAttributionContext();
    expect(ctx.fbp).toBe('fb.1.testbp');
    expect(ctx.fbc).toBe('fb.1.1700000000000.clid');
    expect(ctx.eventSourceUrl).toBe('https://example.com/ambassador');
  });
});
