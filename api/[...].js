// Vercel serverless function wrapper for Express app
// This catch-all route handles all API requests

// Use dynamic import to avoid issues with module resolution
let app;
let handler;

try {
  // Import the Express app
  app = require('../server.cjs');
  
  // Wrap with serverless-http
  const serverless = require('serverless-http');
  handler = serverless(app, {
    binary: ['image/*', 'application/pdf', 'application/octet-stream'],
    request: (request, event, context) => {
      // Log request for debugging
      console.log('Serverless request:', {
        path: request.path,
        method: request.method,
        url: request.url,
        vercel: process.env.VERCEL === '1',
        vercelUrl: process.env.VERCEL_URL
      });
    }
  });
} catch (error) {
  console.error('Error initializing serverless function:', error);
  handler = async (req, res) => {
    console.error('Serverless function error:', error);
    res.status(500).json({ 
      error: 'Server initialization error', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  };
}

// Export the handler
module.exports = handler;
