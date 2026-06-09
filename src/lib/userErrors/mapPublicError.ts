import { isNetworkErrorMessage } from '@/lib/network-error-message';
import { legacyTextToCode } from './internalErrorPatterns';
import {
  getPublicErrorCopy,
  PRESALE_REASON_TO_CODE,
  type UserLanguage,
} from './messages';
import { PUBLIC_ERROR_CODES, type PublicErrorCode } from './publicErrorCodes';
import { isUserSafeErrorText, sanitizeUnknownError } from './sanitizeUnknownError';

export interface PublicErrorInput {
  error?: string | null;
  message?: string | null;
  details?: string | null;
  reason?: string | null;
  status?: number | null;
}

export interface MappedPublicError {
  title: string;
  description: string;
  code: PublicErrorCode;
}

function isNetworkMessage(m: string): boolean {
  return isNetworkErrorMessage(m);
}

function resolveCode(input: PublicErrorInput): PublicErrorCode {
  const { error, reason, message, details } = input;

  if (reason && PRESALE_REASON_TO_CODE[reason]) {
    return PRESALE_REASON_TO_CODE[reason];
  }

  const codeCandidate = String(error || '').trim();
  if (codeCandidate && Object.values(PUBLIC_ERROR_CODES).includes(codeCandidate as PublicErrorCode)) {
    return codeCandidate as PublicErrorCode;
  }

  for (const raw of [message, details, error]) {
    if (!raw) continue;
    const legacy = legacyTextToCode(String(raw));
    if (legacy && Object.values(PUBLIC_ERROR_CODES).includes(legacy as PublicErrorCode)) {
      return legacy as PublicErrorCode;
    }
  }

  if (typeof input.status === 'number' && input.status >= 500) {
    return PUBLIC_ERROR_CODES.SERVICE_UNAVAILABLE;
  }

  return PUBLIC_ERROR_CODES.GENERIC;
}

/**
 * Map API / thrown errors to user-safe toast/page copy (EN/FR).
 */
export function mapPublicError(input: PublicErrorInput, language: UserLanguage): MappedPublicError {
  const rawMessage = String(input.message || input.details || input.error || '').trim();

  if (rawMessage && isNetworkMessage(rawMessage)) {
    const net = getPublicErrorCopy(PUBLIC_ERROR_CODES.NETWORK, language);
    return { ...net, code: PUBLIC_ERROR_CODES.NETWORK };
  }

  const code = resolveCode(input);
  const copy = getPublicErrorCopy(code, language);

  // Prefer API `message` when user-safe (e.g. stock with pass name)
  const safeApiMessage = sanitizeUnknownError(input.message) || sanitizeUnknownError(input.details);
  if (
    safeApiMessage &&
    code !== PUBLIC_ERROR_CODES.GENERIC &&
    code !== PUBLIC_ERROR_CODES.SERVICE_UNAVAILABLE &&
    isUserSafeErrorText(safeApiMessage)
  ) {
    return { title: copy.title, description: safeApiMessage, code };
  }

  if (code === PUBLIC_ERROR_CODES.GENERIC && rawMessage) {
    const safe = sanitizeUnknownError(rawMessage);
    if (safe) {
      return {
        title: copy.title,
        description: safe,
        code: PUBLIC_ERROR_CODES.GENERIC,
      };
    }
  }

  return { ...copy, code };
}

/** Map a thrown Error or unknown value for display. */
export function mapThrownError(err: unknown, language: UserLanguage): MappedPublicError {
  const message = err instanceof Error ? err.message : String(err ?? '');
  const code =
    err &&
    typeof err === 'object' &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string'
      ? String((err as { code: string }).code)
      : undefined;

  return mapPublicError({ error: code, message }, language);
}
