/**
 * Meta Pixel integration for Meta Ads (conversion, remarketing, lookalikes).
 * Mirrors GA4 funnel: same events fired to both GA and Meta.
 * Vite env: VITE_META_PIXEL_ID (fallback: 930929995973320)
 */

const META_PIXEL_ID =
  (import.meta.env.VITE_META_PIXEL_ID as string | undefined)?.trim() || '930929995973320';
const isProduction = import.meta.env.PROD;

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

let isInitialized = false;

const FB_EVENTS_URL = 'https://connect.facebook.net/en_US/fbevents.js';

function ensureFbqStub(): void {
  if (window.fbq) return;
  const n = (window.fbq = function (...args: any[]) {
    n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
  } as any);
  if (!window._fbq) window._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = '2.0';
  n.queue = [];
}

function loadMetaScript(): void {
  if (document.querySelector(`script[src*="connect.facebook.net"]`)) {
    return;
  }
  const script = document.createElement('script');
  script.async = true;
  script.src = FB_EVENTS_URL;
  document.head.appendChild(script);
}

export function initMeta(): void {
  if (isInitialized) return;
  if (!isProduction) return;
  const id = META_PIXEL_ID;
  if (!id) {
    console.warn('[Meta] VITE_META_PIXEL_ID not set – Meta Pixel disabled');
    return;
  }
  try {
    ensureFbqStub();
    loadMetaScript();
    if (typeof window.fbq === 'function') {
      window.fbq('init', id);
      isInitialized = true;
    }
  } catch (e) {
    if (isProduction) {
      console.warn('[Meta] Failed to initialize Meta Pixel:', e);
    }
  }
}

/**
 * Track a standard Meta PageView (call on each route change, e.g. from App.tsx).
 */
export function trackMetaPageView(path?: string): void {
  if (typeof window === 'undefined' || !window.fbq || !META_PIXEL_ID || !isInitialized) {
    return;
  }
  if (path) {
    window.fbq('track', 'PageView', { content_name: path });
  } else {
    window.fbq('track', 'PageView');
  }
}

/**
 * Track a custom Meta Pixel event (e.g. PassPurchaseVisit, PassSelect, OrderSubmitOnline, OrderSubmitAmbassador).
 */
export function trackMetaEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.fbq || !META_PIXEL_ID || !isInitialized) {
    return;
  }
  window.fbq('trackCustom', name, params);
}

/**
 * Track standard Meta Purchase event (for value optimization; use alongside OrderSubmitOnline custom event).
 */
export function trackMetaPurchase(params: {
  value: number;
  currency: string;
  content_ids?: string[];
  content_type?: string;
  content_name?: string;
  num_items?: number;
  [key: string]: unknown;
}): void {
  if (typeof window === 'undefined' || !window.fbq || !META_PIXEL_ID || !isInitialized) {
    return;
  }
  window.fbq('track', 'Purchase', params);
}
