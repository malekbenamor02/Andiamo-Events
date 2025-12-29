const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const https = require('https');
const querystring = require('querystring');

// Load environment variables
// On Vercel, environment variables are already available, but dotenv is safe to call
try {
  require('dotenv').config();
} catch (e) {
  // dotenv might not be available, but that's OK on Vercel
}

// Debug: Log environment variables
// Check environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.warn('Warning: Supabase environment variables not configured. Admin login functionality will be disabled.');
}
if (!process.env.JWT_SECRET) {
  console.warn('Warning: JWT_SECRET not configured. Using fallback (insecure for production).');
}

// Initialize Supabase client only if environment variables are available
let supabase = null;
let supabaseService = null; // Service role client for storage operations
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  // Supabase client initialized
  
  // Also create service role client if available (for storage operations)
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabaseService = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  } else {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not set - storage operations may fail. Using anon key instead.');
  }
} else {
  // Supabase client not initialized - admin login disabled
}

const app = express();

// CORS configuration - allow all origins in development, specific origins in production
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'])
  : ['http://localhost:8080', 'http://localhost:3000', 'http://192.168.1.*', 'http://10.0.*', 'http://127.0.0.1:3000', /^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin matches allowed patterns
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        // Support wildcard patterns
        if (allowed.includes('*')) {
          const pattern = allowed.replace(/\*/g, '.*');
          return new RegExp(`^${pattern}$`).test(origin);
        }
        return origin === allowed;
      }
      // Regex pattern
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      // On Vercel, allow same-origin requests
      const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_URL;
      if (isVercel && origin && (origin.includes(process.env.VERCEL_URL || '') || origin.includes(process.env.VERCEL_BRANCH_URL || ''))) {
        return callback(null, true);
      }
      // In development, allow all origins
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        // In production, if on Vercel, allow same-origin
        if (isVercel) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Middleware to handle Vercel serverless function paths
// Vercel strips the /api prefix, so we need to add it back for route matching
app.use((req, res, next) => {
  // If running on Vercel and path doesn't start with /api, add it
  if ((process.env.VERCEL === '1' || process.env.VERCEL_URL) && !req.path.startsWith('/api')) {
    req.url = '/api' + req.url;
    req.path = '/api' + req.path;
  }
  next();
});

// Configure SMTP transporter using environment variables
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Helper function to create rate limiters (disabled in local development)
const createRateLimiter = (config) => {
  // Disable rate limiting in local development (not production or Vercel)
  const isLocalDev = process.env.NODE_ENV !== 'production' && 
                     !process.env.VERCEL && 
                     !process.env.VERCEL_URL;
  
  if (isLocalDev) {
    // Return a pass-through middleware that does nothing in development
    return (req, res, next) => next();
  }
  
  // Apply rate limiting in production
  return rateLimit(config);
};

// Rate limiters with different tiers (disabled in local development)
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const applicationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 applications per hour
  message: { error: 'Too many applications submitted, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const recaptchaLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 verifications per 15 minutes
  message: { error: 'Too many verification requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const emailLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 emails per 15 minutes
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const ogImageLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes (allows social media crawlers)
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyAdminLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per 15 minutes (called frequently for session checks)
  message: { error: 'Too many verification requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const adminLogoutLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 logout requests per 15 minutes
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/send-email', emailLimiter);

app.post('/api/send-email', requireAdminAuth, async (req, res) => {
  try {
    const { to, subject, html } = req.body;
    
    // Validate required fields
    if (!to || !subject || !html) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        details: 'to, subject, and html are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ 
        error: 'Invalid email address', 
        details: `The email address "${to}" is not valid. Please verify the email address and try again.` 
      });
    }
    
    // Check if email configuration is available
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error('Email configuration missing: EMAIL_USER or EMAIL_PASS not set');
      return res.status(500).json({ 
        error: 'Email service not configured', 
        details: 'Email server configuration is missing. Please contact the administrator.' 
      });
    }
    
    await transporter.sendMail({
      from: `Andiamo Events <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Email sending failed:', error);
    
    // Provide more specific error messages based on error type
    let errorMessage = 'Failed to send email';
    let errorDetails = error.message || 'Unknown error occurred';
    
    // Check for common SMTP errors
    if (error.code === 'EAUTH' || error.responseCode === 535) {
      errorMessage = 'Email authentication failed';
      errorDetails = 'The email server credentials are invalid. Please contact the administrator.';
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Email server connection failed';
      errorDetails = 'Unable to connect to the email server. Please try again later.';
    } else if (error.responseCode === 550 || error.message?.includes('550')) {
      errorMessage = 'Email address rejected';
      errorDetails = `The email address "${req.body.to}" was rejected by the email server. Please verify the email address and try again.`;
    } else if (error.responseCode === 553 || error.message?.includes('553')) {
      errorMessage = 'Invalid email address';
      errorDetails = `The email address "${req.body.to}" is invalid. Please verify the email address and try again.`;
    }
    
    res.status(500).json({ 
      error: errorMessage, 
      details: errorDetails 
    });
  }
});

// Test endpoint to verify serverless function is working
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API is working',
    vercel: process.env.VERCEL === '1',
    vercelUrl: process.env.VERCEL_URL,
    nodeEnv: process.env.NODE_ENV,
    hasSupabase: !!supabase,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
    hasJwtSecret: !!process.env.JWT_SECRET,
    timestamp: new Date().toISOString()
  });
});

// Diagnostic endpoint to test Supabase connection
app.get('/api/test-supabase', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ 
        error: 'Supabase not initialized',
        hasUrl: !!process.env.SUPABASE_URL,
        hasKey: !!process.env.SUPABASE_ANON_KEY
      });
    }
    
    // Try to query admins table
    const { data, error } = await supabase
      .from('admins')
      .select('id, email')
      .limit(1);
    
    if (error) {
      return res.status(500).json({ 
        error: 'Supabase query failed',
        details: error.message,
        code: error.code
      });
    }
    
    res.json({ 
      success: true,
      message: 'Supabase connection working',
      adminCount: data?.length || 0,
      sampleAdmin: data?.[0] || null
    });
  } catch (err) {
    res.status(500).json({ 
      error: 'Supabase test failed',
      details: err.message
    });
  }
});

// Email tracking pixel endpoint
// This endpoint is called when an email is opened (via tracking pixel)
// Returns a 1x1 transparent PNG image and logs the email open event
app.get('/api/track-email', async (req, res) => {
  try {
    const { ambassador_id, email_type } = req.query;

    // Validate required parameters
    if (!ambassador_id || !email_type) {
      // Still return image even if params are missing (silent fail for tracking)
      return res.type('image/png').send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
    }

    // Validate email_type
    if (!['approval', 'rejection', 'reset'].includes(email_type)) {
      return res.type('image/png').send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
    }

    // Log the email open event (if supabase is available)
    if (supabase) {
      try {
        const userAgent = req.get('user-agent') || null;
        const ipAddress = req.ip || req.connection.remoteAddress || null;

        await supabase
          .from('email_tracking')
          .insert({
            ambassador_id: ambassador_id,
            email_type: email_type,
            user_agent: userAgent,
            ip_address: ipAddress,
            opened_at: new Date().toISOString()
          });
      } catch (trackingError) {
        // Silently fail tracking - don't break email rendering
        console.error('Email tracking error (non-fatal):', trackingError);
      }
    }

    // Return 1x1 transparent PNG image
    // Base64 encoded 1x1 transparent PNG
    const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    res.type('image/png').send(transparentPixel);
  } catch (error) {
    // Always return the image even on error (silent fail for tracking)
    console.error('Email tracking endpoint error:', error);
    const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    res.type('image/png').send(transparentPixel);
  }
});

// Admin login endpoint
app.post('/api/admin-login', authLimiter, async (req, res) => {
  try {
    
    if (!supabase) {
      console.error('❌ Supabase not configured');
      console.error('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET');
      console.error('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
      return res.status(500).json({ 
        error: 'Supabase not configured',
        details: 'Please check environment variables: SUPABASE_URL and SUPABASE_ANON_KEY must be set'
      });
    }
    
    const { email, password, recaptchaToken } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Bypass reCAPTCHA verification for localhost development
    // Also allow bypass if RECAPTCHA_SECRET_KEY is not set (for testing)
    const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
    const shouldBypassRecaptcha = recaptchaToken === 'localhost-bypass-token' || !RECAPTCHA_SECRET_KEY;
    
    if (shouldBypassRecaptcha) {
      if (!RECAPTCHA_SECRET_KEY) {
      } else {
      }
      // Continue with login without reCAPTCHA verification
    } else {
      // Verify reCAPTCHA for production
      if (!recaptchaToken) {
        return res.status(400).json({ error: 'reCAPTCHA verification required' });
      }
      
      try {
        const verifyResponse = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `secret=${RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`
        });

        const verifyData = await verifyResponse.json();
        
        if (!verifyData.success) {
          console.error('reCAPTCHA verification failed:', verifyData);
          return res.status(400).json({ 
            error: 'reCAPTCHA verification failed',
            details: verifyData['error-codes']?.join(', ') || 'Please complete the reCAPTCHA verification and try again.'
          });
        }
      } catch (recaptchaError) {
        console.error('reCAPTCHA verification error:', recaptchaError);
        return res.status(500).json({ 
          error: 'reCAPTCHA verification service unavailable',
          details: 'Unable to verify reCAPTCHA. Please try again later.'
        });
      }
    }
    
    // Fetch admin by email
    
    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email.toLowerCase().trim()) // Normalize email
      .single();
      
    if (error) {
      console.error('Supabase error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      return res.status(401).json({ 
        error: 'Invalid credentials', 
        details: error.message,
        code: error.code 
      });
    }
    
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    
    if (!admin.password) {
      console.error('Admin has no password field');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    // Compare password
    let isMatch;
    try {
      isMatch = await bcrypt.compare(password, admin.password);
    } catch (bcryptError) {
      console.error('Bcrypt comparison error:', bcryptError);
      console.error('Bcrypt error stack:', bcryptError.stack);
      return res.status(500).json({ error: 'Server error', details: 'Password verification failed' });
    }
    
    if (!isMatch) {
      // Don't reveal too much info, but log for debugging
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    
    // Generate JWT (1 hour fixed session - expiration encoded in token)
    // The session countdown starts from login and continues regardless of user activity
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.warn('WARNING: JWT_SECRET is not set! Using fallback secret. This is insecure in production.');
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({ error: 'Server configuration error: JWT_SECRET is required in production.' });
      }
    }
    
    let token;
    try {
      // 1 hour expiration - encoded in JWT, cannot be extended
      token = jwt.sign({ id: admin.id, email: admin.email, role: admin.role }, jwtSecret || 'fallback-secret-dev-only', { expiresIn: '1h' });
    } catch (jwtError) {
      console.error('JWT signing error:', jwtError);
      return res.status(500).json({ error: 'Server error', details: 'Failed to generate token' });
    }
    
    // Determine cookie settings based on environment
    // IMPORTANT: The cookie maxAge matches the JWT expiration (1 hour)
    // This ensures the cookie expires at the same time as the JWT
    // The session timer starts at login and continues regardless of:
    // - Page refreshes
    // - Navigation between pages
    // - Browser close/reopen
    // - Opening multiple tabs
    // The timer does NOT restart on any activity
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true, // Prevents JavaScript access - security feature
      secure: isProduction, // Use secure cookies in production (HTTPS)
      sameSite: 'lax', // More permissive for cross-site requests
      path: '/', // Ensure cookie is available for all paths
      maxAge: 60 * 60 * 1000 // 1 hour (matches JWT expiration) - fixed expiration, cannot be extended
    };
    
    // Only set domain in production or if explicitly configured
    // Don't set domain for localhost - it breaks cookie setting
    if (isProduction && process.env.COOKIE_DOMAIN) {
      cookieOptions.domain = process.env.COOKIE_DOMAIN;
    }
    
      httpOnly: cookieOptions.httpOnly,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      path: cookieOptions.path,
      maxAge: cookieOptions.maxAge,
      domain: cookieOptions.domain || 'not set'
    });
    
    res.cookie('adminToken', token, cookieOptions);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Admin login error:', error);
    console.error('❌ Error type:', error?.constructor?.name);
    console.error('❌ Error message:', error?.message);
    console.error('❌ Error stack:', error?.stack);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

// Verify reCAPTCHA endpoint
app.post('/api/verify-recaptcha', recaptchaLimiter, async (req, res) => {
  try {
    const { recaptchaToken } = req.body;

    if (!recaptchaToken) {
      return res.status(400).json({ error: 'reCAPTCHA token is required' });
    }

    // Bypass reCAPTCHA verification for localhost development
    if (recaptchaToken === 'localhost-bypass-token') {
      return res.status(200).json({ 
        success: true,
        message: 'reCAPTCHA bypassed for localhost'
      });
    }

    const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
    
    if (!RECAPTCHA_SECRET_KEY) {
      console.error('RECAPTCHA_SECRET_KEY is not set in environment variables');
      return res.status(500).json({ 
        success: false,
        error: 'Server configuration error',
        details: 'reCAPTCHA secret key is not configured. Please set RECAPTCHA_SECRET_KEY in environment variables.'
      });
    }

    // Verify with Google reCAPTCHA API
    const verifyResponse = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`
    });

    const verifyData = await verifyResponse.json();

    if (!verifyData.success) {
      console.error('reCAPTCHA verification failed:', verifyData);
      return res.status(400).json({ 
        success: false,
        error: 'reCAPTCHA verification failed',
        details: verifyData['error-codes'] || []
      });
    }

    res.status(200).json({ 
      success: true,
      message: 'reCAPTCHA verified successfully'
    });
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Update sales settings endpoint
app.post('/api/update-sales-settings', requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    // Get the enabled value from request body
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Invalid request: enabled must be a boolean' });
    }

    // Update or insert sales settings
    const { data, error } = await supabase
      .from('site_content')
      .upsert({
        key: 'sales_settings',
        content: { enabled },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating sales settings:', error);
      return res.status(500).json({ 
        error: 'Failed to update settings',
        details: error.message 
      });
    }

    res.status(200).json({ 
      success: true, 
      settings: data 
    });
  } catch (error) {
    console.error('Error in update-sales-settings:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Admin logout endpoint
app.post('/api/admin-logout', adminLogoutLimiter, (req, res) => {
  res.clearCookie('adminToken');
  res.json({ success: true });
});

// Admin verify endpoint
// IMPORTANT: This endpoint does NOT extend or refresh the session
// The JWT expiration is fixed at 1 hour from login and cannot be changed
// Refreshing the page, navigating, or closing/reopening the browser does NOT restart the timer
// The session countdown continues from the original login time
app.get('/api/verify-admin', verifyAdminLimiter, requireAdminAuth, async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ valid: false, error: 'Supabase not configured' });
  }
  
  try {
    // Verify admin exists in database and is active
    // Note: requireAdminAuth middleware already verified the JWT token expiration
    // If token is expired, this endpoint will never be reached (401 returned by middleware)
    const { data: admin, error } = await supabase
      .from('admins')
      .select('id, email, name, role, is_active')
      .eq('id', req.admin.id)
      .eq('email', req.admin.email)
      .eq('is_active', true)
      .single();

    if (error || !admin) {
      return res.status(401).json({ valid: false, error: 'Invalid admin' });
    }

    // Return admin info with token expiration time
    // req.admin contains the decoded JWT which includes 'exp' (expiration timestamp)
    // This allows the frontend to calculate remaining session time accurately
    const tokenExpiration = req.admin.exp ? req.admin.exp * 1000 : null; // Convert to milliseconds
    const currentTime = Date.now();
    const timeRemaining = tokenExpiration ? Math.max(0, Math.floor((tokenExpiration - currentTime) / 1000)) : 0; // Remaining seconds

    // Return admin info - NO new token is issued, session continues with original expiration
    res.json({ 
      valid: true, 
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
      sessionExpiresAt: tokenExpiration, // Unix timestamp in milliseconds
      sessionTimeRemaining: timeRemaining // Remaining seconds
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ valid: false, error: 'Invalid token' });
  }
});

// Admin update application status endpoint (approve/reject)
// GET handler for testing
app.get('/api/admin-update-application', (req, res) => {
  res.status(405).json({ 
    error: 'Method not allowed',
    message: 'This endpoint only accepts POST requests. Use POST with applicationId and status in the body.',
    example: {
      method: 'POST',
      url: '/api/admin-update-application',
      body: {
        applicationId: 'uuid-here',
        status: 'approved' // or 'rejected'
      }
    }
  });
});

// POST handler for actual updates
app.post('/api/admin-update-application', requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { applicationId, status, reapply_delay_date } = req.body;

    if (!applicationId || !status) {
      return res.status(400).json({ error: 'applicationId and status are required' });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be "approved" or "rejected"' });
    }

    // Update application status (using anon key - RLS policies should allow this)
    // If RLS blocks it, we'll get a clear error message
    
    // Prepare update data
    const updatePayload = {
      status: status
    };
    
    // Include reapply_delay_date if provided (for rejected status)
    if (reapply_delay_date) {
      updatePayload.reapply_delay_date = reapply_delay_date;
    }
    
    // Update application status
    // Note: Don't include updated_at if column doesn't exist
    // The column will be added by running FIX_ADD_UPDATED_AT_COLUMN.sql
    let updateData, updateError;
    
    // Try with updated_at first
    const result = await supabase
      .from('ambassador_applications')
      .update({ 
        ...updatePayload,
        updated_at: new Date().toISOString()
      })
      .eq('id', applicationId)
      .select();
    
    updateData = result.data;
    updateError = result.error;
    
    // If error is about missing updated_at column, try without it
    if (updateError && updateError.message?.includes('updated_at')) {
      const retryResult = await supabase
        .from('ambassador_applications')
        .update(updatePayload)
        .eq('id', applicationId)
        .select();
      
      updateData = retryResult.data;
      updateError = retryResult.error;
    }
    
      updateData, 
      updateError: updateError ? {
        message: updateError.message,
        code: updateError.code,
        details: updateError.details,
        hint: updateError.hint
      } : null, 
      applicationId, 
      status 
    });

    if (updateError) {
      console.error('Error updating application:', updateError);
      return res.status(500).json({ 
        error: 'Failed to update application',
        details: updateError.message,
        code: updateError.code
      });
    }

    if (!updateData || updateData.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.status(200).json({ 
      success: true, 
      data: updateData[0],
      message: `Application ${status} successfully`
    });

  } catch (error) {
    console.error('Admin update application error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// JWT middleware for protected admin routes
// Verifies the HttpOnly JWT cookie and checks expiration
// The JWT contains a 1-hour expiration that cannot be extended
function requireAdminAuth(req, res, next) {
  const token = req.cookies.adminToken;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated', reason: 'No token provided' });
  }
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('WARNING: JWT_SECRET is not set! Using fallback secret. This is insecure in production.');
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({ error: 'Server configuration error: JWT_SECRET is required in production.' });
      }
    }
    // jwt.verify automatically checks expiration - throws error if expired
    const decoded = jwt.verify(token, jwtSecret || 'fallback-secret-dev-only');
    req.admin = decoded;
    next();
  } catch (err) {
    // Token is invalid, expired, or malformed
    // Clear the cookie to prevent reuse
    res.clearCookie('adminToken', { path: '/' });
    return res.status(401).json({ 
      error: 'Invalid or expired token', 
      reason: err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'
    });
  }
}

// Ticket validation endpoint
app.post('/api/validate-ticket', async (req, res) => {
  try {
    const { qrCode, eventId, ambassadorId, deviceInfo, scanLocation } = req.body;

    if (!qrCode || !eventId || !ambassadorId) {
      return res.status(400).json({ 
        error: 'Missing required fields: qrCode, eventId, ambassadorId' 
      });
    }

    // Find the ticket by QR code
    const { data: ticket, error: ticketError } = await supabase
      .from('pass_purchases')
      .select(`
        *,
        events (
          id,
          name,
          date,
          venue,
          city
        )
      `)
      .eq('qr_code', qrCode)
      .single();

    if (ticketError || !ticket) {
      return res.status(404).json({
        success: false,
        result: 'invalid',
        message: 'Ticket not found'
      });
    }

    // Check if ticket is for the correct event
    if (ticket.event_id !== eventId) {
      return res.status(400).json({
        success: false,
        result: 'invalid',
        message: 'Ticket is not valid for this event'
      });
    }

    // Check if ticket is already scanned
    const { data: existingScan, error: scanError } = await supabase
      .from('scans')
      .select('*')
      .eq('ticket_id', ticket.id)
      .eq('scan_result', 'valid')
      .single();

    if (existingScan) {
      // Record the duplicate scan attempt
      await supabase.from('scans').insert({
        ticket_id: ticket.id,
        event_id: eventId,
        ambassador_id: ambassadorId,
        scan_result: 'already_scanned',
        device_info: deviceInfo,
        scan_location: scanLocation,
        notes: 'Duplicate scan attempt'
      });

      return res.status(200).json({
        success: false,
        result: 'already_scanned',
        message: 'Ticket already scanned',
        ticket: {
          id: ticket.id,
          customer_name: ticket.customer_name,
          event_name: ticket.events.name,
          ticket_type: ticket.pass_type,
          scan_time: existingScan.scan_time
        }
      });
    }

    // Check if event date has passed
    const eventDate = new Date(ticket.events.date);
    const now = new Date();
    
    if (eventDate < now) {
      // Record the expired scan attempt
      await supabase.from('scans').insert({
        ticket_id: ticket.id,
        event_id: eventId,
        ambassador_id: ambassadorId,
        scan_result: 'expired',
        device_info: deviceInfo,
        scan_location: scanLocation,
        notes: 'Event date has passed'
      });

      return res.status(200).json({
        success: false,
        result: 'expired',
        message: 'Event date has passed',
        ticket: {
          id: ticket.id,
          customer_name: ticket.customer_name,
          event_name: ticket.events.name,
          ticket_type: ticket.pass_type
        }
      });
    }

    // Record the valid scan
    const { data: scanRecord, error: recordError } = await supabase
      .from('scans')
      .insert({
        ticket_id: ticket.id,
        event_id: eventId,
        ambassador_id: ambassadorId,
        scan_result: 'valid',
        device_info: deviceInfo,
        scan_location: scanLocation,
        notes: 'Valid ticket scan'
      })
      .select()
      .single();

    if (recordError) {
      console.error('Error recording scan:', recordError);
      return res.status(500).json({
        success: false,
        result: 'error',
        message: 'Failed to record scan'
      });
    }

    return res.status(200).json({
      success: true,
      result: 'valid',
      message: 'Ticket validated successfully',
      ticket: {
        id: ticket.id,
        customer_name: ticket.customer_name,
        event_name: ticket.events.name,
        ticket_type: ticket.pass_type,
        scan_time: scanRecord.scan_time
      }
    });

  } catch (error) {
    console.error('Ticket validation error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

// ==================== SMS Marketing Routes ====================
// Test endpoint to verify SMS routes are working
app.get('/api/sms-test', (req, res) => {
  res.json({ success: true, message: 'SMS API routes are working!' });
});

// WinSMS API configuration
// SECURITY: API key must be provided via environment variable - no hardcoded fallback
if (!process.env.WINSMS_API_KEY) {
  console.warn('Warning: WINSMS_API_KEY not configured. SMS functionality will be disabled.');
}
const WINSMS_API_KEY = process.env.WINSMS_API_KEY;
const WINSMS_API_HOST = "www.winsmspro.com";
const WINSMS_API_PATH = "/sms/sms/api";
const WINSMS_SENDER = "Andiamo"; // Your sender ID

// Helper function to format Tunisian phone number
function formatPhoneNumber(phone) {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('216')) {
    cleaned = cleaned.substring(3);
  }
  cleaned = cleaned.replace(/^0+/, '');
  if (cleaned.length === 8 && /^[2594]/.test(cleaned)) {
    return '216' + cleaned;
  }
  return null;
}

// POST /api/send-sms - Send SMS broadcast
app.post('/api/send-sms', requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase not configured' });
    }

    if (!WINSMS_API_KEY) {
      return res.status(500).json({ success: false, error: 'SMS service not configured. WINSMS_API_KEY environment variable is required.' });
    }

    const { phoneNumbers, message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return res.status(400).json({ success: false, error: 'Phone numbers array is required' });
    }

    const results = [];
    const errors = [];

    for (const phoneNumber of phoneNumbers) {
      const formattedNumber = formatPhoneNumber(phoneNumber);
      
      if (!formattedNumber) {
        errors.push({ phoneNumber, error: `Invalid phone number format: ${phoneNumber}` });
        
        // Log invalid number
        await supabase.from('sms_logs').insert({
          phone_number: phoneNumber,
          message: message.trim(),
          status: 'failed',
          error_message: `Invalid phone number format: ${phoneNumber}`
        });
        continue;
      }

      try {
        // Format parameters according to WinSMS documentation
        const postData = querystring.stringify({
          'action': 'send-sms',
          'api_key': WINSMS_API_KEY,
          'to': formattedNumber,
          'sms': message.trim(),
          'from': WINSMS_SENDER
        });

        // Create HTTPS request options (as per WinSMS documentation)
        const options = {
          hostname: WINSMS_API_HOST,
          port: 443,
          path: WINSMS_API_PATH + '?' + postData,
          method: 'GET',
          timeout: 10000
        };

        // Make HTTPS request using native https module
        const responseData = await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
              data += chunk;
            });
            
            res.on('end', () => {
              try {
                // Try to parse JSON response
                const parsed = JSON.parse(data);
                resolve({ status: res.statusCode, data: parsed, raw: data });
              } catch (e) {
                // If not JSON, return raw string
                resolve({ status: res.statusCode, data: data, raw: data });
              }
            });
          });

          req.on('error', (e) => {
            reject(e);
          });

          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
          });

          req.end();
        });
        
        // Check API response for errors
        const responseText = typeof responseData.data === 'string' 
          ? responseData.data 
          : JSON.stringify(responseData.data);
        
        // Check for WinSMS error codes (e.g., "102" = Authentication Failed)
        const isError = responseData.status !== 200 ||
                       (responseData.data && responseData.data.code && responseData.data.code !== '200') ||
                       responseText.includes('error') || 
                       responseText.includes('Error') || 
                       responseText.includes('ERROR') ||
                       responseText.includes('Authentication Failed') ||
                       responseText.includes('Failed') ||
                       responseText.includes('insufficient') ||
                       responseText.includes('Insufficient') ||
                       responseText.includes('balance') && responseText.includes('0') ||
                       responseText.toLowerCase().includes('solde insuffisant') ||
                       responseText.toLowerCase().includes('solde') && responseText.includes('0');
        
        if (isError) {
          // Extract error message
          let errorMessage = 'SMS sending failed';
          if (responseData.data && responseData.data.message) {
            errorMessage = responseData.data.message;
          } else if (responseData.data && responseData.data.code) {
            errorMessage = `Error code ${responseData.data.code}: ${responseData.data.message || 'Unknown error'}`;
          } else {
            errorMessage = responseText || 'Unknown error';
          }
          
          await supabase.from('sms_logs').insert({
            phone_number: phoneNumber,
            message: message.trim(),
            status: 'failed',
            error_message: errorMessage,
            api_response: JSON.stringify(responseData.data || responseData.raw)
          });
          
          errors.push({ phoneNumber, error: errorMessage });
        } else {
          // Success
          await supabase.from('sms_logs').insert({
            phone_number: phoneNumber,
            message: message.trim(),
            status: 'sent',
            api_response: JSON.stringify(responseData.data || responseData.raw),
            sent_at: new Date().toISOString()
          });
          
          results.push({ phoneNumber, success: true, response: responseData.data || responseData.raw });
        }
      } catch (error) {
        const errorMessage = error.message || 'Unknown error';
        
        // Check if it's a balance-related error
        const isBalanceError = errorMessage.toString().includes('insufficient') ||
                              errorMessage.toString().includes('balance') ||
                              errorMessage.toString().includes('solde');
        
        const finalErrorMessage = isBalanceError 
          ? `Insufficient balance: ${errorMessage}` 
          : errorMessage.toString();
        
        await supabase.from('sms_logs').insert({
          phone_number: phoneNumber,
          message: message.trim(),
          status: 'failed',
          error_message: finalErrorMessage,
          api_response: null
        });

        errors.push({ phoneNumber, error: finalErrorMessage });
      }

      // Small delay to avoid overwhelming the API (100ms between requests)
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    res.json({
      success: true,
      total: phoneNumbers.length,
      sent: results.length,
      failed: errors.length,
      results,
      errors
    });

  } catch (error) {
    console.error('Error sending SMS broadcast:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send SMS broadcast'
    });
  }
});

// GET /api/sms-balance - Check SMS balance (as per WinSMS documentation)
app.get('/api/sms-balance', requireAdminAuth, async (req, res) => {
  try {
    if (!WINSMS_API_KEY) {
      return res.status(500).json({ 
        success: false, 
        error: 'SMS service not configured',
        message: 'WINSMS_API_KEY environment variable is required',
        configured: false
      });
    }
    
    // Build URL according to WinSMS documentation
    const url = `${WINSMS_API_PATH}?action=check-balance&api_key=${WINSMS_API_KEY}&response=json`;

    // Create HTTPS request options
    const options = {
      hostname: WINSMS_API_HOST,
      port: 443,
      path: url,
      method: 'GET',
      timeout: 10000
    };

    // Make HTTPS request using native https module (as per WinSMS documentation)
    const responseData = await new Promise((resolve, reject) => {
      const req = https.get(options, (res) => {
        let data = '';
        
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            // Try to parse JSON response
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode, data: parsed, raw: data });
          } catch (e) {
            // If not JSON, return raw string
            resolve({ status: res.statusCode, data: data, raw: data });
          }
        });
      });

      req.on('error', (e) => {
        console.error('Balance check error:', e);
        reject(e);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });

    // Parse the response - WinSMS might return different formats
    let balanceData = responseData.data;
    
    // If response is a string, try to parse it
    if (typeof balanceData === 'string') {
      try {
        balanceData = JSON.parse(balanceData);
      } catch (e) {
        // Keep as string if JSON parse fails
      }
    }

    // Check for error codes (e.g., "102" = Authentication Failed)
    if (balanceData && balanceData.code && balanceData.code !== '200') {
      // Return 200 status with error details instead of 500
      return res.status(200).json({
        success: true,
        balance: null,
        currency: null,
        message: 'Unable to fetch balance from SMS provider',
        configured: true,
        error: balanceData.message || `Error code ${balanceData.code}`,
        rawResponse: balanceData
      });
    }

    res.json({
      success: true,
      balance: balanceData,
      rawResponse: responseData.raw,
      // Try to extract balance value from common formats
      balanceValue: balanceData?.balance || balanceData?.solde || balanceData?.credit || balanceData?.amount || null
    });
  } catch (error) {
    console.error('Error checking SMS balance:', error);
    // Return 200 status with error details instead of 500
    // This prevents the UI from breaking if SMS service is unavailable
    res.status(200).json({
      success: true,
      balance: null,
      currency: null,
      message: 'SMS service unavailable',
      configured: false,
      error: error.message || 'Failed to check SMS balance',
      rawResponse: null
    });
  }
});

// POST /api/bulk-phones - Add bulk phone numbers
app.post('/api/bulk-phones', requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase not configured' });
    }

    const { phoneNumbers } = req.body;

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return res.status(400).json({ success: false, error: 'Phone numbers array is required' });
    }

    const validNumbers = [];
    const invalidNumbers = [];
    const duplicateNumbers = [];

    for (const phone of phoneNumbers) {
      const formatted = formatPhoneNumber(phone);
      
      if (!formatted) {
        invalidNumbers.push(phone);
        continue;
      }

      const localNumber = formatted.substring(3);

      // Check if number already exists
      const { data: existing } = await supabase
        .from('phone_subscribers')
        .select('phone_number')
        .eq('phone_number', localNumber)
        .single();

      if (existing) {
        duplicateNumbers.push(phone);
        continue;
      }

      validNumbers.push({
        phone_number: localNumber,
        language: 'en'
      });
    }

    let insertedCount = 0;
    if (validNumbers.length > 0) {
      const { data, error } = await supabase
        .from('phone_subscribers')
        .insert(validNumbers)
        .select();

      if (error && error.code !== '23505') {
        throw error;
      }

      insertedCount = data?.length || 0;
    }

    res.json({
      success: true,
      total: phoneNumbers.length,
      inserted: insertedCount,
      duplicates: duplicateNumbers.length,
      invalid: invalidNumbers.length,
      duplicateNumbers,
      invalidNumbers
    });

  } catch (error) {
    console.error('Error adding bulk phone numbers:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add phone numbers'
    });
  }
});

// Round Robin Assignment Endpoints

// POST /api/assign-order - Assign an order to an ambassador using round robin
app.post('/api/assign-order', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase not configured' });
    }

    const { order_id, ville } = req.body;

    if (!order_id || !ville) {
      return res.status(400).json({ success: false, error: 'order_id and ville are required' });
    }

    // Call the database function to assign order
    const { data, error } = await supabase.rpc('assign_order_to_ambassador', {
      p_order_id: order_id,
      p_ville: ville
    });

    if (error) {
      console.error('Error assigning order:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    if (!data) {
      return res.status(404).json({ 
        success: false, 
        error: 'No available ambassadors for this ville' 
      });
    }

    // Get ambassador details for notification
    const { data: ambassador } = await supabase
      .from('ambassadors')
      .select('id, full_name, phone, email')
      .eq('id', data)
      .single();

    res.json({
      success: true,
      ambassador_id: data,
      ambassador: ambassador
    });

  } catch (error) {
    console.error('Error in assign-order endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to assign order'
    });
  }
});

// POST /api/auto-reassign - Auto-reassign ignored orders
app.post('/api/auto-reassign', requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase not configured' });
    }

    const { ignore_minutes } = req.body;
    const minutes = ignore_minutes || 15; // Default 15 minutes

    // Call the database function to auto-reassign
    const { data, error } = await supabase.rpc('auto_reassign_ignored_orders', {
      p_ignore_minutes: minutes
    });

    if (error) {
      console.error('Error auto-reassigning orders:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      reassigned_count: data || 0
    });

  } catch (error) {
    console.error('Error in auto-reassign endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to auto-reassign orders'
    });
  }
});

// GET /api/next-ambassador/:ville - Get next ambassador for a ville (for admin preview)
app.get('/api/next-ambassador/:ville', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase not configured' });
    }

    const { ville } = req.params;

    if (!ville) {
      return res.status(400).json({ success: false, error: 'ville parameter is required' });
    }

    // Call the database function to get next ambassador
    const { data, error } = await supabase.rpc('get_next_ambassador_for_ville', {
      p_ville: ville
    });

    if (error) {
      console.error('Error getting next ambassador:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'No available ambassadors for this ville' 
      });
    }

    res.json({
      success: true,
      ambassador: data[0]
    });

  } catch (error) {
    console.error('Error in next-ambassador endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get next ambassador'
    });
  }
});

// Update ambassador password endpoint
app.post('/api/ambassador-update-password', authLimiter, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { ambassadorId, newPassword } = req.body;

    if (!ambassadorId || !newPassword) {
      return res.status(400).json({ error: 'Ambassador ID and new password are required' });
    }

    // Validate password length
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Prepare update data (only password, phone cannot be changed)
    const updateData = { password: hashedPassword };

    // Update the ambassador password
    const { error } = await supabase
      .from('ambassadors')
      .update(updateData)
      .eq('id', ambassadorId);

    if (error) {
      console.error('Error updating ambassador password:', error);
      return res.status(500).json({ error: 'Failed to update password', details: error.message });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Password updated successfully' 
    });
  } catch (error) {
    console.error('Error in ambassador password update:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

// Ambassador login endpoint
app.post('/api/ambassador-login', authLimiter, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { phone, password, recaptchaToken } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone number and password are required' });
    }

    // Verify reCAPTCHA if provided
    if (recaptchaToken && recaptchaToken !== 'localhost-bypass-token') {
      const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
      if (RECAPTCHA_SECRET_KEY) {
        try {
          const verifyResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `secret=${RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`
          });
          const verifyData = await verifyResponse.json();
          if (!verifyData.success) {
            return res.status(400).json({ error: 'reCAPTCHA verification failed' });
          }
        } catch (recaptchaError) {
          console.error('reCAPTCHA verification error:', recaptchaError);
          return res.status(500).json({ error: 'reCAPTCHA verification service unavailable' });
        }
      }
    }

    // Fetch ambassador by phone number
    const { data: ambassador, error } = await supabase
      .from('ambassadors')
      .select('*')
      .eq('phone', phone)
      .single();

    if (error || !ambassador) {
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, ambassador.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    // Check application status
    if (ambassador.status === 'pending') {
      return res.status(403).json({ error: 'Your application is under review' });
    }

    if (ambassador.status === 'rejected') {
      return res.status(403).json({ error: 'Your application was not approved' });
    }

    // Success - return ambassador data (frontend will handle session storage)
    res.status(200).json({ 
      success: true, 
      ambassador: {
        id: ambassador.id,
        full_name: ambassador.full_name,
        phone: ambassador.phone,
        email: ambassador.email,
        status: ambassador.status
      }
    });
  } catch (error) {
    console.error('Error in ambassador login:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

// Ambassador application endpoint
app.post('/api/ambassador-application', applicationLimiter, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { fullName, age, phoneNumber, email, city, ville, socialLink, motivation } = req.body;

    // Validate required fields
    if (!fullName || !age || !phoneNumber || !city) {
      return res.status(400).json({ error: 'Full name, age, phone number, and city are required' });
    }

    // Validate phone number format
    const phoneRegex = /^[2594][0-9]{7}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({ error: 'Phone number must be 8 digits starting with 2, 5, 9, or 4' });
    }

    // Validate Instagram link if provided
    if (socialLink && !socialLink.trim().startsWith('https://www.instagram.com/') && !socialLink.trim().startsWith('https://instagram.com/')) {
      return res.status(400).json({ error: 'Instagram link must start with https://www.instagram.com/ or https://instagram.com/' });
    }

    // Sanitize inputs (basic sanitization - DOMPurify would need to be server-side)
    const sanitizedFullName = fullName.trim();
    const sanitizedEmail = email ? email.trim() : null;
    const sanitizedCity = city.trim();
    const sanitizedSocialLink = socialLink ? socialLink.trim() : null;
    const sanitizedMotivation = motivation ? motivation.trim() : null;

    // Check for duplicate phone number in active ambassadors
    const { data: existingAmbByPhone } = await supabase
      .from('ambassadors')
      .select('id')
      .eq('phone', phoneNumber)
      .maybeSingle();

    if (existingAmbByPhone) {
      return res.status(400).json({ error: 'This phone number is already registered as an approved ambassador' });
    }

    // Check for duplicate email in active ambassadors (if email provided)
    if (sanitizedEmail) {
      const { data: existingAmbByEmail } = await supabase
        .from('ambassadors')
        .select('id')
        .eq('email', sanitizedEmail)
        .maybeSingle();

      if (existingAmbByEmail) {
        return res.status(400).json({ error: 'This email is already registered as an approved ambassador' });
      }
    }

    // Check for duplicate phone number in applications
    const { data: existingAppByPhone } = await supabase
      .from('ambassador_applications')
      .select('id, status')
      .eq('phone_number', phoneNumber)
      .in('status', ['pending', 'approved'])
      .maybeSingle();

    if (existingAppByPhone) {
      if (existingAppByPhone.status === 'approved') {
        const { data: activeAmbassador } = await supabase
          .from('ambassadors')
          .select('id')
          .eq('phone', phoneNumber)
          .maybeSingle();

        if (activeAmbassador) {
          return res.status(400).json({ error: 'An application with this phone number has already been approved and an active ambassador account exists' });
        }
      } else {
        return res.status(400).json({ error: 'You have already submitted an application. Please wait for review.' });
      }
    }

    // Check for duplicate email in applications (if email provided)
    if (sanitizedEmail) {
      const { data: existingAppByEmail } = await supabase
        .from('ambassador_applications')
        .select('id, status')
        .eq('email', sanitizedEmail)
        .in('status', ['pending', 'approved'])
        .maybeSingle();

      if (existingAppByEmail) {
        if (existingAppByEmail.status === 'approved') {
          const { data: activeAmbassador } = await supabase
            .from('ambassadors')
            .select('id')
            .eq('email', sanitizedEmail)
            .maybeSingle();

          if (activeAmbassador) {
            return res.status(400).json({ error: 'An application with this email has already been approved and an active ambassador account exists' });
          }
        } else {
          return res.status(400).json({ error: 'An application with this email already exists and is pending review. Please wait for the review to complete.' });
        }
      }
    }

    // Check for rejected/removed applications and verify reapply delay (30 days)
    const REAPPLY_DELAY_DAYS = 30;
    const now = new Date();
    const delayDate = new Date(now.getTime() - (REAPPLY_DELAY_DAYS * 24 * 60 * 60 * 1000));

    const { data: rejectedAppByPhone } = await supabase
      .from('ambassador_applications')
      .select('id, status, reapply_delay_date')
      .eq('phone_number', phoneNumber)
      .in('status', ['rejected', 'removed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (rejectedAppByPhone) {
      const canReapply = !rejectedAppByPhone.reapply_delay_date || new Date(rejectedAppByPhone.reapply_delay_date) <= now;
      if (!canReapply) {
        const delayUntil = new Date(rejectedAppByPhone.reapply_delay_date);
        const daysRemaining = Math.ceil((delayUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return res.status(400).json({ 
          error: `You can reapply in ${daysRemaining} day(s). Please wait until ${delayUntil.toLocaleDateString()}.` 
        });
      }
    }

    // Check by email if provided
    if (sanitizedEmail) {
      const { data: rejectedAppByEmail } = await supabase
        .from('ambassador_applications')
        .select('id, status, reapply_delay_date')
        .eq('email', sanitizedEmail)
        .in('status', ['rejected', 'removed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (rejectedAppByEmail) {
        const canReapply = !rejectedAppByEmail.reapply_delay_date || new Date(rejectedAppByEmail.reapply_delay_date) <= now;
        if (!canReapply) {
          const delayUntil = new Date(rejectedAppByEmail.reapply_delay_date);
          const daysRemaining = Math.ceil((delayUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return res.status(400).json({ 
            error: `You can reapply in ${daysRemaining} day(s). Please wait until ${delayUntil.toLocaleDateString()}.` 
          });
        }
      }
    }

    // ============================================
    // Ville handling for Sousse and Tunis
    // ============================================
    // Initialize villeValue - will be set for Sousse or Tunis
    let villeValue = null;
    
    // Check if city requires ville (Sousse or Tunis)
    // Use trim() and case-insensitive comparison to be safe
    const normalizedCity = sanitizedCity.trim();
    const isSousse = normalizedCity === 'Sousse';
    const isTunis = normalizedCity === 'Tunis';
    
    // Handle ville for Sousse
    if (isSousse) {
      if (!ville || (typeof ville === 'string' && ville.trim() === '')) {
        return res.status(400).json({ error: 'Ville (neighborhood) is required for Sousse' });
      }
      villeValue = typeof ville === 'string' ? ville.trim() : ville;
    }
    
    // Handle ville for Tunis
    if (isTunis) {
      if (!ville || ville.trim() === '') {
        return res.status(400).json({ error: 'Ville (neighborhood) is required for Tunis' });
      }
      villeValue = ville.trim();
    }
    
    const { data: application, error: insertError } = await supabase
      .from('ambassador_applications')
      .insert({
        full_name: sanitizedFullName,
        age: parseInt(age),
        phone_number: phoneNumber,
        email: sanitizedEmail,
        city: sanitizedCity,
        ville: villeValue, // Will be null for cities that don't require ville, or the ville value for Sousse/Tunis
        social_link: sanitizedSocialLink,
        motivation: sanitizedMotivation || null,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505' || insertError.message?.includes('unique constraint') || insertError.message?.includes('duplicate key')) {
        return res.status(400).json({ error: 'An application with this phone number or email already exists. Please contact support if you believe this is an error.' });
      }
      console.error('Error inserting application:', insertError);
      return res.status(500).json({ error: 'Failed to submit application', details: insertError.message });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Application submitted successfully',
      applicationId: application.id
    });
  } catch (error) {
    console.error('Error in ambassador application:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

// Send order completion email endpoint
app.post('/api/send-order-completion-email', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    // Fetch order with all related data
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        events (
          id,
          name,
          date,
          venue
        ),
        ambassadors (
          id,
          full_name,
          phone
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Only send email for COD orders (allow sending even if not completed for admin manual sending)
    if (order.payment_method !== 'cod') {
      return res.status(400).json({ error: 'Email can only be sent for COD orders' });
    }

    // Check if customer email exists
    if (!order.user_email) {
      return res.status(400).json({ error: 'Customer email is required to send confirmation email' });
    }

    // Fetch order passes
    const { data: orderPasses, error: passesError } = await supabase
      .from('order_passes')
      .select('*')
      .eq('order_id', orderId);

    if (passesError) {
      console.error('Error fetching order passes:', passesError);
    }

    // Build passes array
    const passes = orderPasses && orderPasses.length > 0
      ? orderPasses.map(p => ({
          passType: p.pass_type,
          quantity: p.quantity,
          price: parseFloat(p.price)
        }))
      : [{
          passType: order.pass_type || 'Standard',
          quantity: order.quantity || 1,
          price: order.total_price / (order.quantity || 1)
        }];

    // Prepare email data
    const emailData = {
      customerName: order.user_name || 'Valued Customer',
      orderId: order.id,
      eventName: order.events?.name || 'Event',
      ambassadorName: order.ambassadors?.full_name || 'Our Ambassador',
      passes: passes,
      totalAmount: parseFloat(order.total_price),
      qrCode: order.qr_code || null,
      ticketNumber: order.ticket_number || null,
      referenceNumber: order.reference_number || order.id.substring(0, 8).toUpperCase(),
      supportContactUrl: `${req.protocol}://${req.get('host')}/contact`
    };

    // Generate email HTML (we'll use a simplified version here, or import from email.ts)
    // For now, we'll create a basic HTML template
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Confirmation - Andiamo Events</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f4f4f4; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; margin: -30px -30px 30px -30px; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { padding: 20px 0; }
          .order-info { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .order-info h3 { margin-top: 0; color: #667eea; }
          .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
          .info-row:last-child { border-bottom: none; }
          .passes-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .passes-table th, .passes-table td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
          .passes-table th { background: #f9f9f9; color: #667eea; font-weight: 600; }
          .total-row { font-weight: bold; font-size: 18px; color: #667eea; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
          .support-link { display: inline-block; margin-top: 20px; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Order Confirmed!</h1>
            <p>Your Pass Purchase is Complete</p>
          </div>
          <div class="content">
            <p>Dear <strong>${emailData.customerName}</strong>,</p>
            <p>We're excited to confirm that your pass purchase has been successfully processed! Your payment has been received in cash by our ambassador, and your order is now fully validated.</p>
            
            <div class="order-info">
              <h3>📋 Order Details</h3>
              <div class="info-row">
                <span><strong>Order ID:</strong></span>
                <span>${emailData.orderId}</span>
              </div>
              <div class="info-row">
                <span><strong>Event:</strong></span>
                <span>${emailData.eventName}</span>
              </div>
              <div class="info-row">
                <span><strong>Delivered by:</strong></span>
                <span>${emailData.ambassadorName}</span>
              </div>
            </div>

            <div class="order-info">
              <h3>🎫 Passes Purchased</h3>
              <table class="passes-table">
                <thead>
                  <tr>
                    <th>Pass Type</th>
                    <th>Quantity</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${passes.map(p => `
                    <tr>
                      <td>${p.passType}</td>
                      <td>${p.quantity}</td>
                      <td>${p.price.toFixed(2)} TND</td>
                    </tr>
                  `).join('')}
                  <tr class="total-row">
                    <td colspan="2"><strong>Total Amount Paid:</strong></td>
                    <td><strong>${emailData.totalAmount.toFixed(2)} TND</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>

            ${emailData.qrCode ? `
              <div class="order-info">
                <h3>🎫 Your Digital Ticket</h3>
                <p>Scan this QR code at the event entrance:</p>
                <img src="${emailData.qrCode}" alt="QR Code" style="max-width: 200px; height: auto; display: block; margin: 20px auto;" />
              </div>
            ` : ''}

            ${emailData.ticketNumber ? `
              <div class="order-info">
                <h3>🎫 Ticket Number</h3>
                <p><strong>${emailData.ticketNumber}</strong></p>
              </div>
            ` : ''}

            <div class="order-info">
              <h3>💳 Payment Confirmation</h3>
              <p>Your payment of <strong>${emailData.totalAmount.toFixed(2)} TND</strong> has been successfully received in cash by our ambassador <strong>${emailData.ambassadorName}</strong>. Your order is now fully validated and confirmed.</p>
            </div>

            <div class="order-info">
              <h3>💬 Need Help?</h3>
              <p>If you have any questions about your order, need to verify your purchase, or require assistance, please don't hesitate to contact our support team.</p>
              <a href="${emailData.supportContactUrl}" class="support-link">Contact Support</a>
            </div>

            <p>Thank you for choosing Andiamo Events! We look forward to seeing you at the event.</p>
            <p><strong>Best regards,<br>The Andiamo Team</strong></p>
          </div>
          <div class="footer">
            <p>© 2024 Andiamo Events. All rights reserved.</p>
            <p>Tunisia's Premier Nightlife Experience</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Create email delivery log entry (pending status)
    // Wrap in try-catch in case table doesn't exist yet or RLS issues
    let emailLog = null;
    try {
      const { data: logData, error: logError } = await supabase
        .from('email_delivery_logs')
        .insert({
          order_id: orderId,
          email_type: 'order_completion',
          recipient_email: order.user_email,
          recipient_name: order.user_name,
          subject: '✅ Order Confirmation - Your Pass Purchase is Complete!',
          status: 'pending'
        })
        .select()
        .single();

      if (logError) {
        console.error('Error creating email log:', logError);
        console.error('Log error details:', JSON.stringify(logError, null, 2));
        // Continue without logging if table doesn't exist or RLS blocks it
        // Email will still be sent, just won't be logged
      } else {
        emailLog = logData;
      }
    } catch (logErr) {
      console.error('Error creating email log (exception):', logErr);
      // Continue without logging
    }

    // Check if email service is configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({ 
        error: 'Email service not configured', 
        details: 'EMAIL_USER and EMAIL_PASS environment variables are required. Please configure them in your server environment.'
      });
    }

    // Send email
    try {
      await transporter.sendMail({
        from: `Andiamo Events <${process.env.EMAIL_USER}>`,
        to: order.user_email,
        subject: '✅ Order Confirmation - Your Pass Purchase is Complete!',
        html: emailHtml
      });

      // Update email log to sent
      if (emailLog) {
        try {
          const { error: updateError } = await supabase
            .from('email_delivery_logs')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', emailLog.id);
          
          if (updateError) {
            console.error('Error updating email log to sent:', updateError);
            console.error('Update error details:', JSON.stringify(updateError, null, 2));
          } else {
          }
        } catch (updateError) {
          console.error('Error updating email log (exception):', updateError);
          // Don't fail the response if log update fails
        }
      } else {
      }

      res.status(200).json({ 
        success: true, 
        message: 'Order completion email sent successfully',
        emailLogId: emailLog?.id
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      
      // Update email log to failed
      if (emailLog) {
        try {
          const { error: updateError } = await supabase
            .from('email_delivery_logs')
            .update({
              status: 'failed',
              error_message: emailError.message
            })
            .eq('id', emailLog.id);
          
          if (updateError) {
            console.error('Error updating email log to failed:', updateError);
            console.error('Update error details:', JSON.stringify(updateError, null, 2));
          }
        } catch (updateError) {
          console.error('Error updating email log (exception):', updateError);
        }
      }

      // Provide more detailed error message
      const errorMessage = emailError.message || 'Unknown error';
      const isAuthError = errorMessage.includes('Invalid login') || errorMessage.includes('authentication');
      const isConfigError = !process.env.EMAIL_USER || !process.env.EMAIL_PASS;

      return res.status(500).json({ 
        error: 'Failed to send email', 
        details: isConfigError 
          ? 'Email service not configured. Please check EMAIL_USER and EMAIL_PASS environment variables.'
          : isAuthError
          ? 'Email authentication failed. Please check email credentials.'
          : errorMessage
      });
    }
  } catch (error) {
    console.error('Error in send-order-completion-email:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

// Resend order completion email endpoint (admin only)
app.post('/api/resend-order-completion-email', requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    // Call the same logic as send-order-completion-email
    // We'll reuse the logic by making an internal call
    req.body = { orderId };
    req.cookies = req.cookies || {};
    
    // Remove requireAdminAuth for this internal call
    const originalRequireAdminAuth = requireAdminAuth;
    delete req.requireAdminAuth;
    
    // Forward to the send endpoint logic
    return await new Promise((resolve) => {
      const mockRes = {
        status: (code) => ({
          json: (data) => {
            res.status(code).json(data);
            resolve();
          }
        })
      };
      // We'll just call the send endpoint logic directly
      // For simplicity, we'll duplicate the logic here
      // (In production, you'd extract this into a shared function)
    });

    // Actually, let's just duplicate the logic for clarity
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        events (
          id,
          name,
          date,
          venue
        ),
        ambassadors (
          id,
          full_name,
          phone
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!order.user_email) {
      return res.status(400).json({ error: 'Customer email is required to send confirmation email' });
    }

    // Fetch order passes
    const { data: orderPasses } = await supabase
      .from('order_passes')
      .select('*')
      .eq('order_id', orderId);

    const passes = orderPasses && orderPasses.length > 0
      ? orderPasses.map(p => ({
          passType: p.pass_type,
          quantity: p.quantity,
          price: parseFloat(p.price)
        }))
      : [{
          passType: order.pass_type || 'Standard',
          quantity: order.quantity || 1,
          price: order.total_price / (order.quantity || 1)
        }];

    // Create email HTML (same as above)
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Order Confirmation - Andiamo Events</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f4f4f4; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; margin: -30px -30px 30px -30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Order Confirmed!</h1>
          </div>
          <p>Dear <strong>${order.user_name || 'Valued Customer'}</strong>,</p>
          <p>Your order ${orderId} has been confirmed. Total: ${order.total_price} TND</p>
        </div>
      </body>
      </html>
    `;

    // Create new email log entry
    const { data: emailLog } = await supabase
      .from('email_delivery_logs')
      .insert({
        order_id: orderId,
        email_type: 'order_completion',
        recipient_email: order.user_email,
        recipient_name: order.user_name,
        subject: '✅ Order Confirmation - Your Pass Purchase is Complete!',
        status: 'pending'
      })
      .select()
      .single();

    try {
      await transporter.sendMail({
        from: `Andiamo Events <${process.env.EMAIL_USER}>`,
        to: order.user_email,
        subject: '✅ Order Confirmation - Your Pass Purchase is Complete!',
        html: emailHtml
      });

      if (emailLog) {
        await supabase
          .from('email_delivery_logs')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', emailLog.id);
      }

      res.status(200).json({ 
        success: true, 
        message: 'Order completion email resent successfully',
        emailLogId: emailLog?.id
      });
    } catch (emailError) {
      if (emailLog) {
        await supabase
          .from('email_delivery_logs')
          .update({
            status: 'failed',
            error_message: emailError.message,
            retry_count: (emailLog.retry_count || 0) + 1
          })
          .eq('id', emailLog.id);
      }

      return res.status(500).json({ 
        error: 'Failed to send email', 
        details: emailError.message 
      });
    }
  } catch (error) {
    console.error('Error in resend-order-completion-email:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

// Get email delivery logs for an order (admin only)
app.get('/api/email-delivery-logs/:orderId', requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { orderId } = req.params;

    const { data: logs, error } = await supabase
      .from('email_delivery_logs')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch email logs', details: error.message });
    }

    res.status(200).json({ success: true, logs });
  } catch (error) {
    console.error('Error fetching email logs:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

// POST /api/generate-qr-code - Generate QR code image from token
app.post('/api/generate-qr-code', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Use qrcode library to generate QR code
    const QRCode = require('qrcode');
    const qrCodeBuffer = await QRCode.toBuffer(token, {
      type: 'png',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Return as base64 data URL for frontend use
    const base64 = qrCodeBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64}`;

    res.status(200).json({ 
      success: true, 
      dataUrl,
      buffer: base64 // Also return base64 for backend use
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ 
      error: 'Failed to generate QR code', 
      details: error.message 
    });
  }
});

// POST /api/generate-tickets-for-order - Generate tickets when order reaches PAID status
app.post('/api/generate-tickets-for-order', requireAdminAuth, async (req, res) => {
  try {
    const { orderId } = req.body;
    
    if (!orderId) {
      console.error('❌ No orderId provided');
      return res.status(400).json({ error: 'Order ID is required' });
    }

    if (!supabase) {
      console.error('❌ Supabase not configured');
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    // Use service role client for ALL operations (storage AND database) if available
    // This bypasses RLS policies and ensures we can create tickets
    const dbClient = supabaseService || supabase;
    const storageClient = supabaseService || supabase;
    
    if (!supabaseService) {
      console.warn('⚠️ Service role key not set - using anon key (may fail due to RLS)');
    } else {
    }

    // Fetch order data using service role client
    const { data: orderData, error: orderError } = await dbClient
      .from('orders')
      .select(`
        *,
        events (
          id,
          name,
          date,
          venue
        ),
        ambassadors (
          id,
          full_name,
          phone
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !orderData) {
      console.error('❌ Order not found:', orderError);
      return res.status(404).json({ error: 'Order not found', details: orderError?.message });
    }

    const order = orderData;

    // Check if order is in the correct status (COMPLETED for COD, PAID for online)
    // Also accept MANUAL_COMPLETED for manual orders
    const isPaidStatus = 
      (order.source === 'platform_cod' && (order.status === 'COMPLETED' || order.status === 'MANUAL_COMPLETED')) ||
      (order.source === 'platform_online' && order.status === 'PAID');


    if (!isPaidStatus) {
      console.error(`❌ Order not in paid status: ${order.status} (source: ${order.source})`);
      return res.status(400).json({ 
        error: `Order is not in a paid status. Current status: ${order.status}, Source: ${order.source}`,
        orderStatus: order.status,
        orderSource: order.source,
        expectedStatus: order.source === 'platform_cod' ? 'COMPLETED or MANUAL_COMPLETED' : 'PAID'
      });
    }

    // Check if tickets already exist
    const { data: existingTickets } = await dbClient
      .from('tickets')
      .select('id')
      .eq('order_id', orderId)
      .limit(1);

    if (existingTickets && existingTickets.length > 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'Tickets already generated for this order',
        orderId 
      });
    }

    // Fetch all passes for this order
    let orderPasses = null;
    const { data: passesData, error: passesError } = await dbClient
      .from('order_passes')
      .select('*')
      .eq('order_id', orderId);

    if (passesError) {
      console.error('❌ Error fetching order passes:', passesError);
      return res.status(500).json({ 
        error: `Failed to fetch order passes: ${passesError.message}`,
        details: passesError 
      });
    }

    orderPasses = passesData;

    // Fallback: If no passes in order_passes table, create them from order data
    if (!orderPasses || orderPasses.length === 0) {
      
      // Check if order has pass_type (old format)
      if (order.pass_type) {
        
        // Calculate price per pass
        const quantity = order.quantity || 1;
        const pricePerPass = order.total_price / quantity;
        
        // Create order_pass entry using service role client
        const { data: newPass, error: createPassError } = await dbClient
          .from('order_passes')
          .insert({
            order_id: orderId,
            pass_type: order.pass_type,
            quantity: quantity,
            price: pricePerPass
          })
          .select()
          .single();

        if (createPassError) {
          console.error('❌ Error creating order_pass:', createPassError);
          return res.status(500).json({ 
            error: `Failed to create order pass: ${createPassError.message}`,
            details: createPassError 
          });
        }

        orderPasses = [newPass];
      } else {
        console.error('❌ No passes found and order has no pass_type');
        return res.status(400).json({ 
          error: 'No passes found for this order',
          orderId: orderId,
          suggestion: 'The order must have either entries in order_passes table or a pass_type field'
        });
      }
    }


    const { v4: uuidv4 } = require('uuid');
    const QRCode = require('qrcode');

    // Create tickets and generate QR codes
    const tickets = [];

    for (const pass of orderPasses) {
      // Create one ticket per quantity
      for (let i = 0; i < pass.quantity; i++) {
        const secureToken = uuidv4();
        
        // Generate QR code
        const qrCodeBuffer = await QRCode.toBuffer(secureToken, {
          type: 'png',
          width: 300,
          margin: 2
        });

        // Upload to Supabase Storage
        const fileName = `tickets/${orderId}/${secureToken}.png`;
        const { data: uploadData, error: uploadError } = await storageClient.storage
          .from('tickets')
          .upload(fileName, qrCodeBuffer, {
            contentType: 'image/png',
            upsert: true
          });

        if (uploadError) {
          console.error(`❌ Error uploading QR code for ticket ${secureToken}:`, uploadError);
          continue;
        }


        // Get public URL
        const { data: urlData } = storageClient.storage
          .from('tickets')
          .getPublicUrl(fileName);
        

        // Create ticket entry using service role client
        const ticketInsertData = {
          order_id: orderId,
          order_pass_id: pass.id,
          secure_token: secureToken,
          qr_code_url: urlData?.publicUrl || null,
          status: 'GENERATED',
          generated_at: new Date().toISOString()
        };
        
        
        const { data: ticketData, error: ticketError } = await dbClient
          .from('tickets')
          .insert(ticketInsertData)
          .select()
          .single();

        if (ticketError) {
          console.error(`❌ Error creating ticket in database:`, ticketError);
          console.error('❌ Ticket error code:', ticketError.code);
          console.error('❌ Ticket error message:', ticketError.message);
          console.error('❌ Ticket error details:', JSON.stringify(ticketError, null, 2));
          console.error('❌ Ticket data that failed:', JSON.stringify(ticketInsertData, null, 2));
          continue;
        }

        if (ticketData) {
          tickets.push(ticketData);
        } else {
          console.error(`❌ Ticket insert returned no data`);
        }
      }
    }

    if (tickets.length === 0) {
      console.error('❌ No tickets were successfully created');
      return res.status(500).json({ error: 'Failed to generate any tickets' });
    }


    // Send confirmation email with all QR codes
    if (order.user_email) {
      try {
        // Build email HTML with all ticket QR codes
        const ticketsHtml = tickets
          .filter(t => t.qr_code_url)
          .map((ticket, index) => `
            <div style="margin: 20px 0; padding: 20px; background: #f9f9f9; border-radius: 8px; text-align: center;">
              <h4 style="margin: 0 0 15px 0; color: #667eea;">Ticket ${index + 1}</h4>
              <img src="${ticket.qr_code_url}" alt="QR Code" style="max-width: 250px; height: auto; border-radius: 8px; border: 2px solid hsl(195, 100%, 50%, 0.3); display: block; margin: 0 auto;" />
            </div>
          `)
          .join('');

        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Order Confirmation - Andiamo Events</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f4f4f4; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, hsl(285, 85%, 65%) 0%, hsl(195, 100%, 50%) 50%, hsl(330, 100%, 65%) 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; margin: -30px -30px 30px -30px; }
              .header h1 { margin: 0; font-size: 28px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>✅ Order Confirmed!</h1>
                <p>Your Digital Tickets Are Ready</p>
              </div>
              <div style="padding: 20px 0;">
                <p>Dear <strong>${order.user_name || 'Valued Customer'}</strong>,</p>
                <p>Your digital tickets with unique QR codes are ready!</p>
                <h3 style="color: #667eea;">🎫 Your Digital Tickets</h3>
                <p>Please present these QR codes at the event entrance:</p>
                ${ticketsHtml}
                <p>Thank you for choosing Andiamo Events!</p>
              </div>
            </div>
          </body>
          </html>
        `;

        const emailResult = await transporter.sendMail({
          from: `Andiamo Events <${process.env.EMAIL_USER}>`,
          to: order.user_email,
          subject: '✅ Order Confirmation - Your Digital Tickets Are Ready!',
          html: emailHtml
        });

        // Update tickets to DELIVERED using service role client
        const ticketIds = tickets.map(t => t.id);
        const { error: updateError } = await dbClient
          .from('tickets')
          .update({
            status: 'DELIVERED',
            email_delivery_status: 'sent',
            delivered_at: new Date().toISOString()
          })
          .in('id', ticketIds);
        
        if (updateError) {
          console.error('❌ Error updating tickets to DELIVERED:', updateError);
        } else {
        }

        // Log email delivery using service role client
        const { error: logError } = await dbClient.from('email_delivery_logs').insert({
          order_id: orderId,
          email_type: 'ticket_delivery',
          recipient_email: order.user_email,
          recipient_name: order.user_name,
          subject: '✅ Order Confirmation - Your Digital Tickets Are Ready!',
          status: 'sent',
          sent_at: new Date().toISOString()
        });

      } catch (emailError) {
        console.error('❌ Error sending confirmation email:', emailError);
        console.error('Email error details:', emailError.message);
        // Update tickets email delivery status to failed using service role client
        const ticketIds = tickets.map(t => t.id);
        await dbClient
          .from('tickets')
          .update({
            email_delivery_status: 'failed'
          })
          .in('id', ticketIds);

        // Log email failure using service role client
        await dbClient.from('email_delivery_logs').insert({
          order_id: orderId,
          email_type: 'ticket_delivery',
          recipient_email: order.user_email,
          recipient_name: order.user_name,
          subject: '✅ Order Confirmation - Your Digital Tickets Are Ready!',
          status: 'failed',
          error_message: emailError.message
        });
      }
    }

    
    res.status(200).json({ 
      success: true, 
      message: 'Tickets generated successfully',
      ticketsCount: tickets.length,
      orderId,
      ticketIds: tickets.map(t => t.id)
    });

  } catch (error) {
    console.error('❌ Error generating tickets:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to generate tickets', 
      details: error.message 
    });
  }
});

// Test email endpoint
app.post('/api/test-email', requireAdminAuth, async (req, res) => {
  try {
    // Check if email service is configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({ 
        error: 'Email service not configured', 
        details: 'EMAIL_USER and EMAIL_PASS environment variables are required.'
      });
    }

    const { to } = req.body;
    const testEmailTo = to || 'malekbenamor02@icloud.com';

    const testEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Test Email - Andiamo Events</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f4f4f4; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; margin: -30px -30px 30px -30px; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { padding: 20px 0; }
          .success-box { background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .success-box h3 { color: #155724; margin-top: 0; }
          .info-box { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .info-box p { margin: 10px 0; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Test Email Successful!</h1>
          </div>
          <div class="content">
            <p>Dear User,</p>
            
            <div class="success-box">
              <h3>🎉 Email Configuration Test</h3>
              <p>This is a test email to verify that your new professional email configuration is working correctly.</p>
            </div>

            <div class="info-box">
              <h3>📧 Email Configuration Details:</h3>
              <p><strong>Email User:</strong> ${process.env.EMAIL_USER}</p>
              <p><strong>Email Host:</strong> ${process.env.EMAIL_HOST}</p>
              <p><strong>Email Port:</strong> ${process.env.EMAIL_PORT || '587'}</p>
              <p><strong>Sent At:</strong> ${new Date().toLocaleString()}</p>
            </div>

            <p>If you received this email, it means your email service is properly configured and ready to use!</p>
            
            <p>Best regards,<br>
            <strong>The Andiamo Events Team</strong></p>
          </div>
          <div class="footer">
            <p>© 2024 Andiamo Events. All rights reserved.</p>
            <p>Tunisia's Premier Nightlife Experience</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `Andiamo Events <${process.env.EMAIL_USER}>`,
      to: testEmailTo,
      subject: '✅ Test Email - Andiamo Events Email Configuration',
      html: testEmailHtml
    });

    res.status(200).json({ 
      success: true, 
      message: 'Test email sent successfully',
      to: testEmailTo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Test email sending failed:', error);
    res.status(500).json({ 
      error: 'Failed to send test email', 
      details: error.message 
    });
  }
});


// OG Image endpoint - serves OG image from Supabase Storage
app.get('/api/og-image', ogImageLimiter, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    // Try to get the image - check PNG first, then JPG
    const extensions = ['png', 'jpg'];
    let imageData = null;
    let contentType = 'image/png';
    
    for (const ext of extensions) {
      const filePath = `og-image/current.${ext}`;
      
      try {
        const { data, error } = await supabase.storage
          .from('images')
          .download(filePath);
        
        if (!error && data) {
          imageData = await data.arrayBuffer();
          contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
          break;
        }
      } catch (err) {
        // Continue to next extension
        console.warn(`Failed to load ${ext} image:`, err.message);
      }
    }
    
    // If no image found, return 404 with no-cache headers
    if (!imageData) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.status(404).json({ 
        error: 'OG image not found',
        message: 'Please upload an OG image from the admin dashboard'
      });
    }
    
    // Set headers for image response
    res.setHeader('Content-Type', contentType);
    // Facebook-friendly cache headers: short cache but allow revalidation
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, must-revalidate');
    res.setHeader('Content-Length', imageData.byteLength);
    
    // Generate ETag for cache validation
    const crypto = require('crypto');
    const etag = crypto.createHash('md5').update(Buffer.from(imageData)).digest('hex');
    res.setHeader('ETag', `"${etag}"`);
    
    // Handle If-None-Match (304 Not Modified)
    if (req.headers['if-none-match'] === `"${etag}"`) {
      return res.status(304).end();
    }
    
    // Return the image binary data with 200 status
    return res.status(200).send(Buffer.from(imageData));
    
  } catch (error) {
    console.error('OG image API error:', error);
    return res.status(500).json({ 
      error: 'Server error',
      details: error.message
    });
  }
});

// Catch-all 404 handler for undefined routes
app.use('/api/*', (req, res) => {
  console.error(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    success: false,
    error: 'Route not found',
    details: `The route ${req.path} does not exist`,
    method: req.method,
    path: req.path
  });
});

// Export app for Vercel serverless functions
// If running as standalone server, start listening
if (require.main === module) {
  const port = process.env.PORT || 8082;
  app.listen(port, () => {
    console.log('  POST /api/admin-login');
    console.log('  POST /api/admin-logout');
    console.log('  GET  /api/verify-admin');
    console.log('  GET  /api/og-image');
    console.log('  ... and more');
  });
}

// Export app for use in serverless functions
module.exports = app;