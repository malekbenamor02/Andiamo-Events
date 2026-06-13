/**
 * Meta Pixel — init, PageView, confirmed Purchase, and ambassador-app events.
 * Vite env: VITE_META_PIXEL_ID
 */

import { buildPixelAdvancedMatching } from './userData';
import { META_TICKET_CONTENT_CATEGORY, type MetaPurchasePayload } from './types';

const META_PIXEL_ID =
  (import.meta.env.VITE_META_PIXEL_ID as string | undefined)?.trim() || '';
const isProduction = import.meta.env.PROD;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

let isInitialized = false;
let isDisabled = false;

const FB_EVENTS_URL = 'https://connect.facebook.net/en_US/fbevents.js';

function ensureFbqStub(): void {
  if (window.fbq) return;
  const n = (window.fbq = function (...args: unknown[]) {
    const fn = n as typeof n & {
      callMethod?: (...a: unknown[]) => void;
      queue: unknown[][];
    };
    fn.callMethod ? fn.callMethod.apply(n, args) : fn.queue.push(args);
  } as typeof window.fbq & { queue: unknown[][] });
  if (!window._fbq) window._fbq = n;
  const stub = n as typeof n & {
    push: typeof n;
    loaded: boolean;
    version: string;
    queue: unknown[][];
  };
  stub.push = n;
  stub.loaded = true;
  stub.version = '2.0';
  stub.queue = [];
}

function loadMetaScript(): void {
  if (document.querySelector(`script[src*="connect.facebook.net"]`)) {
    return;
  }
  const script = document.createElement('script');
  script.async = true;
  script.src = FB_EVENTS_URL;
  script.onerror = () => {
    isDisabled = true;
  };
  document.head.appendChild(script);
}

function canTrack(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.fbq) &&
    Boolean(META_PIXEL_ID) &&
    isInitialized &&
    !isDisabled
  );
}

export function initMeta(): void {
  if (isInitialized) return;
  if (!isProduction) return;
  const id = META_PIXEL_ID;
  if (!id || isDisabled) return;
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

export function trackMetaPageView(path?: string): void {
  if (!canTrack()) return;
  if (path) {
    window.fbq!('track', 'PageView', { content_name: path });
  } else {
    window.fbq!('track', 'PageView');
  }
}

/** Ambassador application funnel only (not used for pass purchase). */
export function trackMetaEvent(name: string, params?: Record<string, unknown>): void {
  if (!canTrack()) return;
  window.fbq!('trackCustom', name, params);
}

interface MetaLeadOptions {
  eventId?: string;
}

export function trackMetaLead(
  params?: Record<string, unknown>,
  options: MetaLeadOptions = {}
): void {
  if (!canTrack()) return;
  if (options.eventId) {
    window.fbq!('track', 'Lead', params || {}, { eventID: options.eventId });
  } else {
    window.fbq!('track', 'Lead', params || {});
  }
}

/**
 * Fire standard Purchase when a sale is confirmed (browser Pixel + CAPI dedup via eventId).
 */
export function trackConfirmedPurchase(payload: MetaPurchasePayload): void {
  if (!canTrack()) return;

  const advancedMatching = buildPixelAdvancedMatching(payload.customer);
  window.fbq!('init', META_PIXEL_ID, advancedMatching);

  const customData: Record<string, unknown> = {
    value: payload.value,
    currency: payload.currency,
    content_category: payload.contentCategory ?? META_TICKET_CONTENT_CATEGORY,
    content_ids: payload.contentIds,
    content_type: 'product',
    num_items: payload.numItems,
    order_id: payload.orderId,
    payment_method: payload.paymentMethod,
  };
  if (payload.contentName) customData.content_name = payload.contentName;
  if (payload.contents?.length) customData.contents = payload.contents;
  if (payload.promoCode) customData.promo_code = payload.promoCode;

  window.fbq!('track', 'Purchase', customData, { eventID: payload.eventId });
}
