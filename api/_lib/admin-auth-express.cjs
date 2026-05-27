'use strict';

const jwt = require('jsonwebtoken');

/** Same rules as server.cjs requireAdminAuth (HttpOnly adminToken cookie). */
function requireAdminAuth(req, res, next) {
  try {
    const token = req.cookies?.adminToken;
    if (!token) {
      return res.status(401).json({
        error: 'Not authenticated',
        reason: 'No token provided',
        valid: false,
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
        return res.status(500).json({
          error: 'Server configuration error',
          details: 'JWT_SECRET is required in production.',
          valid: false,
        });
      }
    }

    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret || 'fallback-secret-dev-only');
    } catch (jwtError) {
      res.clearCookie('adminToken', { path: '/' });
      return res.status(401).json({
        error: 'Invalid or expired token',
        reason: jwtError.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token',
        valid: false,
      });
    }

    if (!decoded.id || !decoded.email || !decoded.role) {
      res.clearCookie('adminToken', { path: '/' });
      return res.status(401).json({
        error: 'Invalid token',
        reason: 'Token payload is invalid',
        valid: false,
      });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    res.clearCookie('adminToken', { path: '/' });
    return res.status(500).json({
      error: 'Authentication error',
      details: 'An unexpected error occurred during authentication',
      valid: false,
    });
  }
}

module.exports = { requireAdminAuth };
