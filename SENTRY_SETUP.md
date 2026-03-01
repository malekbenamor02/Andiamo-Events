# Sentry Error Tracking Setup

Sentry is configured for error tracking across the entire site (frontend + backend).

## Environment Variables

Add these to your `.env` (and Vercel Environment Variables for production):

### Required (to enable Sentry)
| Variable | Where | Description |
|----------|-------|-------------|
| `VITE_SENTRY_DSN` | Frontend | Your Sentry DSN for the React app. Get it from Sentry → Project Settings → Client Keys (DSN) |
| `SENTRY_DSN` | Backend | Same DSN or create a separate Node.js project in Sentry for backend errors |

### Optional (for source map uploads)
Source maps let Sentry show original code in stack traces instead of minified code.

| Variable | Where | Description |
|----------|-------|-------------|
| `SENTRY_ORG` | Build | Your Sentry org slug (from sentry.io URL) |
| `SENTRY_PROJECT` | Build | Your Sentry project slug |
| `SENTRY_AUTH_TOKEN` | Build | Create at Sentry → Settings → Auth Tokens. Needs `project:releases` and `org:read` |

## Getting Your DSN

1. Log in to [sentry.io](https://sentry.io)
2. Go to your project (or create one: **React** for frontend, **Node.js/Express** for backend)
3. **Settings** → **Client Keys (DSN)** → copy the DSN

You can use the **same project** for both frontend and backend, or create separate projects.

## What's Configured

- **Frontend**: Errors, unhandled rejections, API errors, React Error Boundary, Session Replay (10% sample), Performance tracing
- **Backend**: Express middleware on `server.cjs`, Sentry init in `misc.js`, `orders-create.js`, `scan.js` (add `import '../lib/sentry-server.js'` to other API files as needed)
- **Source maps**: Uploaded on `npm run build` when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` are set

## Adding Sentry to More API Files

To enable Sentry in other Vercel serverless functions (e.g. `api/pos.js`, `api/admin-pos.js`), add at the top:

```javascript
import '../lib/sentry-server.js';
```

## Manual Error Capture & Logging

### Exceptions
```javascript
import { Sentry } from '@/lib/sentry';

try {
  riskyOperation();
} catch (error) {
  Sentry.captureException(error);
  throw error;
}
```

### Structured Logs (when `enableLogs: true`)
```javascript
import { Sentry } from '@/lib/sentry';

const { logger } = Sentry;
logger.info('User completed checkout', { orderId: '123', amount: 99.99 });
logger.warn('Rate limit approached', { endpoint: '/api/orders' });
logger.error('Payment failed', { orderId: '123', reason: error.message });
```

### Custom Spans (tracing)
```javascript
import { Sentry } from '@/lib/sentry';

// In component actions (e.g. button click)
const handleSubmit = () => {
  Sentry.startSpan(
    { op: 'ui.click', name: 'Order Submit Click' },
    (span) => {
      span.setAttribute('eventId', eventId);
      submitOrder();
    }
  );
};

// In API calls
const data = await Sentry.startSpan(
  { op: 'http.client', name: `POST /api/orders/create` },
  async () => {
    const res = await fetch('/api/orders/create', { method: 'POST', body: payload });
    return res.json();
  }
);
```
