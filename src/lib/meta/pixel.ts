/**
 * Meta Pixel — init, PageView, confirmed Purchase, and ambassador Lead.
 * Vite env: VITE_META_PIXEL_ID
 */

import { buildPixelAdvancedMatching } from './userData';
import {
  META_TICKET_CONTENT_CATEGORY,
  type AcademyMetaPixelPayload,
  type MetaCustomerData,
  type MetaPurchasePayload,
  type TicketMetaPixelPayload,
} from './types';

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

const ACADEMY_PIXEL_FIRED_PREFIX = 'andiamo_meta_academy_pixel_fired:';
const TICKET_PIXEL_FIRED_PREFIX = 'andiamo_meta_ticket_pixel_fired:';
const AMBASSADOR_LEAD_FIRED_PREFIX = 'andiamo_meta_ambassador_lead_fired:';

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

/** Ambassador application Lead — advanced matching + deduped eventID (pairs with server CAPI). */
export function trackAmbassadorLead(customer: MetaCustomerData, eventId: string): void {
  if (!canTrack() || !eventId) return;
  if (hasPixelFired(AMBASSADOR_LEAD_FIRED_PREFIX, eventId)) return;

  const advancedMatching = buildPixelAdvancedMatching(customer);
  window.fbq!('init', META_PIXEL_ID, advancedMatching);
  window.fbq!('track', 'Lead', { content_name: 'Ambassador Application' }, { eventID: eventId });
  markPixelFired(AMBASSADOR_LEAD_FIRED_PREFIX, eventId);
}

function isValidBackendPixelPayload(
  payload: TicketMetaPixelPayload | AcademyMetaPixelPayload | null | undefined
): payload is TicketMetaPixelPayload | AcademyMetaPixelPayload {
  if (!payload) return false;
  return Boolean(
    payload.eventId &&
      payload.orderId &&
      payload.value > 0 &&
      payload.contentIds?.length > 0 &&
      payload.paymentMethod &&
      payload.contentCategory &&
      payload.advancedMatching &&
      typeof payload.advancedMatching === 'object'
  );
}

export function isValidTicketMetaPixelPayload(
  payload: TicketMetaPixelPayload | null | undefined
): payload is TicketMetaPixelPayload {
  return isValidBackendPixelPayload(payload);
}

export function isValidAcademyMetaPixelPayload(
  payload: AcademyMetaPixelPayload | null | undefined
): payload is AcademyMetaPixelPayload {
  return isValidBackendPixelPayload(payload);
}

function hasPixelFired(prefix: string, orderId: string): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    return sessionStorage.getItem(`${prefix}${orderId}`) === '1';
  } catch {
    return false;
  }
}

function markPixelFired(prefix: string, orderId: string): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(`${prefix}${orderId}`, '1');
  } catch {
    // ignore quota / private mode
  }
}

function firePurchaseFromBackendPayload(
  payload: TicketMetaPixelPayload | AcademyMetaPixelPayload,
  firedPrefix: string
): void {
  if (!canTrack()) return;
  if (!isValidBackendPixelPayload(payload)) return;
  if (hasPixelFired(firedPrefix, payload.orderId)) return;

  window.fbq!('init', META_PIXEL_ID, payload.advancedMatching);

  const customData: Record<string, unknown> = {
    value: payload.value,
    currency: payload.currency,
    content_category: payload.contentCategory,
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
  markPixelFired(firedPrefix, payload.orderId);
}

/**
 * Fire ticket/pass Purchase from backend-provided tracking payload (source of truth).
 */
export function trackPurchaseFromBackend(payload: TicketMetaPixelPayload): void {
  firePurchaseFromBackendPayload(payload, TICKET_PIXEL_FIRED_PREFIX);
}

/**
 * Transitional fallback — prefer trackPurchaseFromBackend from API metaTracking.pixel.
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

/**
 * Fire Academy Purchase from backend-provided tracking payload (source of truth).
 */
export function trackAcademyPurchaseFromBackend(payload: AcademyMetaPixelPayload): void {
  firePurchaseFromBackendPayload(payload, ACADEMY_PIXEL_FIRED_PREFIX);
}
