// Unified API router for Vercel - handles all API routes in a single serverless function
// This avoids the 12-function limit on Hobby plan

export default async (req, res) => {
  const path = req.url.split('?')[0]; // Remove query string
  const method = req.method;
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Route to appropriate handler
  try {
    // Admin routes
    if (path === '/api/admin-login' && method === 'POST') {
      const handler = await import('./handlers/admin-login.js');
      return handler.default(req, res);
    }
    
    if (path === '/api/admin-logout' && method === 'POST') {
      const handler = await import('./handlers/admin-logout.js');
      return handler.default(req, res);
    }
    
    if (path === '/api/admin-update-application' && method === 'POST') {
      const handler = await import('./handlers/admin-update-application.js');
      return handler.default(req, res);
    }
    
    if (path === '/api/admin-approve-order' && method === 'POST') {
      const handler = await import('./handlers/admin-approve-order.js');
      return handler.default(req, res);
    }
    
    if (path === '/api/verify-admin' && method === 'GET') {
      const handler = await import('./handlers/verify-admin.js');
      return handler.default(req, res);
    }
    
    // Ambassador routes
    if (path === '/api/ambassador-login' && method === 'POST') {
      const handler = await import('./handlers/ambassador-login.js');
      return handler.default(req, res);
    }
    
    if (path === '/api/ambassador-application' && method === 'POST') {
      const handler = await import('./handlers/ambassador-application.js');
      return handler.default(req, res);
    }
    
    if (path === '/api/ambassadors/active' && method === 'GET') {
      const handler = await import('./handlers/ambassadors/active.js');
      return handler.default(req, res);
    }
    
    // Order routes
    if (path === '/api/orders/create' && method === 'POST') {
      const handler = await import('./handlers/orders/create.js');
      return handler.default(req, res);
    }
    
    // Pass routes - dynamic route
    if (path.startsWith('/api/passes/') && method === 'GET') {
      const eventId = path.replace('/api/passes/', '');
      // Pass eventId as query parameter for compatibility
      req.query = { ...req.query, eventId };
      const handler = await import('./handlers/passes/[eventId].js');
      return handler.default(req, res);
    }
    
    // Other routes
    if (path === '/api/phone-subscribe' && method === 'POST') {
      const handler = await import('./handlers/phone-subscribe.js');
      return handler.default(req, res);
    }
    
    if (path === '/api/send-email' && method === 'POST') {
      const handler = await import('./handlers/send-email.js');
      return handler.default(req, res);
    }
    
    // 404 for unknown routes
    return res.status(404).json({
      error: 'Not Found',
      message: `API route not found: ${path}`
    });
    
  } catch (error) {
    console.error('API Router Error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message
    });
  }
};
