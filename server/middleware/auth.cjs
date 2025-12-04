/**
 * Authentication middleware
 * JWT token verification for protected routes
 */

const jwt = require('jsonwebtoken');
const { getSupabase } = require('../utils/supabase.cjs');

/**
 * Require admin authentication
 * Verifies JWT token from httpOnly cookie
 */
function requireAdminAuth(req, res, next) {
  const token = req.cookies.adminToken;
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Not authenticated', 
      reason: 'No token provided' 
    });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({ 
          error: 'Server configuration error: JWT_SECRET is required in production.' 
        });
      }
      console.warn('WARNING: JWT_SECRET is not set! Using fallback secret for development only.');
    }

    if (!jwtSecret || jwtSecret === 'fallback-secret-dev-only') {
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({ 
          error: 'Server configuration error: JWT_SECRET must be set in production.' 
        });
      }
    }

    // jwt.verify automatically checks expiration
    const decoded = jwt.verify(token, jwtSecret || 'fallback-secret-dev-only');
    req.admin = decoded;
    next();
  } catch (err) {
    // Token is invalid, expired, or malformed
    res.clearCookie('adminToken', { path: '/' });
    return res.status(401).json({ 
      error: 'Invalid or expired token', 
      reason: err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'
    });
  }
}

/**
 * Require ambassador authentication
 * Verifies JWT token from httpOnly cookie
 */
function requireAmbassadorAuth(req, res, next) {
  const token = req.cookies.ambassadorToken;
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Not authenticated', 
      reason: 'No token provided' 
    });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-dev-only';
    
    if (!jwtSecret || jwtSecret === 'fallback-secret-dev-only') {
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({ 
          error: 'Server configuration error: JWT_SECRET must be set in production.' 
        });
      }
    }

    const decoded = jwt.verify(token, jwtSecret);
    
    if (decoded.role !== 'ambassador') {
      return res.status(403).json({ 
        error: 'Forbidden', 
        reason: 'Invalid token role' 
      });
    }

    req.ambassador = decoded;
    next();
  } catch (err) {
    res.clearCookie('ambassadorToken', { path: '/' });
    return res.status(401).json({ 
      error: 'Invalid or expired token', 
      reason: err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'
    });
  }
}

/**
 * Optional admin authentication
 * Sets req.admin if token is valid, but doesn't require it
 */
function optionalAdminAuth(req, res, next) {
  const token = req.cookies.adminToken;
  
  if (!token) {
    return next();
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-dev-only';
    const decoded = jwt.verify(token, jwtSecret);
    req.admin = decoded;
  } catch (err) {
    // Ignore errors for optional auth
  }
  
  next();
}

module.exports = {
  requireAdminAuth,
  requireAmbassadorAuth,
  optionalAdminAuth
};

