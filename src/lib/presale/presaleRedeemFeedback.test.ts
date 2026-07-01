import { describe, expect, it } from 'vitest';
import {
  isPresaleInlineRedeemReason,
  presaleInlineErrorVariantForReason,
  resolvePresaleRedeemFailure,
} from './presaleRedeemFeedback';
const EXHAUSTED_MSG =
  'This presale code is no longer available. Please DM us on Instagram for a new code.';
const INVALID_MSG = "That presale code isn't valid. Check it and try again.";

describe('resolvePresaleRedeemFailure', () => {
  it('maps code_exhausted to inline warning with Instagram DM message', () => {
    const r = resolvePresaleRedeemFailure('en', 'code_exhausted', undefined);
    expect(r.type).toBe('inline');
    if (r.type !== 'inline') return;
    expect(r.error.variant).toBe('warning');
    expect(r.error.reason).toBe('code_exhausted');
    expect(r.error.message).toBe(EXHAUSTED_MSG);
  });

  it('maps code_not_found to inline error with invalid message', () => {
    const r = resolvePresaleRedeemFailure('en', 'code_not_found', undefined);
    expect(r.type).toBe('inline');
    if (r.type !== 'inline') return;
    expect(r.error.variant).toBe('error');
    expect(r.error.message).toBe(INVALID_MSG);
  });

  it('maps code_expired to inline error with invalid message', () => {
    const r = resolvePresaleRedeemFailure('en', 'code_expired', undefined);
    expect(r.type).toBe('inline');
    if (r.type !== 'inline') return;
    expect(r.error.variant).toBe('error');
    expect(r.error.message).toBe(INVALID_MSG);
  });

  it('maps code_not_active_yet to inline error with invalid message', () => {
    const r = resolvePresaleRedeemFailure('en', 'code_not_active_yet', undefined);
    expect(r.type).toBe('inline');
    if (r.type !== 'inline') return;
    expect(r.error.variant).toBe('error');
    expect(r.error.message).toBe(INVALID_MSG);
  });

  it('uses destructive toast for rate_limited', () => {
    const r = resolvePresaleRedeemFailure('en', 'rate_limited', undefined);
    expect(r.type).toBe('toast');
    if (r.type !== 'toast') return;
    expect(r.description).toMatch(/wait a moment/i);
  });

  it('uses destructive toast for captcha_failed', () => {
    const r = resolvePresaleRedeemFailure('en', 'captcha_failed', undefined);
    expect(r.type).toBe('toast');
    if (r.type !== 'toast') return;
    expect(r.description).toMatch(/verification failed/i);
  });

  it('uses destructive toast for server_error', () => {
    const r = resolvePresaleRedeemFailure('en', 'server_error', undefined);
    expect(r.type).toBe('toast');
  });
});

describe('isPresaleInlineRedeemReason', () => {
  it('recognizes inline presale reasons', () => {
    expect(isPresaleInlineRedeemReason('code_exhausted')).toBe(true);
    expect(isPresaleInlineRedeemReason('code_not_found')).toBe(true);
    expect(isPresaleInlineRedeemReason('rate_limited')).toBe(false);
  });
});

describe('presaleInlineErrorVariantForReason', () => {
  it('assigns warning only to code_exhausted', () => {
    expect(presaleInlineErrorVariantForReason('code_exhausted')).toBe('warning');
    expect(presaleInlineErrorVariantForReason('code_not_found')).toBe('error');
  });
});
