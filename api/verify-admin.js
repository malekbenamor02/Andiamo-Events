// Verify admin endpoint for Vercel
// Uses dedicated authentication middleware for clean, secure verification

import { verifyAdminAuth } from './authAdminMiddleware.js';

export default async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Use authentication middleware
  const authResult = await verifyAdminAuth(req);
  
  if (!authResult.valid) {
    // Clear invalid token
    res.clearCookie('adminToken', { path: '/' });
    return res.status(authResult.statusCode || 401).json({
      valid: false,
      error: authResult.error,
      reason: authResult.reason
    });
  }
  
  // Return admin info with session expiration
  // NO new token is generated - session continues with original expiration
  return res.status(200).json({
    valid: true,
    admin: authResult.admin,
    sessionExpiresAt: authResult.sessionExpiresAt,
    sessionTimeRemaining: authResult.sessionTimeRemaining
  });
};



