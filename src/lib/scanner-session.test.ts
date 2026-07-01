import { describe, expect, it } from 'vitest';
import { isAuthenticatedScannerSession, isValidScannerSession } from './scanner-session';

describe('isValidScannerSession', () => {
  it('accepts flat scanner session API shape', () => {
    expect(
      isValidScannerSession({
        id: 'scanner-id',
        name: 'Test',
        email: 'x@test.com',
        role: 'scanner',
      }),
    ).toBe(true);
  });

  it('accepts flat supervisor session API shape', () => {
    expect(
      isValidScannerSession({
        id: 'supervisor-id',
        name: 'Boss',
        email: 'boss@test.com',
        role: 'supervisor',
      }),
    ).toBe(true);
  });

  it('accepts wrapped scanner session shape', () => {
    expect(
      isValidScannerSession({
        scanner: { id: 'scanner-id', role: 'scanner' },
      }),
    ).toBe(true);
  });

  it('rejects missing id', () => {
    expect(isValidScannerSession({ name: 'Test', role: 'scanner' })).toBe(false);
    expect(isValidScannerSession({ id: '', role: 'scanner' })).toBe(false);
  });

  it('rejects invalid role', () => {
    expect(
      isValidScannerSession({ id: 'scanner-id', role: 'superviseur' }),
    ).toBe(false);
    expect(
      isValidScannerSession({ id: 'scanner-id', role: 'admin' }),
    ).toBe(false);
  });
});

describe('isAuthenticatedScannerSession', () => {
  const flatScanner = {
    id: 'scanner-id',
    name: 'Test',
    email: 'x@test.com',
    role: 'scanner' as const,
  };

  it('requires ok response status', () => {
    expect(isAuthenticatedScannerSession(false, flatScanner)).toBe(false);
    expect(isAuthenticatedScannerSession(true, flatScanner)).toBe(true);
  });

  it('rejects ok response with invalid session body', () => {
    expect(isAuthenticatedScannerSession(true, { id: 'x', role: 'invalid' })).toBe(false);
  });
});
