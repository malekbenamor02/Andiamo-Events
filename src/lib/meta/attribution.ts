import type { MetaAttributionContext } from './types';

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const pattern = new RegExp(`(?:^|; )${name}=([^;]*)`);
  const match = document.cookie.match(pattern);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function readFbc(): string | undefined {
  const fromCookie = readCookie('_fbc');
  if (fromCookie) return fromCookie;

  if (typeof window === 'undefined') return undefined;
  try {
    const fbclid = new URLSearchParams(window.location.search).get('fbclid');
    if (fbclid && fbclid.trim()) {
      return `fb.1.${Date.now()}.${fbclid.trim()}`;
    }
  } catch {
    // ignore
  }
  return undefined;
}

export function getMetaAttributionContext(): MetaAttributionContext {
  if (typeof window === 'undefined') return {};
  return {
    fbp: readCookie('_fbp'),
    fbc: readFbc(),
    eventSourceUrl: window.location.href,
  };
}

export function createMetaEventId(prefix = 'meta'): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${randomPart}`;
}
