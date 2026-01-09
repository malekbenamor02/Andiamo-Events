// Proxy route handler for /api/flouci/generate
// Routes to server.cjs Express app using serverless-http

import serverless from 'serverless-http';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../server.cjs');
const handler = serverless(app, { binary: ['image/*', 'application/pdf'] });

export default async (req, res) => {
  try {
    return await handler(req, res);
  } catch (error) {
    console.error('API route handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error', message: error.message });
    }
  }
};
