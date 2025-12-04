/**
 * Vercel Serverless Function - Main API Handler
 * This file wraps the Express app for Vercel serverless functions
 * All /api/* routes are handled by this function
 */

const app = require('../server/index.cjs');
const serverless = require('serverless-http');

// Configure serverless-http to preserve the /api prefix
// Vercel routes /api/* to this function, and we want to keep that path
const handler = serverless(app, {
  binary: ['image/*', 'application/pdf'],
  // Don't strip the /api prefix - Vercel already routes /api/* here
});

// Export the serverless handler
module.exports = handler;

