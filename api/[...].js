// Vercel serverless function wrapper for Express app
// This catch-all route handles all API requests

const serverless = require('serverless-http');
const app = require('../server.cjs');

// Wrap the Express app with serverless-http for Vercel compatibility
module.exports = serverless(app);
