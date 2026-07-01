import { describe, expect, it } from 'vitest';
import { mapPublicError, mapThrownError } from './mapPublicError';
import { PUBLIC_ERROR_CODES } from './publicErrorCodes';
import { isLikelyInternalErrorText } from './internalErrorPatterns';

describe('isLikelyInternalErrorText', () => {
  it('flags dev/config strings', () => {
    expect(
      isLikelyInternalErrorText(
        'Check that SUPABASE_URL / SUPABASE_ANON_KEY match VITE_SUPABASE_* in .env'
      )
    ).toBe(true);
    expect(isLikelyInternalErrorText('Presale requires SUPABASE_SERVICE_ROLE_KEY')).toBe(true);
    expect(isLikelyInternalErrorText('Pass f831c0f8-d0b3-4000-8c98-cb0a38aace8e not found')).toBe(true);
  });

  it('allows user-safe stock messages', () => {
    expect(
      isLikelyInternalErrorText('Only 2 VIP pass(es) available, requested 5')
    ).toBe(false);
  });
});

describe('mapPublicError', () => {
  it('maps stable error codes', () => {
    const r = mapPublicError({ error: 'passes_unavailable' }, 'en');
    expect(r.code).toBe(PUBLIC_ERROR_CODES.PASSES_UNAVAILABLE);
    expect(r.title).toContain('ticket');
    expect(r.description).not.toMatch(/supabase/i);
  });

  it('hides SUPABASE dev toast text', () => {
    const r = mapPublicError(
      {
        message:
          'Passes could not be loaded (event not found on server). Check that SUPABASE_URL / SUPABASE_ANON_KEY match VITE_SUPABASE_* in .env, then restart the API.',
      },
      'en'
    );
    expect(r.description).not.toMatch(/supabase|\.env|restart/i);
    expect(r.code).toBe(PUBLIC_ERROR_CODES.PASSES_UNAVAILABLE);
  });

  it('maps presale reason codes', () => {
    const r = mapPublicError({ reason: 'code_not_found' }, 'fr');
    expect(r.code).toBe(PUBLIC_ERROR_CODES.PRESALE_CODE_INVALID);
    expect(r.title).toMatch(/prévente/i);
  });

  it('maps code_exhausted to Instagram DM message', () => {
    const r = mapPublicError({ reason: 'code_exhausted' }, 'en');
    expect(r.code).toBe(PUBLIC_ERROR_CODES.PRESALE_CODE_EXHAUSTED);
    expect(r.description).toBe(
      'This presale code is no longer available. Please DM us on Instagram for a new code.'
    );
  });

  it('keeps invalid presale message for code_not_found', () => {
    const r = mapPublicError({ reason: 'code_not_found' }, 'en');
    expect(r.code).toBe(PUBLIC_ERROR_CODES.PRESALE_CODE_INVALID);
    expect(r.description).toBe("That presale code isn't valid. Check it and try again.");
  });

  it('keeps invalid presale message for code_expired', () => {
    const r = mapPublicError({ reason: 'code_expired' }, 'en');
    expect(r.code).toBe(PUBLIC_ERROR_CODES.PRESALE_CODE_INVALID);
    expect(r.description).toBe("That presale code isn't valid. Check it and try again.");
  });

  it('keeps invalid presale message for code_not_active_yet', () => {
    const r = mapPublicError({ reason: 'code_not_active_yet' }, 'en');
    expect(r.code).toBe(PUBLIC_ERROR_CODES.PRESALE_CODE_INVALID);
    expect(r.description).toBe("That presale code isn't valid. Check it and try again.");
  });

  it('preserves safe stock detail from API message', () => {
    const r = mapPublicError(
      {
        error: 'insufficient_stock',
        message: 'Only 1 Standard pass(es) available, requested 3',
      },
      'en'
    );
    expect(r.description).toContain('Only 1 Standard');
  });

  it('maps network errors', () => {
    const r = mapPublicError({ message: 'Failed to fetch' }, 'en');
    expect(r.code).toBe(PUBLIC_ERROR_CODES.NETWORK);
    expect(r.title).toBe('Unable to load this page');
    expect(r.description).toMatch(/reload the page/i);
  });

  it('maps thrown errors with code', () => {
    const err = Object.assign(new Error('details hidden'), { code: 'invalid_promo_code' });
    const r = mapThrownError(err, 'en');
    expect(r.code).toBe(PUBLIC_ERROR_CODES.INVALID_PROMO_CODE);
  });
});
