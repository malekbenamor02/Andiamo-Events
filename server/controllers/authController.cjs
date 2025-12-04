/**
 * Authentication controller
 * Request/response handling for authentication endpoints
 */

const { sendSuccess, sendError } = require('../middleware/errorHandler.cjs');
const authService = require('../services/authService.cjs');

/**
 * Admin login
 */
async function adminLogin(req, res) {
  try {
    const { email, password, recaptchaToken } = req.body;

    if (!email || !password) {
      return sendError(res, 'Email and password required', null, 400);
    }

    // Verify reCAPTCHA
    const recaptchaResult = await authService.verifyRecaptcha(recaptchaToken);
    if (!recaptchaResult.success && !recaptchaResult.bypassed) {
      return sendError(res, 'reCAPTCHA verification failed', recaptchaResult['error-codes']?.join(', '), 400);
    }

    // Authenticate admin
    const admin = await authService.authenticateAdmin(email, password);

    // Generate token
    const token = authService.generateToken(
      { id: admin.id, email: admin.email, role: admin.role },
      '1h'
    );

    // Set httpOnly cookie
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 1000 // 1 hour
    };

    if (isProduction && process.env.COOKIE_DOMAIN) {
      cookieOptions.domain = process.env.COOKIE_DOMAIN;
    }

    res.cookie('adminToken', token, cookieOptions);
    return sendSuccess(res, null, 'Login successful');
  } catch (error) {
    // Log error for debugging
    console.error('Admin login error:', error);
    console.error('Error stack:', error.stack);
    
    // Return appropriate error based on error type
    if (error.message === 'Supabase not configured') {
      return sendError(res, 'Server configuration error', 'Database not available', 500);
    }
    if (error.message.includes('credentials') || error.message.includes('Invalid')) {
      return sendError(res, 'Invalid credentials', null, 401);
    }
    return sendError(res, error.message || 'Login failed', process.env.NODE_ENV === 'development' ? error.stack : null, 401);
  }
}

/**
 * Admin logout
 */
function adminLogout(req, res) {
  res.clearCookie('adminToken', { path: '/' });
  return sendSuccess(res, null, 'Logout successful');
}

/**
 * Verify admin token
 */
async function verifyAdmin(req, res) {
  try {
    if (!req.admin || !req.admin.id) {
      console.error('verifyAdmin: req.admin is missing or invalid', req.admin);
      return sendError(res, 'Authentication required', null, 401);
    }

    const admin = await authService.getAdminById(req.admin.id);

    const tokenExpiration = req.admin.exp ? req.admin.exp * 1000 : null;
    const currentTime = Date.now();
    const timeRemaining = tokenExpiration ? Math.max(0, Math.floor((tokenExpiration - currentTime) / 1000)) : 0;

    return res.json({
      valid: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role
      },
      sessionExpiresAt: tokenExpiration,
      sessionTimeRemaining: timeRemaining
    });
  } catch (error) {
    console.error('verifyAdmin error:', error);
    console.error('Error stack:', error.stack);
    return sendError(res, 'Invalid admin', process.env.NODE_ENV === 'development' ? error.message : null, 401);
  }
}

/**
 * Ambassador login
 */
async function ambassadorLogin(req, res) {
  try {
    const { phone, password, recaptchaToken } = req.body;

    if (!phone || !password) {
      return sendError(res, 'Phone and password required', null, 400);
    }

    // Verify reCAPTCHA
    const recaptchaResult = await authService.verifyRecaptcha(recaptchaToken);
    if (!recaptchaResult.success && !recaptchaResult.bypassed) {
      return sendError(res, 'reCAPTCHA verification failed', recaptchaResult['error-codes']?.join(', '), 400);
    }

    // Authenticate ambassador
    const ambassador = await authService.authenticateAmbassador(phone, password);

    // Generate token
    const token = authService.generateToken(
      { id: ambassador.id, phone: ambassador.phone, role: 'ambassador' },
      '24h'
    );

    // Set httpOnly cookie
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    };

    if (isProduction && process.env.COOKIE_DOMAIN) {
      cookieOptions.domain = process.env.COOKIE_DOMAIN;
    }

    res.cookie('ambassadorToken', token, cookieOptions);
    return sendSuccess(res, null, 'Login successful');
  } catch (error) {
    // Prevent enumeration - return same error for invalid credentials
    if (error.message.includes('credentials') || error.message.includes('Invalid')) {
      return sendError(res, 'Invalid credentials', null, 401);
    }
    // Return specific error for status issues
    if (error.message.includes('review') || error.message.includes('approved')) {
      return sendError(res, error.message, null, 403);
    }
    return sendError(res, error.message || 'Login failed', null, 401);
  }
}

/**
 * Ambassador logout
 */
function ambassadorLogout(req, res) {
  res.clearCookie('ambassadorToken', { path: '/' });
  return sendSuccess(res, null, 'Logout successful');
}

/**
 * Verify ambassador token
 */
async function verifyAmbassador(req, res) {
  try {
    const ambassador = await authService.getAmbassadorById(req.ambassador.id);

    const tokenExpiration = req.ambassador.exp ? req.ambassador.exp * 1000 : null;
    const currentTime = Date.now();
    const timeRemaining = tokenExpiration ? Math.max(0, Math.floor((tokenExpiration - currentTime) / 1000)) : 0;

    return res.json({
      valid: true,
      ambassador: {
        id: ambassador.id,
        full_name: ambassador.full_name,
        phone: ambassador.phone,
        email: ambassador.email,
        city: ambassador.city,
        ville: ambassador.ville
      },
      sessionExpiresAt: tokenExpiration,
      sessionTimeRemaining: timeRemaining
    });
  } catch (error) {
    res.clearCookie('ambassadorToken', { path: '/' });
    return sendError(res, 'Invalid ambassador', null, 401);
  }
}

/**
 * Verify reCAPTCHA
 */
async function verifyRecaptcha(req, res) {
  try {
    const { recaptchaToken } = req.body;

    if (!recaptchaToken) {
      return sendError(res, 'reCAPTCHA token is required', null, 400);
    }

    // Bypass for localhost
    if (recaptchaToken === 'localhost-bypass-token') {
      return sendSuccess(res, { bypassed: true }, 'reCAPTCHA bypassed for localhost');
    }

    const result = await authService.verifyRecaptcha(recaptchaToken);
    
    if (!result.success) {
      return sendError(res, 'reCAPTCHA verification failed', result['error-codes'] || [], 400);
    }

    return sendSuccess(res, null, 'reCAPTCHA verified successfully');
  } catch (error) {
    return sendError(res, error.message || 'reCAPTCHA verification failed', null, 500);
  }
}

module.exports = {
  adminLogin,
  adminLogout,
  verifyAdmin,
  ambassadorLogin,
  ambassadorLogout,
  verifyAmbassador,
  verifyRecaptcha
};

