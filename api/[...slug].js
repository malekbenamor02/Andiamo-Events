// Catch-all API handler for Vercel serverless functions
// This single handler routes ALL API requests (except those with specific handlers)
// to server.cjs Express app using serverless-http
//
// IMPORTANT: This file uses ES module syntax (package.json has "type": "module")
// server.cjs is CommonJS, so we use createRequire to import it
//
// This approach keeps us under Vercel Hobby plan's 12 function limit by
// consolidating routes into a single catch-all handler
//
// Vercel routing precedence:
// - Specific routes (e.g., api/admin-login.js) take precedence
// - Catch-all (this file) handles all unmatched routes

import serverless from 'serverless-http';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Import the Express app from server.cjs (CommonJS module)
// server.cjs exports the Express app with: module.exports = app;
const app = require('../server.cjs');

// Wrap the Express app with serverless-http for Vercel serverless functions
// serverless-http preserves the original request URL path, so Express routing works correctly
const handler = serverless(app, {
  // Request/response binary encoding for proper handling
  binary: ['image/*', 'application/pdf'],
});

// Export as default handler for Vercel serverless function
// CRITICAL: Reconstruct the full request path from slug parameter
// Vercel's catch-all route provides path segments in req.query.slug
// We need to reconstruct the full path for Express routing to work correctly
export default async (req, res) => {
  try {
    // Get the slug parameter (array of path segments)
    const slug = req.query.slug || [];
    
    // Reconstruct the full API path
    // e.g., slug = ['orders', 'create'] -> '/api/orders/create'
    const pathSegments = Array.isArray(slug) ? slug : [slug];
    const reconstructedPath = `/api/${pathSegments.join('/')}`;
    
    // Preserve the original request properties but update the path
    // This ensures Express receives the correct route path
    const modifiedReq = {
      ...req,
      url: reconstructedPath + (req.url?.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''),
      path: reconstructedPath,
      originalUrl: reconstructedPath + (req.url?.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''),
    };
    
    // Execute the serverless handler with the modified request
    return await handler(modifiedReq, res);
  } catch (error) {
    console.error('Catch-all API handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  }
};
