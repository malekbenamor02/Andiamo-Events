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
    binary: ['image/*', 'application/pdf', 'application/octet-stream']
  });
} catch (error) {
  console.error('Error initializing serverless function:', error);
  handler = async (req, res) => {
    res.status(500).json({ 
      error: 'Server initialization error', 
      details: error.message 
    });
  };
}

// Export the handler
module.exports = handler;
