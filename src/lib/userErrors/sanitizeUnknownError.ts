import { isLikelyInternalErrorText } from './internalErrorPatterns';

/**
 * Returns true if the text is safe to show to end users as-is.
 */
export function isUserSafeErrorText(text: string | undefined | null): boolean {
  if (!text || !text.trim()) return false;
  return !isLikelyInternalErrorText(text);
}

/**
 * Strip internal/dev error strings; return undefined if unsafe.
 */
export function sanitizeUnknownError(raw: string | undefined | null): string | undefined {
  if (!raw || !raw.trim()) return undefined;
  const trimmed = raw.trim();
  if (isLikelyInternalErrorText(trimmed)) return undefined;
  return trimmed;
}
