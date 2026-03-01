/**
 * Sentry server-side initialization for Vercel serverless functions.
 * Import this at the top of each API file to enable error tracking.
 */
import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;
const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL_URL;
const environment = process.env.VERCEL_ENV || process.env.NODE_ENV || 'development';

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: isVercel ? 0.1 : 0,
    integrations: [],
    // Don't send default PII in serverless
    sendDefaultPii: false,
  });
}

export { Sentry };
