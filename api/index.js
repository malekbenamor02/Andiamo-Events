/**
 * Vercel Serverless Function - Main API Handler
 * This file wraps the Express app for Vercel serverless functions
 * All /api/* routes are handled by this function
 * 
 * Vercel routing:
 * - Request to /api/admin-login → routes to api/index.js
 * - The path in Express will be /api/admin-login (full path preserved)
 */

const app = require('../server/index.cjs');
const serverless = require('serverless-http');

// Configure serverless-http
// Vercel automatically routes /api/* to this function
// The Express app expects paths starting with /api
const handler = serverless(app, {
  binary: ['image/*', 'application/pdf'],
  // Request path is preserved as-is by Vercel
  // Express routes are already set up with /api prefix
});

// Export the serverless handler
module.exports = handler;

