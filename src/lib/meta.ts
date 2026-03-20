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
interface MetaStandardOptions {
  eventId?: string;
}

type MetaStandardParams = Record<string, unknown>;

function trackStandardEvent(
  name: string,
  params?: MetaStandardParams,
  options: MetaStandardOptions = {}
): void {
  if (typeof window === 'undefined' || !window.fbq || !META_PIXEL_ID || !isInitialized) {
    return;
  }
  if (options.eventId) {
    window.fbq('track', name, params || {}, { eventID: options.eventId });
    return;
  }
  window.fbq('track', name, params || {});
}

/**
 * Standard ViewContent for product/content detail pages.
 */
export function trackMetaViewContent(params?: MetaStandardParams): void {
  trackStandardEvent('ViewContent', params);
}

/**
 * Standard AddToCart for intent signals.
 */
export function trackMetaAddToCart(params?: MetaStandardParams): void {
  trackStandardEvent('AddToCart', params);
}

/**
 * Standard InitiateCheckout for mid-funnel optimization.
 */
export function trackMetaInitiateCheckout(params?: MetaStandardParams): void {
  trackStandardEvent('InitiateCheckout', params);
}

/**
 * Standard Lead for lead-generation outcomes.
 */
export function trackMetaLead(params?: MetaStandardParams, options: MetaStandardOptions = {}): void {
  trackStandardEvent('Lead', params, options);
}

/**
 * Track standard Meta Purchase event (for value optimization; use alongside custom order events).
 */
export function trackMetaPurchase(params: {
  value: number;
  currency: string;
  content_ids?: string[];
  content_type?: string;
  content_name?: string;
  num_items?: number;
  [key: string]: unknown;
}, options: MetaStandardOptions = {}): void {
  trackStandardEvent('Purchase', params, options);
}
