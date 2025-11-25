import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { logger } from './lib/logger'
import { sanitizeConsoleArgs, sanitizeObject, sanitizeString } from './lib/sanitize'

// Early error handler to catch errors before main setup
const suppressBrowserExtensionError = (error: any) => {
  const errorString = String(error?.message || error || '');
  return errorString.includes("message channel closed") ||
         errorString.includes("asynchronous response") ||
         errorString.includes("A listener indicated an asynchronous response") ||
         errorString.includes("Extension context invalidated") ||
         errorString.includes("message channel closed before a response was received");
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
  // Handle JavaScript errors
  window.addEventListener('error', (event: ErrorEvent) => {
    const errorMessage = event.message || 'Unknown error';
    const filename = event.filename || '';
    
    // Suppress harmless browser extension errors
    if (errorMessage.includes("message channel closed") ||
        errorMessage.includes("asynchronous response") ||
        errorMessage.includes("A listener indicated an asynchronous response") ||
        errorMessage.includes("Extension context invalidated") ||
        errorMessage.includes("message channel closed before a response was received") ||
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

    // Log real errors (sanitized)
    logger.error('Unhandled Promise Rejection', sanitizeObject(event.reason), {
      category: 'error',
      details: sanitizeObject({
        message: errorMessage,
        type: 'PromiseRejectionEvent'
      })
    });
  });

  // Handle fetch/API errors globally
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const startTime = Date.now();
    try {
      const response = await originalFetch(...args);
      const duration = Date.now() - startTime;
      
      // Log API errors (4xx, 5xx) - sanitize URL to remove credentials
      if (!response.ok) {
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;
        const sanitizedUrl = sanitizeString(url);
        logger.error(`API Error: ${response.status} ${response.statusText}`, new Error(`${response.status} ${response.statusText}`), {
          category: 'api_call',
          details: sanitizeObject({
            url: sanitizedUrl,
            method: typeof args[0] === 'string' ? 'GET' : (args[0].method || 'GET'),
            status: response.status,
            statusText: response.statusText,
            duration
          }),
          requestMethod: typeof args[0] === 'string' ? 'GET' : (args[0].method || 'GET'),
          requestPath: sanitizedUrl,
          responseStatus: response.status
        });
      }
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      
      const sanitizedUrl = sanitizeString(url);
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

    // Suppress external resource errors
    if (errorString.includes("youtubei") ||
        errorString.includes("doubleclick") ||
        errorString.includes("googleads") ||
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

  // Log console warnings
  const originalConsoleWarn = console.warn;
  console.warn = (...args: any[]) => {
    originalConsoleWarn.apply(console, args);
    
    const warningString = args.map(arg => {
      if (typeof arg === 'string') return arg;
      return JSON.stringify(arg);
    }).join(' ');

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
};

// Setup error handlers before rendering
setupErrorHandlers();

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // Only unregister old service workers once (on first load after update)
      const shouldCleanup = !sessionStorage.getItem('sw-cleanup-done');
      
      if (shouldCleanup) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          // Clear old caches
          const cacheVersion = await caches.keys();
          for (const cacheName of cacheVersion) {
            if (cacheName.includes('andiamo-events-scanner-v1')) {
              await caches.delete(cacheName);
            }
          }
          // Only unregister if it's an old version
          if (registration.active?.scriptURL.includes('sw.js')) {
            await registration.unregister();
          }
        }
        sessionStorage.setItem('sw-cleanup-done', 'true');
      }
      
      // Register service worker (will reuse existing if already registered)
      const registration = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none'
      });
      
      // Don't log registration object (may contain sensitive info)
      logger.info('Service Worker registered', {
        category: 'system',
        details: { scope: sanitizeString(registration.scope) }
      });
      
      // Prevent automatic page refresh on service worker update
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            // Don't force reload - let user continue browsing
            // Only reload if user explicitly wants to (they can refresh manually)
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker is ready, but don't auto-reload
              console.log('New service worker available, but not forcing reload');
            }
          });
        }
      });
      
      // Only check for updates once per session to prevent loops
      if (!sessionStorage.getItem('sw-update-checked')) {
        // Don't force update check on mobile - it can cause refresh issues
        // registration.update(); // Commented out to prevent auto-refresh on mobile
        sessionStorage.setItem('sw-update-checked', 'true');
      }
    } catch (registrationError) {
      logger.error('Service Worker registration failed', sanitizeObject(registrationError), {
        category: 'system',
        details: sanitizeObject({ error: sanitizeString(String(registrationError)) })
      });
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
