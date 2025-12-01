// Vercel serverless function wrapper for Express app
// This catch-all route handles all API requests

console.log('🔵 [SERVERLESS] Initializing serverless function...');

let app;
let handler;

try {
  console.log('🔵 [SERVERLESS] Loading server.cjs...');
  app = require('../server.cjs');
  console.log('✅ [SERVERLESS] server.cjs loaded successfully');
  
  console.log('🔵 [SERVERLESS] Loading serverless-http...');
  const serverless = require('serverless-http');
  console.log('✅ [SERVERLESS] serverless-http loaded successfully');
  
  console.log('🔵 [SERVERLESS] Wrapping Express app with serverless-http...');
  handler = serverless(app, {
    binary: ['image/*', 'application/pdf', 'application/octet-stream']
  });
  console.log('✅ [SERVERLESS] Handler created successfully');
} catch (error) {
  console.error('❌ [SERVERLESS] Error initializing:', error);
  console.error('❌ [SERVERLESS] Error message:', error.message);
  console.error('❌ [SERVERLESS] Error stack:', error.stack);
  
  handler = async (req, res) => {
    console.error('❌ [SERVERLESS] Handler called but initialization failed');
    res.status(500).json({ 
      error: 'Server initialization error', 
      details: error.message,
      type: error.constructor?.name
    });
  };
}

console.log('✅ [SERVERLESS] Function initialized, exporting handler');

// Export the handler
module.exports = handler;
