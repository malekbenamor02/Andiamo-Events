import { mapPublicError } from '@/lib/userErrors/mapPublicError';
import type { UserLanguage } from '@/lib/userErrors/messages';

export type PresaleInlineErrorVariant = 'error' | 'warning';

export interface PresaleInlineError {
  message: string;
  variant: PresaleInlineErrorVariant;
  reason?: string;
}

const INLINE_WARNING_REASONS = new Set(['code_exhausted']);
const INLINE_ERROR_REASONS = new Set(['code_not_found', 'code_expired', 'code_not_active_yet']);

export function isPresaleInlineRedeemReason(reason: string): boolean {
  return INLINE_WARNING_REASONS.has(reason) || INLINE_ERROR_REASONS.has(reason);
}

export function presaleInlineErrorVariantForReason(reason: string): PresaleInlineErrorVariant {
  return INLINE_WARNING_REASONS.has(reason) ? 'warning' : 'error';
}

export type PresaleRedeemFailure =
  | { type: 'inline'; error: PresaleInlineError }
  | { type: 'toast'; description: string };

/** Classify presale redeem API failures for inline field feedback vs destructive toast. */
export function resolvePresaleRedeemFailure(
  lang: UserLanguage,
  reason: string | undefined,
  serverMessage: string | undefined
): PresaleRedeemFailure {
  const mapped = mapPublicError({ reason, message: serverMessage }, lang);
  if (reason && isPresaleInlineRedeemReason(reason)) {
    return {
      type: 'inline',
      error: {
        message: mapped.description,
        variant: presaleInlineErrorVariantForReason(reason),
        reason,
      },
    };
  }
  return { type: 'toast', description: mapped.description };
}
