import type { MetaAttributionContext } from './types';

const FBC_COOKIE = '_fbc';
const FBC_FALLBACK_KEY = 'andiamo_meta_fbc';
const LANDING_URL_KEY = 'andiamo_meta_academy_landing_url';
/** Meta recommends ~90 days for _fbc */
const FBC_MAX_AGE_SEC = 90 * 24 * 60 * 60;

/** Meta _fbc format: fb.1.<unix_ms>.<fbclid> */
const FBC_PATTERN = /^fb\.1\.\d+\.[^;]+$/;

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const pattern = new RegExp(`(?:^|; )${name}=([^;]*)`);
  const match = document.cookie.match(pattern);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function writeCookie(name: string, value: string, maxAgeSec: number): void {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSec}; SameSite=Lax`;
  } catch {
    // ignore
  }
}

function readSessionItem(key: string): string | undefined {
  if (typeof sessionStorage === 'undefined') return undefined;
  try {
    return sessionStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeSessionItem(key: string, value: string): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore quota / private mode
  }
}

function readFbclidFromUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const fbclid = new URLSearchParams(window.location.search).get('fbclid');
    return fbclid?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export function isValidFbc(value: string): boolean {
  return FBC_PATTERN.test(value.trim());
}

/** Build Meta-compatible _fbc from fbclid (milliseconds timestamp). */
export function buildFbcFromFbclid(fbclid: string, timestampMs = Date.now()): string {
  const id = fbclid.trim();
  return `fb.1.${timestampMs}.${id}`;
}

function readFbc(): string | undefined {
  const fromCookie = readCookie(FBC_COOKIE);
  if (fromCookie && isValidFbc(fromCookie)) return fromCookie;

  const fromSession = readSessionItem(FBC_FALLBACK_KEY);
  if (fromSession && isValidFbc(fromSession)) return fromSession;

  const fbclid = readFbclidFromUrl();
  if (fbclid) {
    return buildFbcFromFbclid(fbclid);
  }

  return undefined;
}

function storeLandingUrlIfNeeded(): void {
  const fbclid = readFbclidFromUrl();
  if (!fbclid) return;
  if (readSessionItem(LANDING_URL_KEY)) return;
  if (typeof window === 'undefined') return;
  writeSessionItem(LANDING_URL_KEY, window.location.href);
}

function persistFbcFromFbclid(fbclid: string): void {
  const existing = readCookie(FBC_COOKIE);
  if (existing && isValidFbc(existing)) {
    return;
  }

  const fbc = buildFbcFromFbclid(fbclid);
  writeCookie(FBC_COOKIE, fbc, FBC_MAX_AGE_SEC);
  writeSessionItem(FBC_FALLBACK_KEY, fbc);
}

/**
 * Capture Meta click attribution as early as possible (landing page, route changes).
 * Persists _fbc from fbclid so /academy/register can read it after internal navigation.
 */
export function preserveMetaAttribution(): void {
  if (typeof window === 'undefined') return;

  storeLandingUrlIfNeeded();

  const fbclid = readFbclidFromUrl();
  if (fbclid) {
    persistFbcFromFbclid(fbclid);
  }
}

export function getMetaAttributionContext(): MetaAttributionContext {
  if (typeof window === 'undefined') return {};

  preserveMetaAttribution();

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
