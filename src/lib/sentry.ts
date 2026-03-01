/**
 * Sentry client initialization for error tracking.
 * Import this at the top of main.tsx before other app code.
 */
import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;
const environment = import.meta.env.MODE;
const isProduction = import.meta.env.PROD;

export function initSentry() {
  // Only initialize if DSN is configured
  if (!dsn) {
    if (isProduction) {
      console.warn('[Sentry] VITE_SENTRY_DSN not set - error tracking disabled');
    }
    return;
  }

  Sentry.init({
    dsn,
    environment: environment || (isProduction ? 'production' : 'development'),
    sendDefaultPii: true,
    enableLogs: true,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
      Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
    ],
    tracesSampleRate: isProduction ? 0.1 : 0,
    replaysSessionSampleRate: isProduction ? 0.1 : 0,
    replaysOnErrorSampleRate: isProduction ? 1 : 0,
    ignoreErrors: [
      'message channel closed',
      'asynchronous response',
      'A listener indicated an asynchronous response',
      'Extension context invalidated',
      'Could not establish connection',
      'Receiving end does not exist',
      'ERR_BLOCKED_BY_CLIENT',
      'ERR_CONNECTION_CLOSED',
      'Non-Error promise rejection captured',
    ],
    denyUrls: [
      /chrome-extension:\/\//i,
      /moz-extension:\/\//i,
      /safari-extension:\/\//i,
      /edge-extension:\/\//i,
    ],
  });
}

export { Sentry };
