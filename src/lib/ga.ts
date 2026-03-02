/**
 * Google Analytics 4 (GA4) integration using gtag.js
 *
 * - Controlled via Vite env var: VITE_GA_MEASUREMENT_ID
 * - Safe no-op in development or when the ID is missing
 * - Exposes helpers for page views and custom events
 */

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
const isProduction = import.meta.env.PROD;

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

let isInitialized = false;

function loadGtagScript(measurementId: string): void {
  if (document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${measurementId}"]`)) {
    return;
  }

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);
}

function initGtag(measurementId: string): void {
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag(...args: any[]) {
      window.dataLayer!.push(args);
    };

  window.gtag('js', new Date());
  // Disable automatic page_view so we can control SPA routing manually
  window.gtag('config', measurementId, { send_page_view: false });
}

export function initGA(): void {
  if (isInitialized) return;

  const id = GA_MEASUREMENT_ID?.trim();
  if (!id) {
    if (isProduction) {
      console.warn('[GA] VITE_GA_MEASUREMENT_ID not set – Google Analytics disabled');
    }
    return;
  }

  try {
    loadGtagScript(id);
    initGtag(id);
    isInitialized = true;
  } catch (e) {
    if (isProduction) {
      console.warn('[GA] Failed to initialize Google Analytics:', e);
    }
  }
}

interface PageViewParams {
  page_path?: string;
  page_title?: string;
  page_location?: string;
  [key: string]: any;
}

export function trackPageView(
  path: string,
  params: PageViewParams = {}
): void {
  if (!window.gtag || !GA_MEASUREMENT_ID) {
    return;
  }

  const page_location =
    params.page_location ||
    (typeof window !== 'undefined' ? window.location.href : undefined);

  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: params.page_title || (typeof document !== 'undefined' ? document.title : undefined),
    page_location,
    ...params,
  });
}

interface TrackEventParams {
  category?: string;
  label?: string;
  value?: number;
  [key: string]: any;
}

/**
 * Track a custom GA4 event
 * @param name GA4 event name (e.g. 'select_content', 'purchase')
 * @param params Additional event parameters
 */
export function trackEvent(name: string, params: TrackEventParams = {}): void {
  if (!window.gtag || !GA_MEASUREMENT_ID) {
    return;
  }

  window.gtag('event', name, params);
}

