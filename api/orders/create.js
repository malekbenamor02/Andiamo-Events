// Proxy route handler for /api/orders/create
// Routes to server.cjs Express app using serverless-http
// This ensures the route is available on Vercel serverless functions

import serverless from 'serverless-http';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Import the Express app from server.cjs
const app = require('../../server.cjs');

// Wrap with serverless-http
const handler = serverless(app, {
  binary: ['image/*', 'application/pdf'],
});

export default async (req, res) => {
  try {
    return await handler(req, res);
  } catch (error) {
    console.error('API route handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  }
};
