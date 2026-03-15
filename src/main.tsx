import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initSentry, Sentry } from './lib/sentry'
import { initClarity } from './lib/clarity'
import { initGA } from './lib/ga'
import { initMeta } from './lib/meta'
import { logger } from './lib/logger'
import { sanitizeConsoleArgs, sanitizeObject, sanitizeString } from './lib/sanitize'

// Initialize Sentry as early as possible for error tracking
initSentry()

// Initialize GA early so the first page view is captured (trackPageView runs as soon as App mounts)
if (typeof window !== 'undefined') {
  try {
    initGA()
  } catch {
    // ignore analytics init errors
  }
  try {
    initMeta()
  } catch {
    // ignore analytics init errors
  }
}

// Defer other non-essential analytics so they don't block initial paint
const deferAnalytics = () => {
  try {
    initClarity()
  } catch {
    // ignore analytics init errors
  }
}

if (typeof window !== 'undefined') {
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(deferAnalytics)
  } else {
    window.addEventListener('load', () => {
      setTimeout(deferAnalytics, 0)
    })
  }
}

// Early error handler to catch errors before main setup
const suppressBrowserExtensionError = (error: any) => {
  const errorString = String(error?.message || error || '');
  return errorString.includes("message channel closed") ||
         errorString.includes("asynchronous response") ||
         errorString.includes("A listener indicated an asynchronous response") ||
         errorString.includes("Extension context invalidated") ||
         errorString.includes("message channel closed before a response was received") ||
         errorString.includes("Could not establish connection") ||
         errorString.includes("Receiving end does not exist") ||
         (errorString.includes("webkit") && errorString.includes("messageHandlers")) ||
         (errorString.includes("Java object is gone") && errorString.includes("enableButtonsClickedMetaDataLogging")) ||
         errorString.includes("reCAPTCHA Timeout") ||
         // Service worker cache errors (browser/extension SW trying to cache POST or non-Response)
         errorString.includes("Failed to execute 'put' on 'Cache'") ||
         errorString.includes("Request method 'POST' is unsupported") ||
         errorString.includes("Failed to convert value to 'Response'");
};

// Set up early promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  if (suppressBrowserExtensionError(event.reason)) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
}, { capture: true });

// Global error handlers to catch all errors
const setupErrorHandlers = async () => {
  // Wrap console.warn once so we can both suppress noisy logs and capture real ones
  const originalConsoleWarn = console.warn;
  console.warn = (...args: any[]) => {
    const warningString = args.map(arg => {
      if (typeof arg === 'string') return arg;
      return JSON.stringify(arg);
    }).join(' ');

    // Suppress Chrome intervention warnings (slow network, etc.)
    if (warningString.includes('[Intervention]') || 
        warningString.includes('Slow network is detected') ||
        warningString.includes('Fallback font will be used')) {
      return;
    }

    originalConsoleWarn.apply(console, args);

    // Don't log if it's already a logging warning
    if (!warningString.includes('Failed to log activity')) {
      logger.warning('Console Warning', {
        category: 'error',
        details: {
          message: warningString
        }
      });
    }
  };

  // Handle JavaScript errors
  window.addEventListener('error', (event: ErrorEvent) => {
    const errorMessage = event.message || 'Unknown error';
    const filename = event.filename || '';
    
    // Suppress harmless browser extension and in-app browser errors
    if (errorMessage.includes("message channel closed") ||
        errorMessage.includes("asynchronous response") ||
        errorMessage.includes("A listener indicated an asynchronous response") ||
        errorMessage.includes("Extension context invalidated") ||
        errorMessage.includes("message channel closed before a response was received") ||
        (errorMessage.includes("webkit") && errorMessage.includes("messageHandlers")) ||
        (errorMessage.includes("Java object is gone") && errorMessage.includes("enableButtonsClickedMetaDataLogging")) ||
        errorMessage.includes("reCAPTCHA Timeout") ||
        filename.includes("chrome-extension://") ||
        filename.includes("moz-extension://") ||
        filename.includes("safari-extension://") ||
        filename.includes("edge-extension://")) {
      event.preventDefault();
      event.stopPropagation();
      // Completely suppress - don't log to console at all
      return;
    }

    // Suppress external resource errors (YouTube, Google Ads, etc.)
    if (filename.includes("youtube.com") ||
        filename.includes("doubleclick.net") ||
        filename.includes("googleads") ||
        errorMessage.includes("ERR_BLOCKED_BY_CLIENT") ||
        errorMessage.includes("ERR_CONNECTION_CLOSED")) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // Suppress WebSocket connection errors (dev-only, HMR related)
    if (errorMessage.includes("WebSocket") ||
        errorMessage.includes("websocket") ||
        errorMessage.includes("Failed to connect")) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // Log real errors (sanitized)
    const sanitizedError = event.error ? sanitizeObject(event.error) : new Error(sanitizeString(errorMessage));
    logger.error('JavaScript Error', sanitizedError, {
      category: 'error',
      details: sanitizeObject({
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        message: errorMessage,
        type: 'ErrorEvent'
      })
    });
    Sentry.captureException(event.error || new Error(errorMessage));
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const errorMessage = event.reason?.message || String(event.reason) || 'Unhandled promise rejection';
    const errorString = String(event.reason);
    
    // Suppress harmless browser extension errors
    if (typeof errorMessage === 'string' &&
        (errorMessage.includes("message channel closed") ||
         errorMessage.includes("asynchronous response") ||
         errorMessage.includes("A listener indicated an asynchronous response") ||
         errorMessage.includes("Extension context invalidated") ||
         errorMessage.includes("message channel closed before a response was received") ||
         errorMessage.includes("Could not establish connection") ||
         errorMessage.includes("Receiving end does not exist") ||
         errorString.includes("message channel closed") ||
         errorString.includes("asynchronous response") ||
         errorString.includes("A listener indicated an asynchronous response") ||
         errorString.includes("message channel closed before a response was received"))) {
      event.preventDefault();
      event.stopPropagation();
      // Completely suppress - don't log to console at all
      return;
    }

    // Suppress external resource errors (YouTube, Google Ads, etc.)
    if (typeof errorMessage === 'string' &&
        (errorMessage.includes("youtubei") ||
         errorMessage.includes("doubleclick") ||
         errorMessage.includes("googleads") ||
         errorMessage.includes("ERR_BLOCKED_BY_CLIENT") ||
         errorMessage.includes("ERR_CONNECTION_CLOSED"))) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // Suppress WebSocket connection errors (dev-only, HMR related)
    if (typeof errorMessage === 'string' &&
        (errorMessage.includes("WebSocket") ||
         errorMessage.includes("websocket") ||
         errorMessage.includes("Failed to connect") ||
         errorString.includes("WebSocket") ||
         errorString.includes("websocket"))) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // Log real errors (sanitized)
    logger.error('Unhandled Promise Rejection', sanitizeObject(event.reason), {
      category: 'error',
      details: sanitizeObject({
        message: errorMessage,
        type: 'PromiseRejectionEvent'
      })
    });
    Sentry.captureException(event.reason instanceof Error ? event.reason : new Error(errorMessage));
  });

  // URLs we never log as API errors (third-party analytics/tracking often blocked by ad blockers)
  const isThirdPartyAnalyticsUrl = (url: string) => {
    try {
      const u = url.toLowerCase();
      return (
        u.includes('analytics.google.com') ||
        u.includes('google-analytics.com') ||
        u.includes('googletagmanager.com') ||
        u.includes('googleadservices.com') ||
        u.includes('doubleclick.net') ||
        u.includes('/g/collect')
      );
    } catch {
      return false;
    }
  };

  // Handle fetch/API errors globally
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const startTime = Date.now();
    const url = typeof args[0] === 'string' ? args[0] : args[0].url;
    const sanitizedUrl = sanitizeString(url);
    try {
      const response = await originalFetch(...args);
      const duration = Date.now() - startTime;

      // Log API errors (4xx, 5xx) - sanitize URL to remove credentials
      // Skip: 404 (missing assets), status 0 (blocked/CORS/network), and third-party analytics
      const status = response.status;
      const skipLog =
        status === 404 ||
        status === 0 ||
        isThirdPartyAnalyticsUrl(sanitizedUrl);
      if (!response.ok && !skipLog) {
        logger.error(`API Error: ${status} ${response.statusText}`, new Error(`${status} ${response.statusText}`), {
          category: 'api_call',
          details: sanitizeObject({
            url: sanitizedUrl,
            method: typeof args[0] === 'string' ? 'GET' : (args[0].method || 'GET'),
            status,
            statusText: response.statusText,
            duration
          }),
          requestMethod: typeof args[0] === 'string' ? 'GET' : (args[0].method || 'GET'),
          requestPath: sanitizedUrl,
          responseStatus: status
        });
      }

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Don't log service worker, network errors, or third-party analytics failures
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isServiceWorkerError = sanitizedUrl.includes('sw.js') || errorMessage.includes('Failed to fetch');
      const isNetworkError = errorMessage.includes('NetworkError') || errorMessage.includes('Network request failed');
      const isAnalyticsUrl = isThirdPartyAnalyticsUrl(sanitizedUrl);

      if (!isServiceWorkerError && !isNetworkError && !isAnalyticsUrl) {
        Sentry.captureException(error, { extra: { url: sanitizedUrl } });
        logger.error('Fetch Error', sanitizeObject(error), {
          category: 'api_call',
          details: sanitizeObject({
            url: sanitizedUrl,
            method: typeof args[0] === 'string' ? 'GET' : (args[0].method || 'GET'),
            duration
          }),
          requestMethod: typeof args[0] === 'string' ? 'GET' : (args[0].method || 'GET'),
          requestPath: sanitizedUrl
        });
      }

      throw error;
    }
  };

  // Log console errors (but suppress harmless ones and sanitize sensitive data)
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    // Sanitize all arguments before processing
    const sanitizedArgs = sanitizeConsoleArgs(args);
    // Try to extract error information
    const errorString = args.map(arg => {
      if (arg instanceof Error) return arg.message;
      if (typeof arg === 'string') return arg;
      return JSON.stringify(arg);
    }).join(' ');

    // Suppress harmless browser extension errors
    if (errorString.includes("message channel closed") ||
        errorString.includes("asynchronous response") ||
        errorString.includes("A listener indicated an asynchronous response") ||
        errorString.includes("Extension context invalidated") ||
        errorString.includes("message channel closed before a response was received")) {
      // Don't log to console or logger
      return;
    }

    // Suppress service worker cache errors (POST / non-Response)
    if (errorString.includes("Failed to execute 'put' on 'Cache'") ||
        errorString.includes("Request method 'POST' is unsupported") ||
        errorString.includes("Failed to convert value to 'Response'")) {
      return;
    }

    // Suppress external resource errors
    if (errorString.includes("youtubei") ||
        errorString.includes("doubleclick") ||
        errorString.includes("googleads") ||
        errorString.includes("fbevents") ||
        errorString.includes("ERR_BLOCKED_BY_CLIENT") ||
        errorString.includes("ERR_CONNECTION_CLOSED")) {
      // Don't log to console or logger
      return;
    }

    // Log real errors to console (sanitized)
    originalConsoleError.apply(console, sanitizedArgs);
    
    // Don't log if it's already a logging error to avoid infinite loops
    if (!errorString.includes('Failed to log activity') && 
        !errorString.includes('Error in logActivity')) {
      logger.warning('Console Error', {
        category: 'error',
        details: sanitizeObject({
          message: sanitizeString(errorString),
          args: sanitizedArgs.map(arg => typeof arg === 'object' ? JSON.stringify(sanitizeObject(arg)) : sanitizeString(String(arg)))
        })
      });
    }
  };

};

// Setup error handlers before rendering
setupErrorHandlers();

const root = document.getElementById("root")!;
createRoot(root).render(
  <Sentry.ErrorBoundary
    fallback={({ error, resetError }) => (
      <div style={{ padding: 24, textAlign: 'center', fontFamily: 'Montserrat' }}>
        <h2>Something went wrong</h2>
        <p>We've been notified and are looking into it.</p>
        <button onClick={resetError} style={{ marginTop: 16, padding: '8px 16px', cursor: 'pointer' }}>
          Try again
        </button>
      </div>
    )}
    onError={(error) => Sentry.captureException(error)}
  >
    <App />
  </Sentry.ErrorBoundary>
);
