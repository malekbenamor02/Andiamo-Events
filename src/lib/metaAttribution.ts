/**
 * Helpers for Meta browser/server event attribution and deduplication.
 */

export interface MetaAttributionContext {
  fbp?: string;
  fbc?: string;
  eventSourceUrl?: string;
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const pattern = new RegExp(`(?:^|; )${name}=([^;]*)`);
  const match = document.cookie.match(pattern);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

export function getMetaAttributionContext(): MetaAttributionContext {
  if (typeof window === 'undefined') return {};
  return {
    fbp: readCookie('_fbp'),
    fbc: readCookie('_fbc'),
    eventSourceUrl: window.location.href,
  };
}

export function createMetaEventId(prefix = 'meta'): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${randomPart}`;
}
