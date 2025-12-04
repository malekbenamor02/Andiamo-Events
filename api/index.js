/**
 * Vercel Serverless Function - Main API Handler
 * This file wraps the Express app for Vercel serverless functions
 * All /api/* routes are handled by this function
 */

const app = require('../server/index.cjs');
const serverless = require('serverless-http');

// Export the serverless handler
module.exports = serverless(app);

