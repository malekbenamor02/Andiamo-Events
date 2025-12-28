/**
 * Admin Authentication Middleware
 * 
 * This middleware verifies JWT tokens for admin/super admin routes.
 * It checks:
 * - Token presence in cookies
 * - JWT signature validity
 * - Token expiration
 * - Admin exists in database and is active
 * - Admin role (admin or super_admin)
 * 
 * Usage:
 *   const { verifyAdminAuth } = await import('./authAdminMiddleware.js');
 *   const authResult = await verifyAdminAuth(req);
 *   if (!authResult.valid) {
 *     return res.status(401).json({ error: authResult.error });
 *   }
 *   // Use authResult.admin for admin info
 */

export async function verifyAdminAuth(req) {
  try {
    // Get token from cookie
    const cookies = req.headers.cookie || '';
    const cookieMatch = cookies.match(/adminToken=([^;]+)/);
    const token = cookieMatch ? cookieMatch[1] : null;
    
    if (!token) {
      return {
        valid: false,
        error: 'No authentication token provided',
        statusCode: 401
      };
    }
    
    // Verify JWT signature and expiration
    const jwt = await import('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-dev-only';
    
    // Check if we're in production (Vercel or NODE_ENV=production)
    const isProduction = process.env.NODE_ENV === 'production' || 
                         process.env.VERCEL === '1' || 
                         !!process.env.VERCEL_URL;
    
    if (!jwtSecret || jwtSecret === 'fallback-secret-dev-only') {
      if (isProduction) {
        return {
          valid: false,
          error: 'Server configuration error: JWT_SECRET not set',
          statusCode: 500
        };
      }
    }
    
    let decoded;
    try {
      // STRICT: jwt.verify automatically checks the 'exp' field
      // If token is expired, it throws TokenExpiredError
      // This ensures the immutable expiration is enforced
      decoded = jwt.default.verify(token, jwtSecret);
    } catch (jwtError) {
      // Token is invalid, expired, or malformed
      // STRICT: Expired tokens are immediately rejected - no extension possible
      return {
        valid: false,
        error: 'Invalid or expired token',
        reason: jwtError.name === 'TokenExpiredError' 
          ? 'Token expired - session ended' 
          : jwtError.message,
        statusCode: 401
      };
    }
    
    // Check if token has required fields
    if (!decoded.id || !decoded.email || !decoded.role) {
      return {
        valid: false,
        error: 'Invalid token payload',
        statusCode: 401
      };
    }
    
    // Verify role is admin or super_admin
    if (decoded.role !== 'admin' && decoded.role !== 'super_admin') {
      return {
        valid: false,
        error: 'Invalid admin role',
        statusCode: 403
      };
    }
    
    // Check environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return {
        valid: false,
        error: 'Supabase not configured',
        statusCode: 500
      };
    }
    
    // Initialize Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    // Verify admin exists in database and is active
    const { data: admin, error: dbError } = await supabase
      .from('admins')
      .select('id, email, name, role, is_active')
      .eq('id', decoded.id)
      .eq('email', decoded.email)
      .eq('is_active', true)
      .single();
    
    if (dbError || !admin) {
      return {
        valid: false,
        error: 'Admin not found or inactive',
        statusCode: 401
      };
    }
    
    // Verify role matches
    if (admin.role !== decoded.role) {
      return {
        valid: false,
        error: 'Admin role mismatch',
        statusCode: 401
      };
    }
    
    // Calculate session expiration from token
    const tokenExpiration = decoded.exp ? decoded.exp * 1000 : null;
    const timeRemaining = tokenExpiration 
      ? Math.max(0, Math.floor((tokenExpiration - Date.now()) / 1000)) 
      : 0;
    
    // Return success with admin info
    return {
      valid: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role
      },
      sessionExpiresAt: tokenExpiration,
      sessionTimeRemaining: timeRemaining
    };
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    return {
      valid: false,
      error: 'Authentication error',
      details: error.message,
      statusCode: 500
    };
  }
}

/**
 * Express-style middleware wrapper
 * Use this in server.cjs or similar Express setups
 */
export function requireAdminAuth(req, res, next) {
  verifyAdminAuth(req).then(authResult => {
    if (!authResult.valid) {
      // Clear invalid token
      res.clearCookie('adminToken', { path: '/' });
      return res.status(authResult.statusCode || 401).json({
        error: authResult.error,
        reason: authResult.reason,
        valid: false
      });
    }
    
    // Attach admin info to request
    req.admin = authResult.admin;
    req.sessionExpiresAt = authResult.sessionExpiresAt;
    next();
  }).catch(error => {
    console.error('Auth middleware exception:', error);
    res.clearCookie('adminToken', { path: '/' });
    return res.status(500).json({
      error: 'Authentication error',
      valid: false
    });
  });
}

