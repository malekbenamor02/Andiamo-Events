// Direct serverless function for admin-login to debug issues
// This bypasses the catch-all route to ensure the endpoint works

const serverless = require('serverless-http');
const app = require('../server.cjs');

// Export the handler
module.exports = serverless(app);

