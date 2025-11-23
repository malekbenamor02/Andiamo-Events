import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { logger } from './lib/logger'

// Global error handlers to catch all errors
const setupErrorHandlers = async () => {
  // Handle JavaScript errors
  window.addEventListener('error', (event: ErrorEvent) => {
    const errorMessage = event.message || 'Unknown error';
    const filename = event.filename || '';
    
    // Suppress harmless browser extension errors
    if (errorMessage.includes("message channel closed") ||
        errorMessage.includes("asynchronous response") ||
        errorMessage.includes("Extension context invalidated") ||
        filename.includes("chrome-extension://") ||
        filename.includes("moz-extension://") ||
        filename.includes("safari-extension://")) {
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

    // Log real errors
    logger.error('JavaScript Error', event.error || new Error(errorMessage), {
      category: 'error',
      details: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        message: errorMessage,
        type: 'ErrorEvent'
      }
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
         errorMessage.includes("Extension context invalidated") ||
         errorString.includes("message channel closed") ||
         errorString.includes("asynchronous response"))) {
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

    // Log real errors
    logger.error('Unhandled Promise Rejection', event.reason, {
      category: 'error',
      details: {
        message: errorMessage,
        type: 'PromiseRejectionEvent'
      }
    });
  });

  // Handle fetch/API errors globally
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const startTime = Date.now();
    try {
      const response = await originalFetch(...args);
      const duration = Date.now() - startTime;
      
      // Log API errors (4xx, 5xx)
      if (!response.ok) {
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;
        logger.error(`API Error: ${response.status} ${response.statusText}`, new Error(`${response.status} ${response.statusText}`), {
          category: 'api_call',
          details: {
            url,
            method: typeof args[0] === 'string' ? 'GET' : (args[0].method || 'GET'),
            status: response.status,
            statusText: response.statusText,
            duration
          },
          requestMethod: typeof args[0] === 'string' ? 'GET' : (args[0].method || 'GET'),
          requestPath: url,
          responseStatus: response.status
        });
      }
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      
      logger.error('Fetch Error', error, {
        category: 'api_call',
        details: {
          url,
          method: typeof args[0] === 'string' ? 'GET' : (args[0].method || 'GET'),
          duration
        },
        requestMethod: typeof args[0] === 'string' ? 'GET' : (args[0].method || 'GET'),
        requestPath: url
      });
      
      throw error;
    }
  };

  // Log console errors (but suppress harmless ones)
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    // Try to extract error information
    const errorString = args.map(arg => {
      if (arg instanceof Error) return arg.message;
      if (typeof arg === 'string') return arg;
      return JSON.stringify(arg);
    }).join(' ');

    // Suppress harmless browser extension errors
    if (errorString.includes("message channel closed") ||
        errorString.includes("asynchronous response") ||
        errorString.includes("Extension context invalidated")) {
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

    // Log real errors to console
    originalConsoleError.apply(console, args);
    
    // Don't log if it's already a logging error to avoid infinite loops
    if (!errorString.includes('Failed to log activity') && 
        !errorString.includes('Error in logActivity')) {
      logger.warning('Console Error', {
        category: 'error',
        details: {
          message: errorString,
          args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg))
        }
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
      // Unregister all existing service workers first to clear old caches
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        // Check if it's an old version
        if (registration.active?.scriptURL.includes('sw.js')) {
          const cacheVersion = await caches.keys();
          // Clear old caches
          for (const cacheName of cacheVersion) {
            if (cacheName.includes('andiamo-events-scanner-v1')) {
              await caches.delete(cacheName);
            }
          }
        }
        await registration.unregister();
      }
      
      // Wait a bit before registering new service worker
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Register new service worker
      const registration = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none' // Always check for updates
      });
      
      console.log('SW registered: ', registration);
      logger.info('Service Worker registered', {
        category: 'system',
        details: { scope: registration.scope }
      });
      
      // Check for updates immediately
      registration.update();
      
      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available, reload to activate
              window.location.reload();
            }
          });
        }
      });
    } catch (registrationError) {
      console.log('SW registration failed: ', registrationError);
      logger.error('Service Worker registration failed', registrationError, {
        category: 'system',
        details: { error: String(registrationError) }
      });
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
