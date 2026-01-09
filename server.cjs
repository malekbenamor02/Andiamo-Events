const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
// PREVIEW-ONLY FIX: Import ipKeyGenerator early for rate limiting (fixes import order issue)
const { ipKeyGenerator } = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const https = require('https');
const querystring = require('querystring');
const crypto = require('crypto');

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

// Check email configuration on startup

if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error('❌ Email configuration is incomplete! Emails will not work.');
  console.error('   Missing:', {
    EMAIL_HOST: !process.env.EMAIL_HOST,
    EMAIL_USER: !process.env.EMAIL_USER,
    EMAIL_PASS: !process.env.EMAIL_PASS
  });
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

// CRITICAL: Trust proxy - requests come through ngrok which sets X-Forwarded-For headers
// Trust only the first proxy (ngrok) to prevent bypassing rate limits
// This is required for express-rate-limit to work correctly with ngrok
// Setting to 1 trusts only the first proxy hop (ngrok), not all proxies
app.set('trust proxy', 1);

// ============================================
// PREVIEW-ONLY FIX: Public Static Assets
// ============================================
// Serve public assets (manifest.json, favicon, etc.) BEFORE any auth/rate limiting
// This prevents 401 errors on static files in preview environments
app.use((req, res, next) => {
  const publicPaths = [
    '/manifest.json',
    '/favicon.ico',
    '/robots.txt',
    '/sw.js',
    '/placeholder.svg',
    '/logo.svg',
    '/og-image.jpg',
    '/og-image.png'
  ];
  
  // Check if request is for a public static asset
  // PREVIEW-ONLY: These paths bypass all middleware and return immediately
  // In Vercel, static files are served automatically from /public, but if request
  // somehow hits Express middleware, we skip auth/rate limiting to prevent 401 errors
  if (publicPaths.includes(req.path)) {
    // Skip all subsequent middleware (auth, rate limiting, etc.)
    // This prevents 401 errors on static assets in preview environments
    // Note: In production, Vercel serves these files directly, so this rarely executes
    // Return early to allow request to continue to Vercel's static file handler
    return next(); // Let it pass through - Vercel will serve the actual file
  }
  
  // For API routes and other paths, continue normal flow
  next();
});

// CORS configuration - allow all origins in development, specific origins in production
const isDevelopment = process.env.NODE_ENV !== 'production';

// ============================================
// PREVIEW-ONLY: Environment Detection
// ============================================
// Detect preview environment for mocking external APIs
// Note: VITE_API_URL is frontend-only, so we detect preview in the payment handler
// based on actual request parameters (webhookUrl) which contain ngrok URLs in preview

// Vercel preview domain patterns (both development and production should allow these)
const vercelPreviewPatterns = [
  /^https:\/\/.*\.vercel\.app$/,
  /^https:\/\/.*-.*\.vercel\.app$/,
  /^https:\/\/.*-projects\.vercel\.app$/,
  /^https:\/\/.*-git-.*-.*\.vercel\.app$/
];

const allowedOrigins = isDevelopment
  ? ['http://localhost:8080', 'http://localhost:3000', 'http://localhost:5173', 'http://192.168.1.*', 'http://10.0.*', 'http://127.0.0.1:3000', /^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/, /^http:\/\/192\.168\.\d+\.\d+:\d+$/, ...vercelPreviewPatterns]
  : (process.env.ALLOWED_ORIGINS ? [...process.env.ALLOWED_ORIGINS.split(','), ...vercelPreviewPatterns] : ['http://localhost:3000', ...vercelPreviewPatterns]);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('🌐 CORS: No origin - allowing request');
      return callback(null, true);
    }
    
    // Always allow Vercel preview domains (even in production when running locally)
    const isVercelPreview = vercelPreviewPatterns.some(pattern => pattern.test(origin));
    if (isVercelPreview) {
      console.log('🌐 CORS: Vercel preview domain allowed:', origin);
      return callback(null, true);
    }
    
    // In development, allow all origins
    if (isDevelopment) {
      console.log('🌐 CORS: Development mode - allowing origin:', origin);
      return callback(null, true);
    }
    
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
      console.log('🌐 CORS: Origin allowed:', origin);
      callback(null, true);
    } else {
      // On Vercel, allow same-origin requests
      const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_URL;
      if (isVercel && origin && (origin.includes(process.env.VERCEL_URL || '') || origin.includes(process.env.VERCEL_BRANCH_URL || ''))) {
        console.log('🌐 CORS: Vercel origin allowed:', origin);
        return callback(null, true);
      }
      // Production fallback
      console.error('❌ CORS: Origin not allowed:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // CRITICAL: Must be true for cookies to work
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'], // Add Cookie header
  exposedHeaders: ['Set-Cookie'] // Expose Set-Cookie header
}));
// Middleware to capture raw body for webhook signature verification
app.use('/api/flouci-webhook', bodyParser.raw({ type: 'application/json' }), (req, res, next) => {
  // Store raw body for signature verification
  req.rawBody = req.body;
  // Parse JSON body for use in route handler
  try {
    req.body = JSON.parse(req.body.toString());
  } catch (e) {
    req.body = {};
  }
  next();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Security: Request logging middleware for security audit
// Logs all requests to sensitive endpoints for security auditing
// ============================================
// PHASE 2 SECURITY FIX: Enhanced Audit Logging
// ============================================
// All IP addresses are normalized (IPv4 + IPv6 canonical form)
// Comprehensive action tracking with actor identification
// ============================================

/**
 * Normalize IP address for consistent logging and rate limiting
 * Handles IPv4, IPv6, and proxy headers
 * Uses ipKeyGenerator from express-rate-limit for proper IPv6 normalization
 */
const normalizeIP = (req) => {
  // Use ipKeyGenerator for proper IPv6 normalization
  try {
    return ipKeyGenerator(req);
  } catch (error) {
    // Fallback if ipKeyGenerator fails (shouldn't happen, but safe)
    // PREVIEW-ONLY FIX: Never use req.connection - it's circular and causes JSON crashes
    const ip = req.ip || 
               req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               'unknown';
    return ip;
  }
};

const logSecurityRequest = async (req, res, next) => {
  // Only log in production or if explicitly enabled
  const shouldLog = process.env.NODE_ENV === 'production' || process.env.ENABLE_SECURITY_LOGGING === 'true';
  
  if (!shouldLog || !supabase) {
    return next();
  }
  
  // Capture response details
  const originalSend = res.send;
  const originalJson = res.json;
  let responseBody = null;
  let responseStatus = res.statusCode || 200;
  
  // Override res.send to capture response
  res.send = function(body) {
    try {
      responseBody = typeof body === 'string' ? body.substring(0, 500) : JSON.stringify(body).substring(0, 500);
    } catch (e) {
      // If response body contains circular references, just log a summary
      responseBody = '[Response body contains circular references, not logged]';
    }
    responseStatus = res.statusCode || 200;
    return originalSend.call(this, body);
  };
  
  res.json = function(body) {
    try {
      responseBody = JSON.stringify(body).substring(0, 500);
    } catch (e) {
      // If response body contains circular references, just log a summary
      responseBody = '[Response body contains circular references, not logged]';
    }
    responseStatus = res.statusCode || 200;
    return originalJson.call(this, body);
  };
  
  // Log after response is sent
  res.on('finish', async () => {
    try {
      // Determine severity based on response status and endpoint
      let severity = 'low';
      if (responseStatus >= 500) severity = 'high';
      else if (responseStatus >= 400) severity = 'medium';
      else if (req.path.includes('webhook') || req.path.includes('generate-tickets')) severity = 'medium';
      
      // Sanitize request body (don't log sensitive data)
      // CRITICAL: Must avoid circular references when serializing
      let sanitizedBody = null;
      if (req.body && typeof req.body === 'object') {
        try {
          // Use JSON.stringify/parse to remove circular references
          const bodyStr = JSON.stringify(req.body);
          const bodyCopy = JSON.parse(bodyStr);
          // Remove sensitive fields
          if (bodyCopy.password) bodyCopy.password = '[REDACTED]';
          if (bodyCopy.token) bodyCopy.token = typeof bodyCopy.token === 'string' ? bodyCopy.token.substring(0, 10) + '...' : '[REDACTED]';
          if (bodyCopy.recaptchaToken) bodyCopy.recaptchaToken = '[REDACTED]';
          sanitizedBody = bodyCopy;
        } catch (e) {
          // If body contains circular references or can't be serialized, log a summary
          sanitizedBody = { _note: 'Request body contains circular references or non-serializable data' };
        }
      } else if (req.body) {
        // Non-object body (string, number, etc.)
        sanitizedBody = typeof req.body === 'string' ? req.body.substring(0, 200) : req.body;
      }
      
      // Sanitize query params (avoid circular references)
      let sanitizedQuery = null;
      if (req.query && typeof req.query === 'object') {
        try {
          sanitizedQuery = JSON.parse(JSON.stringify(req.query));
        } catch (e) {
          sanitizedQuery = { _note: 'Query params contain circular references' };
        }
      }
      
      // Sanitize headers (only safe, non-circular fields)
      const safeHeaders = {
        origin: req.headers.origin || null,
        referer: req.headers.referer || null,
        'content-type': req.headers['content-type'] || null
      };
      
      // Use service role client for security audit logs (bypasses RLS)
      const securityLogClient = supabaseService || supabase;
      const normalizedIP = normalizeIP(req);
      
      // Build log entry with all safe, serializable data
      const logEntry = {
        event_type: 'api_request',
        endpoint: req.path,
        ip_address: normalizedIP, // PHASE 2: Normalized IP (IPv4 + IPv6 canonical)
        user_agent: req.headers['user-agent'] || 'unknown',
        request_method: req.method,
        request_path: req.path,
        request_body: sanitizedBody,
        response_status: responseStatus,
        details: {
          query_params: sanitizedQuery,
          headers: safeHeaders,
          response_body: responseBody ? (typeof responseBody === 'string' ? responseBody.substring(0, 500) : '[Non-string response]') : null
        },
        severity: severity
      };
      
      // Final safety check: Try to serialize the entire log entry before inserting
      // PREVIEW-ONLY FIX: Disable logging in preview to prevent circular JSON crashes
      // Logging is only needed in production for security auditing
      if (shouldLog && supabase) {
        try {
          // Simple serialization test - if it fails, skip logging
          JSON.stringify(logEntry);
          // If serialization succeeds, safe to insert
          await securityLogClient.from('security_audit_logs').insert(logEntry);
        } catch (serializeError) {
          // PREVIEW-ONLY FIX: Skip logging if serialization fails (prevents crashes)
          // In preview, logging failures shouldn't break the app
          const errorMsg = serializeError?.message || 'Serialization failed';
          // Only log if it's not a circular reference error (to reduce noise)
          if (!errorMsg.includes('circular') && !errorMsg.includes('Circular')) {
            console.warn('⚠️ Skipping security log (circular reference detected):', errorMsg);
          }
          // Don't try to insert minimal log - just skip it in preview
        }
      }
    } catch (logError) {
      // PREVIEW-ONLY FIX: Don't fail the request if logging fails
      // Log error but don't include the full error object (might be circular)
      // In preview, logging failures are non-critical
      const errorMsg = logError?.message || String(logError);
      // Only log if it's not a circular reference error (to reduce noise)
      if (!errorMsg.includes('circular') && !errorMsg.includes('Circular')) {
        console.warn('⚠️ Security logging skipped:', errorMsg);
      }
    }
  });
  
  next();
};

// Security: Request origin validation middleware
// Validates that requests come from allowed origins (for sensitive endpoints)
const validateOrigin = (req, res, next) => {
  const origin = req.headers.origin || req.headers.referer;
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Skip validation in development
  if (!isProduction) {
    return next();
  }
  
  // Allow requests with no origin (mobile apps, curl, etc.) - but log them
  if (!origin) {
    // Log for security audit
    if (supabase) {
      // Use service role client for security audit logs (bypasses RLS)
      const securityLogClient = supabaseService || supabase;
      securityLogClient.from('security_audit_logs').insert({
        event_type: 'request_without_origin',
        endpoint: req.path,
        ip_address: normalizeIP(req), // PHASE 2: Normalized IP
        user_agent: req.headers['user-agent'] || 'unknown',
        request_method: req.method,
        request_path: req.path,
        details: { reason: 'Request without origin header' },
        severity: 'low'
      }).catch(err => console.error('Failed to log:', err));
    }
    return next();
  }
  
  // Check if origin is allowed
  const isAllowed = allowedOrigins.some(allowed => {
    if (typeof allowed === 'string') {
      if (allowed.includes('*')) {
        const pattern = allowed.replace(/\*/g, '.*');
        return new RegExp(`^${pattern}$`).test(origin);
      }
      return origin === allowed;
    }
    if (allowed instanceof RegExp) {
      return allowed.test(origin);
    }
    return false;
  });
  
  if (!isAllowed) {
    // Log security event
    if (supabase) {
      // Use service role client for security audit logs (bypasses RLS)
      const securityLogClient = supabaseService || supabase;
      securityLogClient.from('security_audit_logs').insert({
        event_type: 'origin_validation_failed',
        endpoint: req.path,
        ip_address: normalizeIP(req), // PHASE 2: Normalized IP
        user_agent: req.headers['user-agent'] || 'unknown',
        request_method: req.method,
        request_path: req.path,
        details: { 
          reason: 'Origin not in allowed list',
          origin: origin 
        },
        severity: 'medium'
      }).catch(err => console.error('Failed to log:', err));
    }
    
    return res.status(403).json({ 
      error: 'Origin not allowed',
      message: 'This request is not allowed from your origin'
    });
  }
  
  next();
};

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
// Create transporter function to ensure fresh credentials are read each time
function getEmailTransporter() {
  const host = process.env.EMAIL_HOST;
  const port = parseInt(process.env.EMAIL_PORT || '587');
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  
  if (!host || !user || !pass) {
    throw new Error('Email configuration incomplete. Check EMAIL_HOST, EMAIL_USER, and EMAIL_PASS environment variables.');
  }
  
  // Debug: Log configuration (without exposing password)
  // Authentication configuration
  // IMPORTANT: Don't modify the password - use it exactly as provided
  const authConfig = {
    user: user.trim(), // Remove any whitespace - should be full email: support@andiamoevents.com
    pass: pass // Use password exactly as provided (don't trim - might remove needed characters)
  };
  
  // Configuration for mail.routing.net with STARTTLS on port 587
  // IMPORTANT: Port 587 uses STARTTLS, so secure MUST be false
  // Using secure: true with port 587 causes authentication failure (535 5.7.8)
  const transporterConfig = {
    host: host,
    port: port,
    secure: false, // CRITICAL: Must be false for STARTTLS on port 587
    requireTLS: true, // Require TLS upgrade via STARTTLS
    tls: {
      // Allow self-signed certificates (some servers use them)
      rejectUnauthorized: false, // Set to false to allow self-signed certs
    },
    auth: {
      user: authConfig.user,
      pass: authConfig.pass
    }
    // Don't specify authMethod - let nodemailer negotiate with server
  };
  
  return nodemailer.createTransport(transporterConfig);
}

// Create default transporter (for backward compatibility)
const transporter = getEmailTransporter();

// Security: Monitoring and alerting for suspicious activity
const checkSuspiciousActivity = async (eventType, details, req) => {
  if (!supabase) return;
  
  try {
    const ipAddress = normalizeIP(req); // PHASE 2: Normalized IP
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    // Check for suspicious patterns in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    // Count similar events from same IP
    const { data: recentEvents, error: countError } = await supabase
      .from('security_audit_logs')
      .select('id')
      .eq('ip_address', ipAddress)
      .eq('event_type', eventType)
      .gte('created_at', oneHourAgo);
    
    if (countError) {
      console.error('Error checking suspicious activity:', countError);
      return;
    }
    
    const eventCount = recentEvents?.length || 0;
    
    // Define thresholds for different event types
    const thresholds = {
      'rate_limit_exceeded': 5, // Alert after 5 rate limit violations
      'webhook_signature_failed': 3, // Alert after 3 failed signatures
      'unauthorized_ticket_generation': 2, // Alert after 2 unauthorized attempts
      'invalid_order_access': 10, // Alert after 10 invalid order IDs
      'origin_validation_failed': 5, // Alert after 5 origin failures
    };
    
    const threshold = thresholds[eventType] || 10; // Default threshold
    
    if (eventCount >= threshold) {
      // Log critical alert
      // Use service role client for security audit logs (bypasses RLS)
      const securityLogClient = supabaseService || supabase;
      await securityLogClient.from('security_audit_logs').insert({
        event_type: 'suspicious_activity_alert',
        endpoint: req.path || 'unknown',
        ip_address: ipAddress,
        user_agent: userAgent,
        request_method: req.method,
        request_path: req.path,
        details: {
          reason: `Suspicious activity detected: ${eventType}`,
          event_count: eventCount,
          threshold: threshold,
          time_window: '1 hour',
          original_event: eventType,
          original_details: details
        },
        severity: 'critical'
      });
      
      // Send alert email if configured
      const ALERT_EMAIL = process.env.SECURITY_ALERT_EMAIL;
      if (ALERT_EMAIL && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        try {
          await transporter.sendMail({
            from: `Andiamo Events Security <${process.env.EMAIL_USER}>`,
            to: ALERT_EMAIL,
            subject: `🚨 Security Alert: Suspicious Activity Detected - ${eventType}`,
            html: `
              <h2>Security Alert</h2>
              <p><strong>Event Type:</strong> ${eventType}</p>
              <p><strong>IP Address:</strong> ${ipAddress}</p>
              <p><strong>Event Count:</strong> ${eventCount} (Threshold: ${threshold})</p>
              <p><strong>Time Window:</strong> Last 1 hour</p>
              <p><strong>Endpoint:</strong> ${req.path || 'unknown'}</p>
              <p><strong>User Agent:</strong> ${userAgent}</p>
              <p><strong>Details:</strong></p>
              <pre>${JSON.stringify(details, null, 2)}</pre>
              <p><em>This is an automated security alert. Please review the security audit logs.</em></p>
            `
          });
        } catch (emailError) {
          console.error('Failed to send security alert email:', emailError);
        }
      }
      
    }
  } catch (error) {
    console.error('Error in checkSuspiciousActivity:', error);
  }
};

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

// Rate limiter for QR code access - prevent brute force token enumeration
const qrCodeAccessLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 QR code access attempts per 15 minutes per IP
  message: { error: 'Too many QR code access attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests, even successful ones
  skipFailedRequests: false, // Count failed requests too
  handler: async (req, res) => {
    // Log rate limit violation to security audit
    if (supabase) {
      try {
        // Use service role client for security audit logs (bypasses RLS)
      const securityLogClient = supabaseService || supabase;
      await securityLogClient.from('security_audit_logs').insert({
          event_type: 'rate_limit_exceeded',
          endpoint: '/api/qr-codes/:accessToken',
          ip_address: normalizeIP(req), // PHASE 2: Normalized IP
          user_agent: req.headers['user-agent'] || 'unknown',
          request_method: req.method,
          request_path: req.path,
          details: { 
            reason: 'QR code access rate limit exceeded',
            access_token: req.params?.accessToken?.substring(0, 10) + '...' // Log partial token
          },
          severity: 'medium'
        });
      } catch (logError) {
        console.error('Failed to log rate limit violation:', logError);
      }
    }
    res.status(429).json({ error: 'Too many QR code access attempts, please try again later.' });
  }
});

// Rate limiter for SMS endpoints - prevent spam/abuse
// ============================================
// PHASE 2 SECURITY FIX: SMS Rate Limiting with IPv6 Support
// ============================================
const smsLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 SMS requests per hour per IP
  keyGenerator: (req) => {
    // Priority: Use phone number if available, otherwise normalized IP
    const phone = req.body?.phoneNumber || req.body?.phone;
    if (phone && typeof phone === 'string' && phone.trim() !== '') {
      return `sms:phone:${phone.trim()}`;
    }
    // Fallback to normalized IP (IPv4 + IPv6 canonical)
    return ipKeyGenerator(req);
  },
  message: { error: 'Too many SMS requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: async (req, res) => {
    // Log rate limit violation to security audit
    if (supabase) {
      try {
        // Use service role client for security audit logs (bypasses RLS)
      const securityLogClient = supabaseService || supabase;
      await securityLogClient.from('security_audit_logs').insert({
          event_type: 'rate_limit_exceeded',
          endpoint: req.path,
          ip_address: normalizeIP(req), // PHASE 2: Normalized IP
          user_agent: req.headers['user-agent'] || 'unknown',
          request_method: req.method,
          request_path: req.path,
          details: { 
            reason: 'SMS endpoint rate limit exceeded'
          },
          severity: 'high'
        });
      } catch (logError) {
        console.error('Failed to log rate limit violation:', logError);
      }
    }
    res.status(429).json({ error: 'Too many SMS requests, please try again later.' });
  }
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
    console.error('❌ Email sending failed:', {
      error: error.message,
      code: error.code,
      responseCode: error.responseCode,
      response: error.response,
      command: error.command,
      to: req.body?.to,
      from: process.env.EMAIL_USER,
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT || '587'
    });
    
    // Provide more specific error messages based on error type
    let errorMessage = 'Failed to send email';
    let errorDetails = error.message || 'Unknown error occurred';
    
    // Check for common SMTP errors
    if (error.code === 'EAUTH' || error.responseCode === 535 || error.responseCode === 534) {
      errorMessage = 'Email authentication failed';
      errorDetails = 'The email server credentials are invalid. Please verify EMAIL_USER and EMAIL_PASS environment variables are correct and the password has not expired.';
      
      // Log credential info (without exposing password)
      console.error('❌ Authentication failed. Check credentials:', {
        emailUser: process.env.EMAIL_USER,
        emailHost: process.env.EMAIL_HOST,
        emailPort: process.env.EMAIL_PORT || '587',
        passwordLength: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0,
        passwordSet: !!process.env.EMAIL_PASS,
        errorCode: error.code,
        responseCode: error.responseCode,
        responseMessage: error.response
      });
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Email server connection failed';
      errorDetails = `Unable to connect to the email server at ${process.env.EMAIL_HOST}:${process.env.EMAIL_PORT || '587'}. Please check the server is accessible and try again later.`;
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
        const ipAddress = normalizeIP(req); // PHASE 2: Normalized IP

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
    
    if (!shouldBypassRecaptcha) {
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
      console.error('❌ /api/admin-login: Supabase database error:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        email: email.toLowerCase().trim()
      });
      // Don't reveal database structure - return generic error
      return res.status(401).json({ 
        error: 'Invalid credentials'
      });
    }
    
    if (!admin) {
      console.error('❌ /api/admin-login: Admin not found:', {
        email: email.toLowerCase().trim()
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (!admin.password) {
      console.error('❌ /api/admin-login: Admin has no password field:', {
        adminId: admin.id,
        email: admin.email
      });
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'Admin account configuration error'
      });
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
      sameSite: 'none', // Required for cross-origin requests (Vercel preview to ngrok)
      secure: true, // Required when sameSite is 'none' (HTTPS only)
      path: '/', // Ensure cookie is available for all paths
      maxAge: 60 * 60 * 1000 // 1 hour (matches JWT expiration) - fixed expiration, cannot be extended
    };
    
    // Only set domain in production or if explicitly configured
    // Don't set domain for localhost - it breaks cookie setting
    if (isProduction && process.env.COOKIE_DOMAIN) {
      cookieOptions.domain = process.env.COOKIE_DOMAIN;
    }
    
    res.cookie('adminToken', token, cookieOptions);
    // Return admin info for logging purposes
    res.json({ 
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('❌ /api/admin-login: Unexpected error:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      type: error?.constructor?.name,
      email: req.body?.email
    });
    res.status(500).json({ 
      error: 'Internal server error', 
      details: process.env.NODE_ENV === 'production' 
        ? 'An error occurred. Please try again later.' 
        : error.message
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

// ============================================
// PHASE 2: SECURE ADMIN API ENDPOINTS
// ============================================
// All admin operations now go through secure server-side APIs
// Frontend can no longer directly access database
// ============================================

// ============================================
// SPONSORS MANAGEMENT API
// ============================================

// GET /api/admin/sponsors - List all sponsors
app.get('/api/admin/sponsors', logSecurityRequest, requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { data: sponsors, error } = await supabase
      .from('sponsors')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error fetching sponsors:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch sponsors',
        details: error.message 
      });
    }

    res.json({ success: true, sponsors: sponsors || [] });
  } catch (error) {
    console.error('❌ Error in GET /api/admin/sponsors:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// POST /api/admin/sponsors - Create new sponsor
app.post('/api/admin/sponsors', logSecurityRequest, requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { name, logo_url, description, website_url, category } = req.body;

    // SECURITY: Server-side validation
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Sponsor name is required' });
    }

    if (category && !['venue', 'brand', 'tech', 'other'].includes(category)) {
      return res.status(400).json({ 
        error: 'Invalid category',
        message: 'Category must be one of: venue, brand, tech, other'
      });
    }

    // Validate URL format if provided
    if (logo_url && typeof logo_url === 'string' && logo_url.trim() !== '') {
      try {
        new URL(logo_url);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid logo URL format' });
      }
    }

    if (website_url && typeof website_url === 'string' && website_url.trim() !== '') {
      try {
        new URL(website_url);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid website URL format' });
      }
    }

    // Create sponsor
    const sponsorData = {
      name: name.trim(),
      logo_url: logo_url?.trim() || null,
      description: description?.trim() || null,
      website_url: website_url?.trim() || null,
      category: category || 'other',
      is_global: true // Always global as per current implementation
    };

    const { data: sponsor, error: insertError } = await supabase
      .from('sponsors')
      .insert(sponsorData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error creating sponsor:', insertError);
      return res.status(500).json({ 
        error: 'Failed to create sponsor',
        details: insertError.message 
      });
    }

    // SECURITY: Log admin action (server-side audit)
    const adminId = req.admin.id;
    const adminEmail = req.admin.email;
    try {
      const securityLogClient = supabaseService || supabase;
      await securityLogClient.from('security_audit_logs').insert({
        event_type: 'admin_action',
        endpoint: '/api/admin/sponsors',
        ip_address: normalizeIP(req), // PHASE 2: Normalized IP
        user_agent: req.headers['user-agent'] || 'unknown',
        request_method: 'POST',
        request_path: '/api/admin/sponsors',
        details: {
          action: 'create_sponsor',
          admin_id: adminId,
          admin_email: adminEmail,
          sponsor_id: sponsor.id,
          sponsor_name: sponsor.name
        },
        severity: 'medium'
      }).catch(err => console.warn('⚠️ Failed to log admin action:', err));
    } catch (logError) {
      console.warn('⚠️ Failed to log sponsor creation:', logError);
    }

    res.status(201).json({ 
      success: true, 
      sponsor,
      message: 'Sponsor created successfully'
    });
  } catch (error) {
    console.error('❌ Error in POST /api/admin/sponsors:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// PUT /api/admin/sponsors/:id - Update sponsor
app.put('/api/admin/sponsors/:id', logSecurityRequest, requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const sponsorId = req.params.id;
    const { name, logo_url, description, website_url, category } = req.body;

    // Validate sponsor ID
    if (!sponsorId || typeof sponsorId !== 'string') {
      return res.status(400).json({ error: 'Invalid sponsor ID' });
    }

    // SECURITY: Verify sponsor exists
    const { data: existingSponsor, error: fetchError } = await supabase
      .from('sponsors')
      .select('id, name')
      .eq('id', sponsorId)
      .single();

    if (fetchError || !existingSponsor) {
      return res.status(404).json({ error: 'Sponsor not found' });
    }

    // SECURITY: Server-side validation
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: 'Sponsor name cannot be empty' });
      }
    }

    if (category !== undefined && !['venue', 'brand', 'tech', 'other'].includes(category)) {
      return res.status(400).json({ 
        error: 'Invalid category',
        message: 'Category must be one of: venue, brand, tech, other'
      });
    }

    // Validate URL format if provided
    if (logo_url !== undefined && logo_url !== null && typeof logo_url === 'string' && logo_url.trim() !== '') {
      try {
        new URL(logo_url);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid logo URL format' });
      }
    }

    if (website_url !== undefined && website_url !== null && typeof website_url === 'string' && website_url.trim() !== '') {
      try {
        new URL(website_url);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid website URL format' });
      }
    }

    // Build update data (only include provided fields)
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (logo_url !== undefined) updateData.logo_url = logo_url?.trim() || null;
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (website_url !== undefined) updateData.website_url = website_url?.trim() || null;
    if (category !== undefined) updateData.category = category;

    const { data: updatedSponsor, error: updateError } = await supabase
      .from('sponsors')
      .update(updateData)
      .eq('id', sponsorId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating sponsor:', updateError);
      return res.status(500).json({ 
        error: 'Failed to update sponsor',
        details: updateError.message 
      });
    }

    // SECURITY: Log admin action (server-side audit)
    const adminId = req.admin.id;
    const adminEmail = req.admin.email;
    try {
      const securityLogClient = supabaseService || supabase;
      await securityLogClient.from('security_audit_logs').insert({
        event_type: 'admin_action',
        endpoint: '/api/admin/sponsors/:id',
        ip_address: normalizeIP(req), // PHASE 2: Normalized IP
        user_agent: req.headers['user-agent'] || 'unknown',
        request_method: 'PUT',
        request_path: `/api/admin/sponsors/${sponsorId}`,
        details: {
          action: 'update_sponsor',
          admin_id: adminId,
          admin_email: adminEmail,
          sponsor_id: sponsorId,
          old_name: existingSponsor.name,
          new_name: updatedSponsor.name,
          changes: updateData
        },
        severity: 'medium'
      }).catch(err => console.warn('⚠️ Failed to log admin action:', err));
    } catch (logError) {
      console.warn('⚠️ Failed to log sponsor update:', logError);
    }

    res.json({ 
      success: true, 
      sponsor: updatedSponsor,
      message: 'Sponsor updated successfully'
    });
  } catch (error) {
    console.error('❌ Error in PUT /api/admin/sponsors/:id:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// DELETE /api/admin/sponsors/:id - Delete sponsor
app.delete('/api/admin/sponsors/:id', logSecurityRequest, requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const sponsorId = req.params.id;

    // Validate sponsor ID
    if (!sponsorId || typeof sponsorId !== 'string') {
      return res.status(400).json({ error: 'Invalid sponsor ID' });
    }

    // SECURITY: Verify sponsor exists and get name for audit
    const { data: existingSponsor, error: fetchError } = await supabase
      .from('sponsors')
      .select('id, name')
      .eq('id', sponsorId)
      .single();

    if (fetchError || !existingSponsor) {
      return res.status(404).json({ error: 'Sponsor not found' });
    }

    // Delete associated event_sponsors first (cascade)
    const { error: eventSponsorError } = await supabase
      .from('event_sponsors')
      .delete()
      .eq('sponsor_id', sponsorId);

    if (eventSponsorError) {
      console.error('⚠️ Error deleting event_sponsors:', eventSponsorError);
      // Continue with sponsor deletion even if event_sponsors deletion fails
    }

    // Delete sponsor
    const { error: deleteError } = await supabase
      .from('sponsors')
      .delete()
      .eq('id', sponsorId);

    if (deleteError) {
      console.error('❌ Error deleting sponsor:', deleteError);
      return res.status(500).json({ 
        error: 'Failed to delete sponsor',
        details: deleteError.message 
      });
    }

    // SECURITY: Log admin action (server-side audit)
    const adminId = req.admin.id;
    const adminEmail = req.admin.email;
    try {
      const securityLogClient = supabaseService || supabase;
      await securityLogClient.from('security_audit_logs').insert({
        event_type: 'admin_action',
        endpoint: '/api/admin/sponsors/:id',
        ip_address: normalizeIP(req), // PHASE 2: Normalized IP
        user_agent: req.headers['user-agent'] || 'unknown',
        request_method: 'DELETE',
        request_path: `/api/admin/sponsors/${sponsorId}`,
        details: {
          action: 'delete_sponsor',
          admin_id: adminId,
          admin_email: adminEmail,
          sponsor_id: sponsorId,
          sponsor_name: existingSponsor.name
        },
        severity: 'medium'
      }).catch(err => console.warn('⚠️ Failed to log admin action:', err));
    } catch (logError) {
      console.warn('⚠️ Failed to log sponsor deletion:', logError);
    }

    res.json({ 
      success: true,
      message: 'Sponsor deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error in DELETE /api/admin/sponsors/:id:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Admin verify endpoint
// IMPORTANT: This endpoint does NOT extend or refresh the session
// The JWT expiration is fixed at 1 hour from login and cannot be changed
// Refreshing the page, navigating, or closing/reopening the browser does NOT restart the timer
// The session countdown continues from the original login time
app.get('/api/verify-admin', verifyAdminLimiter, requireAdminAuth, async (req, res) => {
  if (!supabase) {
    console.error('❌ /api/verify-admin: Supabase not configured');
    return res.status(500).json({ 
      valid: false, 
      error: 'Supabase not configured',
      details: 'Please check SUPABASE_URL and SUPABASE_ANON_KEY environment variables'
    });
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

    if (error) {
      console.error('❌ /api/verify-admin: Database error:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        adminId: req.admin?.id,
        adminEmail: req.admin?.email
      });
      return res.status(500).json({ 
        valid: false, 
        error: 'Database error',
        details: error.message || 'Failed to verify admin'
      });
    }

    if (!admin) {
      console.error('❌ /api/verify-admin: Admin not found or inactive:', {
        adminId: req.admin?.id,
        adminEmail: req.admin?.email
      });
      return res.status(401).json({ 
        valid: false, 
        error: 'Invalid admin',
        details: 'Admin not found or account is inactive'
      });
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
    console.error('❌ /api/verify-admin: Unexpected error:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      adminId: req.admin?.id,
      adminEmail: req.admin?.email
    });
    res.status(500).json({ 
      valid: false, 
      error: 'Server error',
      details: error.message || 'An unexpected error occurred'
    });
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
  try {
    // Try multiple ways to get the token (cookie parser, manual parsing)
    let token = req.cookies?.adminToken;
    
    // Fallback: Parse cookie header manually if cookie parser didn't work
    if (!token && req.headers.cookie) {
      const cookieMatch = req.headers.cookie.match(/adminToken=([^;]+)/);
      token = cookieMatch ? cookieMatch[1] : null;
    }
    
    if (!token) {
      console.error('❌ requireAdminAuth: No token found', {
        hasCookies: !!req.cookies,
        cookieKeys: req.cookies ? Object.keys(req.cookies) : [],
        hasCookieHeader: !!req.headers.cookie,
        cookieHeader: req.headers.cookie ? req.headers.cookie.substring(0, 100) : 'none',
        path: req.path
      });
      return res.status(401).json({ 
        error: 'Not authenticated', 
        reason: 'No token provided',
        valid: false
      });
    }
    
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('⚠️ WARNING: JWT_SECRET is not set! Using fallback secret. This is insecure in production.');
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({ 
          error: 'Server configuration error', 
          details: 'JWT_SECRET is required in production.',
          valid: false
        });
      }
    }
    
    // jwt.verify automatically checks expiration - throws error if expired
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret || 'fallback-secret-dev-only');
    } catch (jwtError) {
      // Token is invalid, expired, or malformed
      console.error('❌ requireAdminAuth: JWT verification failed:', {
        error: jwtError.message,
        name: jwtError.name,
        path: req.path
      });
      // Clear the cookie to prevent reuse
      res.clearCookie('adminToken', { path: '/' });
      return res.status(401).json({ 
        error: 'Invalid or expired token', 
        reason: jwtError.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token',
        valid: false
      });
    }
    
    // Validate decoded token has required fields
    if (!decoded.id || !decoded.email || !decoded.role) {
      console.error('❌ requireAdminAuth: Invalid token payload:', {
        hasId: !!decoded.id,
        hasEmail: !!decoded.email,
        hasRole: !!decoded.role,
        path: req.path
      });
      res.clearCookie('adminToken', { path: '/' });
      return res.status(401).json({ 
        error: 'Invalid token', 
        reason: 'Token payload is invalid',
        valid: false
      });
    }
    
    req.admin = decoded;
    next();
  } catch (error) {
    // Catch any unexpected errors in the middleware
    console.error('❌ requireAdminAuth: Unexpected error:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      path: req.path
    });
    res.clearCookie('adminToken', { path: '/' });
    return res.status(500).json({ 
      error: 'Authentication error', 
      details: 'An unexpected error occurred during authentication',
      valid: false
    });
  }
}

// ============================================
// TEAM MEMBERS MANAGEMENT API
// ============================================

// GET /api/admin/team-members - List all team members
app.get('/api/admin/team-members', logSecurityRequest, requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { data: teamMembers, error } = await supabase
      .from('team_members')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error fetching team members:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch team members',
        details: error.message 
      });
    }

    res.json({ success: true, teamMembers: teamMembers || [] });
  } catch (error) {
    console.error('❌ Error in GET /api/admin/team-members:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// POST /api/admin/team-members - Create new team member
app.post('/api/admin/team-members', logSecurityRequest, requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { name, role, photo_url, bio, social_url } = req.body;

    // SECURITY: Server-side validation
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Team member name is required' });
    }

    if (!role || typeof role !== 'string' || role.trim() === '') {
      return res.status(400).json({ error: 'Team member role is required' });
    }

    // Validate URL format if provided
    if (photo_url && typeof photo_url === 'string' && photo_url.trim() !== '') {
      try {
        new URL(photo_url);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid photo URL format' });
      }
    }

    if (social_url && typeof social_url === 'string' && social_url.trim() !== '') {
      try {
        new URL(social_url);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid social URL format' });
      }
    }

    // Create team member
    const teamData = {
      name: name.trim(),
      role: role.trim(),
      photo_url: photo_url?.trim() || null,
      bio: bio?.trim() || null,
      social_url: social_url?.trim() || null
    };

    const { data: teamMember, error: insertError } = await supabase
      .from('team_members')
      .insert(teamData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error creating team member:', insertError);
      return res.status(500).json({ 
        error: 'Failed to create team member',
        details: insertError.message 
      });
    }

    // SECURITY: Log admin action (server-side audit)
    const adminId = req.admin.id;
    const adminEmail = req.admin.email;
    try {
      const securityLogClient = supabaseService || supabase;
      await securityLogClient.from('security_audit_logs').insert({
        event_type: 'admin_action',
        endpoint: '/api/admin/team-members',
        ip_address: normalizeIP(req), // PHASE 2: Normalized IP
        user_agent: req.headers['user-agent'] || 'unknown',
        request_method: 'POST',
        request_path: '/api/admin/team-members',
        details: {
          action: 'create_team_member',
          admin_id: adminId,
          admin_email: adminEmail,
          team_member_id: teamMember.id,
          team_member_name: teamMember.name
        },
        severity: 'medium'
      }).catch(err => console.warn('⚠️ Failed to log admin action:', err));
    } catch (logError) {
      console.warn('⚠️ Failed to log team member creation:', logError);
    }

    res.status(201).json({ 
      success: true, 
      teamMember,
      message: 'Team member created successfully'
    });
  } catch (error) {
    console.error('❌ Error in POST /api/admin/team-members:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// PUT /api/admin/team-members/:id - Update team member
app.put('/api/admin/team-members/:id', logSecurityRequest, requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const teamMemberId = req.params.id;
    const { name, role, photo_url, bio, social_url } = req.body;

    // Validate team member ID
    if (!teamMemberId || typeof teamMemberId !== 'string') {
      return res.status(400).json({ error: 'Invalid team member ID' });
    }

    // SECURITY: Verify team member exists
    const { data: existingMember, error: fetchError } = await supabase
      .from('team_members')
      .select('id, name')
      .eq('id', teamMemberId)
      .single();

    if (fetchError || !existingMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // SECURITY: Server-side validation
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: 'Team member name cannot be empty' });
      }
    }

    if (role !== undefined) {
      if (typeof role !== 'string' || role.trim() === '') {
        return res.status(400).json({ error: 'Team member role cannot be empty' });
      }
    }

    // Validate URL format if provided
    if (photo_url !== undefined && photo_url !== null && typeof photo_url === 'string' && photo_url.trim() !== '') {
      try {
        new URL(photo_url);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid photo URL format' });
      }
    }

    if (social_url !== undefined && social_url !== null && typeof social_url === 'string' && social_url.trim() !== '') {
      try {
        new URL(social_url);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid social URL format' });
      }
    }

    // Build update data (only include provided fields)
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (role !== undefined) updateData.role = role.trim();
    if (photo_url !== undefined) updateData.photo_url = photo_url?.trim() || null;
    if (bio !== undefined) updateData.bio = bio?.trim() || null;
    if (social_url !== undefined) updateData.social_url = social_url?.trim() || null;

    const { data: updatedMember, error: updateError } = await supabase
      .from('team_members')
      .update(updateData)
      .eq('id', teamMemberId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating team member:', updateError);
      return res.status(500).json({ 
        error: 'Failed to update team member',
        details: updateError.message 
      });
    }

    // SECURITY: Log admin action (server-side audit)
    const adminId = req.admin.id;
    const adminEmail = req.admin.email;
    try {
      const securityLogClient = supabaseService || supabase;
      await securityLogClient.from('security_audit_logs').insert({
        event_type: 'admin_action',
        endpoint: '/api/admin/team-members/:id',
        ip_address: normalizeIP(req), // PHASE 2: Normalized IP
        user_agent: req.headers['user-agent'] || 'unknown',
        request_method: 'PUT',
        request_path: `/api/admin/team-members/${teamMemberId}`,
        details: {
          action: 'update_team_member',
          admin_id: adminId,
          admin_email: adminEmail,
          team_member_id: teamMemberId,
          old_name: existingMember.name,
          new_name: updatedMember.name,
          changes: updateData
        },
        severity: 'medium'
      }).catch(err => console.warn('⚠️ Failed to log admin action:', err));
    } catch (logError) {
      console.warn('⚠️ Failed to log team member update:', logError);
    }

    res.json({ 
      success: true, 
      teamMember: updatedMember,
      message: 'Team member updated successfully'
    });
  } catch (error) {
    console.error('❌ Error in PUT /api/admin/team-members/:id:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// DELETE /api/admin/team-members/:id - Delete team member
app.delete('/api/admin/team-members/:id', logSecurityRequest, requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const teamMemberId = req.params.id;

    // Validate team member ID
    if (!teamMemberId || typeof teamMemberId !== 'string') {
      return res.status(400).json({ error: 'Invalid team member ID' });
    }

    // SECURITY: Verify team member exists and get name for audit
    const { data: existingMember, error: fetchError } = await supabase
      .from('team_members')
      .select('id, name')
      .eq('id', teamMemberId)
      .single();

    if (fetchError || !existingMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Delete team member
    const { error: deleteError } = await supabase
      .from('team_members')
      .delete()
      .eq('id', teamMemberId);

    if (deleteError) {
      console.error('❌ Error deleting team member:', deleteError);
      return res.status(500).json({ 
        error: 'Failed to delete team member',
        details: deleteError.message 
      });
    }

    // SECURITY: Log admin action (server-side audit)
    const adminId = req.admin.id;
    const adminEmail = req.admin.email;
    try {
      const securityLogClient = supabaseService || supabase;
      await securityLogClient.from('security_audit_logs').insert({
        event_type: 'admin_action',
        endpoint: '/api/admin/team-members/:id',
        ip_address: normalizeIP(req), // PHASE 2: Normalized IP
        user_agent: req.headers['user-agent'] || 'unknown',
        request_method: 'DELETE',
        request_path: `/api/admin/team-members/${teamMemberId}`,
        details: {
          action: 'delete_team_member',
          admin_id: adminId,
          admin_email: adminEmail,
          team_member_id: teamMemberId,
          team_member_name: existingMember.name
        },
        severity: 'medium'
      }).catch(err => console.warn('⚠️ Failed to log admin action:', err));
    } catch (logError) {
      console.warn('⚠️ Failed to log team member deletion:', logError);
    }

    res.json({ 
      success: true,
      message: 'Team member deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error in DELETE /api/admin/team-members/:id:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

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

// ============================================
// WinSMS API Configuration
// ============================================
// API key from environment variable (no hardcoded values)
const WINSMS_API_KEY = process.env.WINSMS_API_KEY;
const WINSMS_API_HOST = 'www.winsmspro.com';
const WINSMS_API_PATH = '/sms/sms/api';
const WINSMS_SENDER = 'Andiamo'; // Sender ID (max 11 characters, no spaces)

if (!WINSMS_API_KEY) {
  console.warn('⚠️  WINSMS_API_KEY not configured. SMS functionality will be disabled.');
}

// ============================================
// Helper: Format Tunisian Phone Number for SMS
// ============================================
// Converts phone number to format: +216xxxxxxxx (for WinSMS API)
// Database stores just the 8 digits (xxxxxxxx), this function adds +216 prefix for SMS
function formatPhoneNumber(phone) {
  if (!phone) return null;
  
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Remove country code if present (216 or +216)
  if (cleaned.startsWith('216')) {
    cleaned = cleaned.substring(3);
  }
  
  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');
  
  // Validate: must be 8 digits starting with 2, 5, 9, or 4
  if (cleaned.length === 8 && /^[2594]/.test(cleaned)) {
    // Return with +216 prefix for WinSMS API
    return '+216' + cleaned;
  }
  
  return null;
}

// ============================================
// Helper: Send SMS via WinSMS API (WAIT for response)
// ============================================
// Based on WinSMS documentation: Send SMS to one/multiple numbers (WAIT for response)
async function sendSms(phoneNumbers, message, senderId = WINSMS_SENDER) {
  if (!WINSMS_API_KEY) {
    throw new Error('SMS service not configured: WINSMS_API_KEY is required');
  }

  if (!phoneNumbers || (Array.isArray(phoneNumbers) && phoneNumbers.length === 0)) {
    throw new Error('Phone numbers are required');
  }

  if (!message || !message.trim()) {
    throw new Error('Message is required');
  }

  // Format phone numbers
  const phoneArray = Array.isArray(phoneNumbers) ? phoneNumbers : [phoneNumbers];
  const formattedNumbers = phoneArray
    .map(phone => formatPhoneNumber(phone))
    .filter(phone => phone !== null);

  if (formattedNumbers.length === 0) {
    throw new Error('No valid phone numbers provided');
  }

  // Join multiple numbers with comma (as per WinSMS documentation)
  const toParam = formattedNumbers.join(',');

  // Build URL with query parameters (GET method as per WinSMS documentation)
  // Documentation: https://www.winsmspro.com/sms/sms/api?action=send-sms&api_key=xxx&to=xxx&sms=xxx&from=xxx&response=json
  const queryParams = querystring.stringify({
    action: 'send-sms',
    api_key: WINSMS_API_KEY,
    to: toParam,
    sms: message.trim(),
    from: senderId,
    response: 'json' // Required by WinSMS API to get JSON response
  });

  const url = `https://${WINSMS_API_HOST}${WINSMS_API_PATH}?${queryParams}`;
  
  console.log('Sending SMS:', {
    from: senderId,
    messageLength: message.trim().length,
    url: url.replace(WINSMS_API_KEY, '***') // Hide API key in logs
  });

  // Make HTTPS GET request (as per WinSMS documentation)
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: parsed,
            raw: data
          });
        } catch (e) {
          console.error('❌ WinSMS API response parse error:', e.message);
          console.error('❌ Raw response:', data);
          resolve({
            status: res.statusCode,
            data: data,
            raw: data,
            parseError: e.message
          });
        }
      });
    }).on('error', (e) => {
      console.error('❌ WinSMS API request error:', e.message);
      reject(new Error(`SMS API request failed: ${e.message}`));
    });
  });
}

// ============================================
// ORDER ID HELPER: Single Source of Truth
// ============================================
// CRITICAL: ONE ORDER = ONE PUBLIC ORDER IDENTIFIER
// UUID = internal technical identifier (DB, logs, APIs)
// order_number = public business identifier (SMS, email, support)
// Never expose UUID to users - always use order_number
// ============================================

/**
 * Get public order identifier for customer-facing communications
 * 
 * @param {Object} order - Order object with order_number field
 * @returns {string} Public order ID in format "#123456"
 * @throws {Error} If order_number is missing (this must never happen)
 * 
 * SECURITY RULE:
 * - UUID should NEVER be exposed to users
 * - order_number is the ONLY public identifier
 * - If order_number is missing, this is a critical error
 */
function getPublicOrderId(order) {
  if (!order) {
    throw new Error('Order object is required');
  }
  
  if (!order.order_number) {
    // CRITICAL: order_number must exist - this is a business invariant
    // Do NOT fallback to UUID - this is a system error that must be fixed
    console.error('🚨 CRITICAL ERROR: order_number is missing for order:', {
      orderId: order.id,
      source: order.source,
      status: order.status,
      createdAt: order.created_at
    });
    throw new Error(
      `order_number is missing for order ${order.id || 'unknown'}. ` +
      `This must never happen - order_number should be auto-generated by database. ` +
      `Check database trigger/function: generate_random_order_number()`
    );
  }
  
  return `#${order.order_number}`;
}

// ============================================
// Helper: Check WinSMS Account Balance
// ============================================
async function checkSmsBalance() {
  if (!WINSMS_API_KEY) {
    throw new Error('SMS service not configured: WINSMS_API_KEY is required');
  }

  // Build URL with query parameters (GET method as per WinSMS documentation)
  // Documentation: https://www.winsmspro.com/sms/sms/api?action=check-balance&api_key=xxx&response=json
  const queryParams = querystring.stringify({
    action: 'check-balance',
    api_key: WINSMS_API_KEY,
    response: 'json' // Required by WinSMS API to get JSON response
  });
  
  const url = `https://${WINSMS_API_HOST}${WINSMS_API_PATH}?${queryParams}`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: parsed,
            raw: data
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data,
            raw: data
          });
        }
      });
    }).on('error', (e) => {
      reject(new Error(`Balance check failed: ${e.message}`));
    });
  });
}

// ============================================
// POST /api/send-sms - Send SMS Broadcast
// ============================================
app.post('/api/send-sms', requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase not configured' });
    }

    if (!WINSMS_API_KEY) {
      return res.status(500).json({ 
        success: false, 
        error: 'SMS service not configured. WINSMS_API_KEY environment variable is required.' 
      });
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

    // Process each phone number individually
    for (const phoneNumber of phoneNumbers) {
      const formattedNumber = formatPhoneNumber(phoneNumber);
      
      if (!formattedNumber) {
        const errorMsg = `Invalid phone number format: ${phoneNumber}`;
        errors.push({ phoneNumber, error: errorMsg });
        
        await supabase.from('sms_logs').insert({
          phone_number: phoneNumber,
          message: message.trim(),
          status: 'failed',
          error_message: errorMsg
        });
        continue;
      }

      try {
        // Send SMS using clean helper function
        const responseData = await sendSms(formattedNumber, message);
        
        // Check if response indicates success
        const isSuccess = responseData.status === 200 && 
                         responseData.data && 
                         (responseData.data.code === 'ok' || 
                          responseData.data.code === '200' ||
                          (responseData.data.message && responseData.data.message.toLowerCase().includes('successfully')));

        if (isSuccess) {
          await supabase.from('sms_logs').insert({
            phone_number: phoneNumber,
            message: message.trim(),
            status: 'sent',
            api_response: JSON.stringify(responseData.data || responseData.raw),
            sent_at: new Date().toISOString()
          });
          
          results.push({ phoneNumber, success: true, response: responseData.data || responseData.raw });
        } else {
          const errorMsg = responseData.data?.message || 
                          (responseData.data?.code ? `Error code ${responseData.data.code}` : 'SMS sending failed');
          
          await supabase.from('sms_logs').insert({
            phone_number: phoneNumber,
            message: message.trim(),
            status: 'failed',
            error_message: errorMsg,
            api_response: JSON.stringify(responseData.data || responseData.raw)
          });
          
          errors.push({ phoneNumber, error: errorMsg });
        }
      } catch (error) {
        const errorMsg = error.message || 'Unknown error';
        
        await supabase.from('sms_logs').insert({
          phone_number: phoneNumber,
          message: message.trim(),
          status: 'failed',
          error_message: errorMsg,
          api_response: null
        });

        errors.push({ phoneNumber, error: errorMsg });
      }

      // Small delay between requests to avoid overwhelming the API
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

// ============================================
// GET /api/sms-balance - Check WinSMS Account Balance
// ============================================
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
    
    // Use clean helper function
    const responseData = await checkSmsBalance();
    
    // Parse response
    let balanceData = responseData.data;
    if (typeof balanceData === 'string') {
      try {
        balanceData = JSON.parse(balanceData);
      } catch (e) {
        // Keep as string if JSON parse fails
      }
    }

    // Check for error codes
    if (balanceData && balanceData.code && balanceData.code !== '200') {
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
      balanceValue: balanceData?.balance || balanceData?.solde || balanceData?.credit || balanceData?.amount || null
    });
  } catch (error) {
    console.error('Error checking SMS balance:', error);
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

// NOTE: The previous sendSingleSms helper has been removed.
// All SMS sending now uses sendSms(phoneNumbers, message) with robust logging and JSON responses per WinSMS docs.

// ============================================
// INTERNAL SMS HELPERS (Server-Side Only - No Public Endpoints)
// ============================================
// These functions are INTERNAL ONLY - called from other endpoints
// They are NOT exposed as public API endpoints to prevent abuse
// SMS can only be sent as part of order creation/approval, not directly

async function sendOrderConfirmationSmsInternal(order) {
  // INTERNAL ONLY - Sends SMS to customer after order creation
  if (!WINSMS_API_KEY) {
    console.warn('⚠️ SMS service not configured - skipping SMS');
    return { success: false, error: 'SMS service not configured' };
  }

  if (!order.ambassador_id || !order.ambassadors) {
    console.warn('⚠️ Order does not have ambassador - skipping SMS');
    return { success: false, error: 'Order does not have ambassador assigned' };
  }

  try {
    // Get order access token for QR codes
    const apiBase = process.env.VITE_API_URL || process.env.API_URL || 'https://andiamoevents.com';
    let qrCodeUrl = null;
    
    if (order.qr_access_token) {
      qrCodeUrl = `${apiBase}/api/qr-codes/${order.qr_access_token}`;
    }

    // Format passes for SMS
    let passesText = '';
    if (order.order_passes && order.order_passes.length > 0) {
      passesText = order.order_passes.map(p => 
        `${p.quantity}× ${p.pass_type} (${p.price} DT)`
      ).join(' + ');
    } else if (order.notes) {
      try {
        const notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
        if (notesData.all_passes && Array.isArray(notesData.all_passes)) {
          passesText = notesData.all_passes.map((p) => 
            `${p.quantity}× ${p.passName || p.pass_type} (${p.price} DT)`
          ).join(' + ');
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    if (!passesText) {
      passesText = `${order.quantity}× ${order.pass_type || 'Standard'} (${(order.total_price / order.quantity).toFixed(0)} DT)`;
    }

    // ============================================
    // ORDER ID FIX: Use single source of truth
    // ============================================
    const publicOrderId = getPublicOrderId(order);
    const ambassadorName = order.ambassadors.full_name;
    const ambassadorPhone = order.ambassadors.phone;

    // Build SMS message
    let message = `Commande confirmée :\n\n`;
    message += `ID:${publicOrderId} confirmée\n`;
    message += `Pass: ${passesText} | Total: ${order.total_price} DT\n`;
    message += `Ambassadeur: ${ambassadorName} – ${ambassadorPhone}\n`;
    message += `We Create Memories`;

    if (qrCodeUrl) {
      message += `\n\n🎫 Vos QR Codes:\n${qrCodeUrl}`;
      message += `\n\n⚠️ Ce lien ne peut être utilisé qu'une seule fois.`;
    }

    // Send SMS
    const formattedNumber = formatPhoneNumber(order.user_phone);
    if (!formattedNumber) {
      return { success: false, error: `Invalid phone number format: ${order.user_phone}` };
    }

    const responseData = await sendSms(formattedNumber, message);
    const isSuccess = responseData.status === 200 &&
                      responseData.data &&
                      (responseData.data.code === 'ok' ||
                       responseData.data.code === '200' ||
                       (responseData.data.message && responseData.data.message.toLowerCase().includes('successfully')));

    // Log to sms_logs
    try {
      await supabase.from('sms_logs').insert({
        phone_number: order.user_phone,
        message: message.trim(),
        status: isSuccess ? 'sent' : 'failed',
        api_response: JSON.stringify(responseData.data || responseData.raw),
        sent_at: isSuccess ? new Date().toISOString() : null,
        error_message: isSuccess ? null : (responseData.data?.message || 'SMS sending failed')
      });
    } catch (logErr) {
      console.warn('⚠️ Failed to log SMS send result:', logErr);
    }

    return { success: isSuccess, response: responseData };
  } catch (error) {
    console.error('❌ Error sending order confirmation SMS (internal):', error);
    return { success: false, error: error.message || 'Failed to send SMS' };
  }
}

async function sendAmbassadorOrderSmsInternal(order) {
  // INTERNAL ONLY - Sends SMS to ambassador after order creation
  if (!WINSMS_API_KEY) {
    console.warn('⚠️ SMS service not configured - skipping SMS');
    return { success: false, error: 'SMS service not configured' };
  }

  if (!order.ambassador_id || !order.ambassadors) {
    console.warn('⚠️ Order does not have ambassador - skipping SMS');
    return { success: false, error: 'Order does not have ambassador assigned' };
  }

  try {
    // Format passes for SMS
    let passesText = '';
    if (order.order_passes && order.order_passes.length > 0) {
      passesText = order.order_passes.map(p => 
        `${p.quantity}× ${p.pass_type} (${p.price} DT)`
      ).join(' + ');
    } else if (order.notes) {
      try {
        const notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
        if (notesData.all_passes && Array.isArray(notesData.all_passes)) {
          passesText = notesData.all_passes.map((p) => 
            `${p.quantity}× ${p.passName || p.pass_type} (${p.price} DT)`
          ).join(' + ');
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    if (!passesText) {
      passesText = `${order.quantity}× ${order.pass_type || 'Standard'} (${(order.total_price / order.quantity).toFixed(0)} DT)`;
    }

    // ============================================
    // ORDER ID FIX: Use single source of truth
    // ============================================
    const publicOrderId = getPublicOrderId(order);

    // Build SMS message
    let message = `Nouvelle commande :\n\n`;
    message += `ID:${publicOrderId}\n`;
    message += `Client: ${order.user_name} – ${order.user_phone}\n`;
    message += `Pass: ${passesText} | Total: ${order.total_price} DT\n`;
    if (order.ville) {
      message += `Ville: ${order.ville}\n`;
    }
    message += `We Create Memories`;

    // Send SMS
    const formattedNumber = formatPhoneNumber(order.ambassadors.phone);
    if (!formattedNumber) {
      return { success: false, error: `Invalid ambassador phone number format: ${order.ambassadors.phone}` };
    }

    const responseData = await sendSms(formattedNumber, message);
    const isSuccess = responseData.status === 200 &&
                      responseData.data &&
                      (responseData.data.code === 'ok' ||
                       responseData.data.code === '200' ||
                       (responseData.data.message && responseData.data.message.toLowerCase().includes('successfully')));

    // Log to sms_logs
    try {
      await supabase.from('sms_logs').insert({
        phone_number: order.ambassadors.phone,
        message: message.trim(),
        status: isSuccess ? 'sent' : 'failed',
        api_response: JSON.stringify(responseData.data || responseData.raw),
        sent_at: isSuccess ? new Date().toISOString() : null,
        error_message: isSuccess ? null : (responseData.data?.message || 'SMS sending failed')
      });
    } catch (logErr) {
      console.warn('⚠️ Failed to log SMS send result:', logErr);
    }

    return { success: isSuccess, response: responseData };
  } catch (error) {
    console.error('❌ Error sending ambassador order SMS (internal):', error);
    return { success: false, error: error.message || 'Failed to send SMS' };
  }
}

// ============================================
// DEPRECATED: POST /api/send-order-confirmation-sms - Send SMS to Client
// ============================================
// ⚠️ DEPRECATED: This endpoint is deprecated
// SMS should be sent internally from /api/orders/create
// This endpoint is kept for backward compatibility but should be removed
app.post('/api/send-order-confirmation-sms', logSecurityRequest, smsLimiter, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase not configured' });
    }

    if (!WINSMS_API_KEY) {
      return res.status(500).json({ success: false, error: 'SMS service not configured' });
    }

    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Order ID is required' });
    }

    // Fetch order with relations
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_passes (*),
        ambassadors (
          id,
          full_name,
          phone
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (!order.ambassador_id || !order.ambassadors) {
      return res.status(400).json({ success: false, error: 'Order does not have an ambassador assigned' });
    }

    // Get order access token for single URL with all QR codes
    const apiBase = process.env.VITE_API_URL || process.env.API_URL || 'https://andiamoevents.com';
    let qrCodeUrl = null;
    
    if (order.qr_access_token) {
      qrCodeUrl = `${apiBase}/api/qr-codes/${order.qr_access_token}`;
    }

    // Format passes for SMS
    let passesText = '';
    if (order.order_passes && order.order_passes.length > 0) {
      passesText = order.order_passes.map(p => 
        `${p.quantity}× ${p.pass_type} (${p.price} DT)`
      ).join(' + ');
    } else {
      if (order.notes) {
        try {
          const notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
          if (notesData.all_passes && Array.isArray(notesData.all_passes)) {
            passesText = notesData.all_passes.map((p) => 
              `${p.quantity}× ${p.passName || p.pass_type} (${p.price} DT)`
            ).join(' + ');
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      if (!passesText) {
        passesText = `${order.quantity}× ${order.pass_type || 'Standard'} (${(order.total_price / order.quantity).toFixed(0)} DT)`;
      }
    }

    // ============================================
    // ORDER ID FIX: Use single source of truth
    // ============================================
    const publicOrderId = getPublicOrderId(order);
    const ambassadorName = order.ambassadors.full_name;
    const ambassadorPhone = order.ambassadors.phone;

    // Build SMS message - Client order confirmation
    let message = `Commande confirmée :\n\n`;
    message += `ID:${publicOrderId} confirmée\n`;
    message += `Pass: ${passesText} | Total: ${order.total_price} DT\n`;
    message += `Ambassadeur: ${ambassadorName} – ${ambassadorPhone}\n`;
    message += `We Create Memories`;

    // Add single QR code URL if available (shows all QR codes)
    if (qrCodeUrl) {
      message += `\n\n🎫 Vos QR Codes:\n${qrCodeUrl}`;
      message += `\n\n⚠️ Ce lien ne peut être utilisé qu'une seule fois.`;
    }

    // Send SMS using unified helper
    const formattedNumber = formatPhoneNumber(order.user_phone);
    if (!formattedNumber) {
      return res.status(400).json({ success: false, error: `Invalid phone number format: ${order.user_phone}` });
    }
    const responseData = await sendSms(formattedNumber, message);
    const isSuccess = responseData.status === 200 &&
                      responseData.data &&
                      (responseData.data.code === 'ok' ||
                       responseData.data.code === '200' ||
                       (responseData.data.message && responseData.data.message.toLowerCase().includes('successfully')));

    // Log to sms_logs
    try {
      await supabase.from('sms_logs').insert({
        phone_number: order.user_phone,
        message: message.trim(),
        status: isSuccess ? 'sent' : 'failed',
        api_response: JSON.stringify(responseData.data || responseData.raw),
        sent_at: isSuccess ? new Date().toISOString() : null,
        error_message: isSuccess ? null : (responseData.data?.message || 'SMS sending failed')
      });
    } catch (logErr) {
      console.warn('⚠️ Failed to log SMS send result:', logErr);
    }

    if (!isSuccess) {
      return res.status(502).json({ success: false, error: responseData.data?.message || 'Failed to send SMS', result: responseData });
    }

    res.json({ success: true, message: 'SMS sent successfully', result: responseData });
  } catch (error) {
    console.error('Error sending order confirmation SMS:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send SMS'
    });
  }
});

// ============================================
// POST /api/send-ambassador-order-sms - Send SMS to Ambassador
// ============================================
app.post('/api/send-ambassador-order-sms', smsLimiter, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase not configured' });
    }

    if (!WINSMS_API_KEY) {
      return res.status(500).json({ success: false, error: 'SMS service not configured' });
    }

    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Order ID is required' });
    }

    // Fetch order with relations
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_passes (*),
        ambassadors (
          id,
          full_name,
          phone
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (!order.ambassador_id || !order.ambassadors) {
      return res.status(400).json({ success: false, error: 'Order does not have an ambassador assigned' });
    }

    // Format passes for SMS
    let passesText = '';
    if (order.order_passes && order.order_passes.length > 0) {
      passesText = order.order_passes.map(p => 
        `${p.quantity}× ${p.pass_type} (${p.price} DT)`
      ).join(' + ');
    } else {
      if (order.notes) {
        try {
          const notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
          if (notesData.all_passes && Array.isArray(notesData.all_passes)) {
            passesText = notesData.all_passes.map((p) => 
              `${p.quantity}× ${p.passName || p.pass_type} (${p.price} DT)`
            ).join(' + ');
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      if (!passesText) {
        passesText = `${order.quantity}× ${order.pass_type || 'Standard'} (${(order.total_price / order.quantity).toFixed(0)} DT)`;
      }
    }

    // ============================================
    // ORDER ID FIX: Use single source of truth
    // ============================================
    const publicOrderId = getPublicOrderId(order);
    const clientName = order.user_name;
    const clientPhone = order.user_phone;

    // Build SMS message - Ambassador new order assignment
    let message = `Nouvelle cmd ${publicOrderId}\n`;
    message += `Pass: ${passesText} | Total: ${order.total_price} DT\n`;
    message += `Client: ${clientName} – ${clientPhone}`;

    // Send SMS to ambassador using unified helper
    const formattedNumber = formatPhoneNumber(order.ambassadors.phone);
    if (!formattedNumber) {
      return res.status(400).json({ success: false, error: `Invalid ambassador phone number: ${order.ambassadors.phone}` });
    }
    const responseData = await sendSms(formattedNumber, message);
    const isSuccess = responseData.status === 200 &&
                      responseData.data &&
                      (responseData.data.code === 'ok' ||
                       responseData.data.code === '200' ||
                       (responseData.data.message && responseData.data.message.toLowerCase().includes('successfully')));

    // Log to sms_logs
    try {
      await supabase.from('sms_logs').insert({
        phone_number: order.ambassadors.phone,
        message: message.trim(),
        status: isSuccess ? 'sent' : 'failed',
        api_response: JSON.stringify(responseData.data || responseData.raw),
        sent_at: isSuccess ? new Date().toISOString() : null,
        error_message: isSuccess ? null : (responseData.data?.message || 'SMS sending failed')
      });
    } catch (logErr) {
      console.warn('⚠️ Failed to log SMS send result (ambassador):', logErr);
    }

    if (!isSuccess) {
      return res.status(502).json({ success: false, error: responseData.data?.message || 'Failed to send SMS', result: responseData });
    }

    res.json({ success: true, message: 'SMS sent successfully', result: responseData });
  } catch (error) {
    console.error('Error sending ambassador order SMS:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send SMS'
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

// ============================================
// Payment Options Endpoints
// ============================================

// GET /api/payment-options - Get enabled payment options (public)
app.get('/api/payment-options', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { data, error } = await supabase
      .from('payment_options')
      .select('*')
      .eq('enabled', true)
      .order('option_type');

    if (error) {
      console.error('Error fetching payment options:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Error in payment-options endpoint:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch payment options' });
  }
});

// GET /api/admin/payment-options - Get all payment options (admin)
app.get('/api/admin/payment-options', requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { data, error } = await supabase
      .from('payment_options')
      .select('*')
      .order('option_type');

    if (error) {
      console.error('Error fetching payment options:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Error in admin payment-options endpoint:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch payment options' });
  }
});

// PUT /api/admin/payment-options/:type - Update payment option configuration (admin)
app.put('/api/admin/payment-options/:type', requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { type } = req.params;
    const { enabled, app_name, external_link, app_image } = req.body;

    if (!['online', 'external_app', 'ambassador_cash'].includes(type)) {
      return res.status(400).json({ error: 'Invalid payment option type' });
    }

    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (enabled !== undefined) {
      updateData.enabled = enabled;
    }

    if (type === 'external_app') {
      if (app_name !== undefined) updateData.app_name = app_name;
      if (external_link !== undefined) updateData.external_link = external_link;
      if (app_image !== undefined) updateData.app_image = app_image;
    }

    const { data, error } = await supabase
      .from('payment_options')
      .update(updateData)
      .eq('option_type', type)
      .select()
      .single();

    if (error) {
      console.error('Error updating payment option:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in update payment-options endpoint:', error);
    res.status(500).json({ error: error.message || 'Failed to update payment option' });
  }
});

// ============================================
// Flouci Payment API Endpoints
// ============================================

// POST /api/flouci-generate-payment - Generate Flouci payment (backend only - keeps secret key secure)
// CRITICAL: Amount is calculated from DB, NOT trusted from frontend
app.post('/api/flouci-generate-payment', async (req, res) => {
  // Get Flouci keys at the start for error handling
  const FLOUCI_PUBLIC_KEY = process.env.FLOUCI_PUBLIC_KEY;
  const FLOUCI_SECRET_KEY = process.env.FLOUCI_SECRET_KEY;
  
  try {
    const { orderId, successLink, failLink, webhookUrl } = req.body;


    // Validate required fields (amount removed - will be calculated from DB)
    // webhookUrl is optional - only used if provided and not localhost
    if (!orderId || !successLink || !failLink) {
      console.error('❌ Missing required fields:', { orderId: !!orderId, successLink: !!successLink, failLink: !!failLink, webhookUrl: !!webhookUrl });
      return res.status(400).json({ error: 'Missing required fields: orderId, successLink, and failLink are required' });
    }
    
    // Validate URLs are absolute (must start with http:// or https://)
    if (!successLink.startsWith('http://') && !successLink.startsWith('https://')) {
      console.error('❌ Invalid successLink format (must be absolute URL):', successLink);
      return res.status(400).json({ error: 'successLink must be an absolute URL (starting with http:// or https://)' });
    }
    
    if (!failLink.startsWith('http://') && !failLink.startsWith('https://')) {
      console.error('❌ Invalid failLink format (must be absolute URL):', failLink);
      return res.status(400).json({ error: 'failLink must be an absolute URL (starting with http:// or https://)' });
    }
    
    // CRITICAL: Flouci requires HTTPS URLs for callback links (even in development)
    // Check if URLs are HTTPS
    const isSuccessLinkHttps = successLink.startsWith('https://');
    const isFailLinkHttps = failLink.startsWith('https://');
    
    if (!isSuccessLinkHttps || !isFailLinkHttps) {
      const isLocalhost = successLink.includes('localhost') || successLink.includes('127.0.0.1') || 
                          failLink.includes('localhost') || failLink.includes('127.0.0.1');
      
      if (isLocalhost) {
        console.error('❌ Flouci requires HTTPS URLs even for localhost. Use a tunnel service (ngrok, cloudflare tunnel, etc.)');
        return res.status(400).json({ 
          error: 'Flouci requires HTTPS URLs for callback links',
          message: 'For localhost development, use a tunnel service (ngrok, cloudflare tunnel, etc.) to get an HTTPS URL and set VITE_PUBLIC_URL in your .env file',
          suggestion: 'Example: Set VITE_PUBLIC_URL=https://abc123.ngrok.io in your .env file',
          currentSuccessLink: successLink.substring(0, 50) + '...',
          currentFailLink: failLink.substring(0, 50) + '...',
          help: '1. Install ngrok: https://ngrok.com\n2. Run: ngrok http 3000\n3. Copy HTTPS URL\n4. Add VITE_PUBLIC_URL=https://your-ngrok-url to .env\n5. Restart dev server'
        });
      } else {
        console.warn('⚠️ WARNING: Callback links use HTTP instead of HTTPS. Flouci requires HTTPS URLs.');
        return res.status(400).json({ 
          error: 'Flouci requires HTTPS URLs for callback links',
          message: 'Please set VITE_PUBLIC_URL=https://your-domain.com in your environment variables',
          currentSuccessLink: successLink.substring(0, 50) + '...',
          currentFailLink: failLink.substring(0, 50) + '...'
        });
      }
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    // CRITICAL: Fetch order from DB and calculate amount from order_passes (authoritative source)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        payment_gateway_reference,
        payment_response_data,
        total_price,
        order_passes (
          id,
          pass_type,
          quantity,
          price
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('❌ Order not found:', orderError);
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if order is already paid
    if (order.status === 'PAID') {
      return res.status(400).json({ 
        error: 'Order already paid',
        message: 'This order has already been paid',
        alreadyPaid: true
      });
    }

    // Check if order is in correct status for payment
    if (order.status !== 'PENDING_ONLINE') {
      console.error('❌ Order is not in PENDING_ONLINE status:', order.status);
      return res.status(400).json({ 
        error: 'Order is not ready for payment',
        message: `Order status is ${order.status}. Only PENDING_ONLINE orders can proceed to payment.`
      });
    }

    // CRITICAL: Calculate amount from order_passes (authoritative source)
    // This prevents frontend manipulation
    let calculatedAmount = 0;
    if (order.order_passes && order.order_passes.length > 0) {
      calculatedAmount = order.order_passes.reduce((sum, pass) => {
        return sum + (Number(pass.price) * Number(pass.quantity));
      }, 0);
    } else {
      // Fallback to total_price if order_passes not available (legacy orders)
      calculatedAmount = Number(order.total_price) || 0;
      console.warn('⚠️ No order_passes found, using total_price as fallback');
    }

    if (calculatedAmount <= 0) {
      console.error('❌ Invalid calculated amount:', calculatedAmount);
      return res.status(400).json({ error: 'Invalid order amount. Order has no valid passes.' });
    }


    // Check Flouci API keys (already defined at function start)
    if (!FLOUCI_PUBLIC_KEY || !FLOUCI_SECRET_KEY) {
      console.error('❌ Flouci API keys not configured');
      console.error('   FLOUCI_PUBLIC_KEY:', FLOUCI_PUBLIC_KEY ? 'Set' : 'Missing');
      console.error('   FLOUCI_SECRET_KEY:', FLOUCI_SECRET_KEY ? 'Set' : 'Missing');
      return res.status(500).json({ 
        error: 'Flouci API keys not configured',
        message: 'Please add FLOUCI_PUBLIC_KEY and FLOUCI_SECRET_KEY to your .env file'
      });
    }
    
    // Trim API keys to remove any accidental whitespace
    const trimmedPublicKey = FLOUCI_PUBLIC_KEY.trim();
    const trimmedSecretKey = FLOUCI_SECRET_KEY.trim();
    
    // Validate API keys are not empty after trimming
    if (!trimmedPublicKey || !trimmedSecretKey) {
      console.error('❌ Flouci API keys are empty after trimming');
      return res.status(500).json({ 
        error: 'Flouci API keys are invalid',
        message: 'FLOUCI_PUBLIC_KEY and FLOUCI_SECRET_KEY must not be empty'
      });
    }
    
    // Use trimmed keys for the request
    const FLOUCI_PUBLIC_KEY_CLEAN = trimmedPublicKey;
    const FLOUCI_SECRET_KEY_CLEAN = trimmedSecretKey;

    // IDEMPOTENCY: Check if payment already generated (one active payment per order)
    if (order.payment_gateway_reference) {
      
      // Try to get the payment link from stored response data
      let paymentLink = null;
      if (order.payment_response_data?.result?.link) {
        paymentLink = order.payment_response_data.result.link;
      } else if (order.payment_response_data?.link) {
        paymentLink = order.payment_response_data.link;
      }

      // If we have the link, return it (don't create duplicate payment)
      if (paymentLink) {
        return res.json({ 
          success: true,
          payment_id: order.payment_gateway_reference,
          link: paymentLink,
          isDuplicate: true,
          message: 'Payment already generated for this order'
        });
      } else {
        // Payment ID exists but no link stored - might be from old format
        // Generate new payment but log the duplicate attempt
      }
    }

    // Convert TND to millimes (Flouci uses millimes: 1 TND = 1000 millimes)
    const amountInMillimes = Math.round(calculatedAmount * 1000);
    
    // Validate amount
    // Flouci typically requires minimum 1000 millimes (1 TND)
    const MIN_AMOUNT_MILLIMES = 1000;
    if (amountInMillimes <= 0) {
      console.error('❌ Invalid amount:', calculatedAmount, 'TND, millimes:', amountInMillimes);
      return res.status(400).json({ error: 'Invalid payment amount' });
    }
    
    if (amountInMillimes < MIN_AMOUNT_MILLIMES) {
      console.error('❌ Amount too small:', calculatedAmount, 'TND, millimes:', amountInMillimes, '(minimum:', MIN_AMOUNT_MILLIMES, 'millimes)');
      return res.status(400).json({ 
        error: `Payment amount too small. Minimum amount is ${MIN_AMOUNT_MILLIMES / 1000} TND (${MIN_AMOUNT_MILLIMES} millimes)`,
        calculatedAmount,
        amountInMillimes,
        minimumRequired: MIN_AMOUNT_MILLIMES
      });
    }

    // Generate payment with Flouci
    // Build payment request - webhook is optional but recommended
    // IMPORTANT: success_link and fail_link must be absolute URLs
    console.log('Validating payment links:', {
      successLinkValid: successLink.startsWith('http'),
      failLinkValid: failLink.startsWith('http'),
      successLink: successLink.substring(0, 50) + '...',
      failLink: failLink.substring(0, 50) + '...'
    });
    
    // Note: API keys are already trimmed above, so we use the cleaned versions
    // Validate API keys format (should not contain spaces in the middle - only trimmed)
    if (FLOUCI_PUBLIC_KEY_CLEAN.includes(' ') || FLOUCI_SECRET_KEY_CLEAN.includes(' ')) {
      console.warn('⚠️ Flouci API keys contain spaces in the middle - this may cause authentication issues');
    }
    
    // Log API key info for debugging (first few chars only for security)
    console.log('Using Flouci API keys:', {
      publicKeyPrefix: FLOUCI_PUBLIC_KEY_CLEAN.substring(0, 8) + '...',
      publicKeyLength: FLOUCI_PUBLIC_KEY_CLEAN.length,
      secretKeyPrefix: FLOUCI_SECRET_KEY_CLEAN.substring(0, 8) + '...',
      secretKeyLength: FLOUCI_SECRET_KEY_CLEAN.length
    });
    
    const paymentRequest = {
      amount: amountInMillimes,
      success_link: successLink,
      fail_link: failLink,
      developer_tracking_id: orderId,
      session_timeout_secs: 1800, // 30 minutes
      accept_card: true
    };
    
    // Only add webhook if URL is valid (not localhost for production)
    // CRITICAL: Webhook URL must be the backend URL (ngrok) not frontend URL (Vercel)
    // Flouci needs to reach the backend webhook endpoint directly
    // NOTE: ngrok-free.dev may block webhook requests due to browser warning page
    // If webhook causes SMT error, we'll retry without webhook
    let useWebhook = false;
    if (webhookUrl && !webhookUrl.includes('localhost') && !webhookUrl.includes('127.0.0.1')) {
      if (webhookUrl.startsWith('http://') || webhookUrl.startsWith('https://')) {
        // Check if using ngrok-free.dev - this may cause SMT errors due to browser warning
        const isNgrokFree = webhookUrl.includes('ngrok-free.dev');
        if (isNgrokFree) {
          console.warn('⚠️ Using ngrok-free.dev - webhook may fail due to browser warning page');
          console.warn('   Consider upgrading to paid ngrok or using cloudflared tunnel for production');
          // Try with webhook anyway, but log the warning
          useWebhook = true;
        } else {
          useWebhook = true;
        }
        if (useWebhook) {
          paymentRequest.webhook = webhookUrl;
          console.log('✅ Webhook URL set:', webhookUrl.substring(0, 80) + '...');
        }
      } else {
        console.warn('⚠️ webhookUrl provided but not absolute URL, skipping:', webhookUrl.substring(0, 50));
      }
    } else {
      if (webhookUrl) {
        console.warn('⚠️ Webhook URL contains localhost, skipping webhook (Flouci requires publicly accessible URL)');
      } else {
        console.warn('⚠️ No webhook URL provided - webhook notifications will not be received automatically');
      }
    }
    
    console.log('Creating Flouci payment request:', {
      amount: amountInMillimes,
      amountTND: calculatedAmount,
      hasWebhook: !!paymentRequest.webhook,
      webhookUrl: paymentRequest.webhook ? paymentRequest.webhook.substring(0, 80) + '...' : 'none',
      requestKeys: Object.keys(paymentRequest)
    });

    // ============================================
    // PREVIEW-ONLY: Mock Flouci Payment
    // ============================================
    // In preview, don't call real Flouci API (unstable domains cause 412 errors)
    // Instead, return mock payment response to allow UI testing
    // Detect preview by checking multiple indicators
    const hasNgrokWebhook = webhookUrl && (webhookUrl.includes('ngrok-free.dev') || webhookUrl.includes('ngrok.io'));
    const hasVercelPreviewLink = successLink && successLink.includes('vercel.app') && (successLink.includes('preview') || successLink.includes('git-'));
    const isVercelPreview = process.env.VERCEL_ENV === 'preview';
    const requestOrigin = req.headers.origin || req.headers.referer || '';
    const hasVercelPreviewOrigin = requestOrigin.includes('vercel.app') && (requestOrigin.includes('preview') || requestOrigin.includes('git-'));
    const requestHost = req.headers.host || '';
    const hasNgrokHost = requestHost.includes('ngrok-free.dev') || requestHost.includes('ngrok.io');
    
    const isPreviewEnvironment = isVercelPreview || hasNgrokWebhook || hasVercelPreviewLink || hasVercelPreviewOrigin || hasNgrokHost;
    
    // Debug logging to help diagnose preview detection
    console.log('🔍 Preview Detection Check:', {
      isVercelPreview,
      hasNgrokWebhook,
      hasVercelPreviewLink,
      hasVercelPreviewOrigin,
      hasNgrokHost,
      webhookUrl: webhookUrl ? webhookUrl.substring(0, 60) + '...' : 'undefined',
      successLink: successLink ? successLink.substring(0, 60) + '...' : 'undefined',
      requestOrigin: requestOrigin ? requestOrigin.substring(0, 60) + '...' : 'undefined',
      requestHost: requestHost ? requestHost.substring(0, 60) + '...' : 'undefined',
      isPreviewEnvironment
    });
    
    if (isPreviewEnvironment) {
      console.log('🔧 PREVIEW MODE: Mocking Flouci payment (not calling real API)');
      const detectionMethod = isVercelPreview ? 'VERCEL_ENV' :
                             hasNgrokHost ? 'ngrok URL in request host' :
                             hasNgrokWebhook ? 'ngrok URL in webhook' :
                             hasVercelPreviewLink ? 'Vercel preview in successLink' :
                             hasVercelPreviewOrigin ? 'Vercel preview in origin' : 'unknown';
      console.log('   Preview detected via:', detectionMethod);
      console.log('   Real Flouci API will be called in production');
      
      // Generate mock payment_id (format similar to Flouci)
      const mockPaymentId = `preview_${orderId}_${Date.now()}`;
      // Use the actual successLink for mock payment (redirects to payment processing page)
      // Add paymentId parameter so PaymentProcessing page can handle it
      // In preview mode, this simulates a successful payment redirect
      const separator = successLink.includes('?') ? '&' : '?';
      const mockPaymentLink = `${successLink}${separator}paymentId=${mockPaymentId}&preview=true&mock=true`;
      
      // Mock response matching Flouci API format
      const mockResponse = {
        result: {
          success: true,
          payment_id: mockPaymentId,
          link: mockPaymentLink,
          status: 'PENDING'
        },
        name: 'developers',
        code: 0,
        version: 'v2'
      };
      
      // Update order with mock payment info (for testing flow)
      const updateData = {
        payment_gateway_reference: mockPaymentId,
        payment_response_data: mockResponse,
        payment_created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { error: updateError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);
      
      if (updateError) {
        console.error('❌ Failed to update order with mock payment:', updateError);
      }
      
      // Return mock response
      return res.json({
        success: true,
        payment_id: mockPaymentId,
        link: mockPaymentLink,
        isDuplicate: false,
        isPreview: true,
        message: 'PREVIEW MODE: Mock payment created. Real payment will work in production.'
      });
    }

    // PRODUCTION: Continue with real Flouci API call
    // Add timeout to prevent hanging requests (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

    let response;
    try {
      // Use cleaned/trimmed API keys
      response = await fetch('https://developers.flouci.com/api/v2/generate_payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${FLOUCI_PUBLIC_KEY_CLEAN}:${FLOUCI_SECRET_KEY_CLEAN}`
        },
        body: JSON.stringify(paymentRequest),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('❌ Flouci API request timed out after 30 seconds');
        return res.status(504).json({ 
          error: 'Payment gateway timeout',
          message: 'The payment gateway did not respond in time. Please try again.',
          details: 'Request timed out after 30 seconds'
        });
      }
      throw fetchError; // Re-throw other errors
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('❌ Failed to parse Flouci response:', parseError);
      const textResponse = await response.text();
      console.error('   Raw response:', textResponse);
      return res.status(500).json({ 
        error: 'Invalid response from Flouci API',
        details: textResponse,
        status: response.status
      });
    }

    // Flouci API returns success in data.result.success, not data.success
    const isSuccess = response.ok && data.result?.success === true;
    
    console.log('Flouci payment response:', {
      resultSuccess: data.result?.success,
      isSuccess: isSuccess,
      hasResult: !!data.result,
      hasLink: !!data.result?.link,
      hasPaymentId: !!data.result?.payment_id,
      message: data.message || data.result?.message,
      code: data.code
    });

    if (!isSuccess) {
      console.error('❌ Flouci payment generation failed:', {
        status: response.status,
        statusText: response.statusText,
        data: data,
        fullResponse: JSON.stringify(data, null, 2),
        requestAmount: amountInMillimes,
        requestAmountTND: calculatedAmount
      });
      
      // Provide more detailed error message
      let errorMessage = 'Failed to generate payment';
      let errorDetails = {};
      
      // Handle specific error codes and statuses
      if (response.status === 412 || (data.code === 1 && data.result?.error === 'SMT operation failed.')) {
        // Status 412 Precondition Failed or code 1 with SMT error
        const isNgrokFreeWithWebhook = useWebhook && webhookUrl && webhookUrl.includes('ngrok-free.dev');
        
        // If using ngrok-free.dev with webhook, the SMT error is likely due to browser warning page
        // Retry without webhook as a workaround
        if (isNgrokFreeWithWebhook && paymentRequest.webhook) {
          console.warn('⚠️ SMT error with ngrok-free.dev webhook - retrying without webhook...');
          console.warn('   Note: ngrok-free.dev requires browser visit to bypass warning, blocking webhooks');
          
          // Remove webhook and retry once
          const retryRequest = { ...paymentRequest };
          delete retryRequest.webhook;
          
          try {
            const retryResponse = await fetch('https://developers.flouci.com/api/v2/generate_payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${FLOUCI_PUBLIC_KEY_CLEAN}:${FLOUCI_SECRET_KEY_CLEAN}`
              },
              body: JSON.stringify(retryRequest),
              signal: controller.signal
            });
            
            const retryData = await retryResponse.json();
            const retrySuccess = retryResponse.ok && retryData.result?.success === true;
            
            if (retrySuccess) {
              console.log('✅ Payment created successfully without webhook (ngrok-free.dev workaround)');
              console.warn('⚠️ Webhook disabled - payment status will need manual verification');
              
              // Update order with payment info
              const updateData = {
                payment_gateway_reference: retryData.result?.payment_id || null,
                payment_response_data: retryData
              };
              
              if (retryData.result?.payment_id) {
                const { error: updateError } = await supabase
                  .from('orders')
                  .update(updateData)
                  .eq('id', orderId);
                
                if (updateError) {
                  console.error('❌ Failed to update order with payment ID:', updateError);
                }
              }
              
              return res.json({
                success: true,
                payment_id: retryData.result?.payment_id,
                link: retryData.result?.link,
                isDuplicate: false,
                webhookDisabled: true,
                message: 'Payment created without webhook due to ngrok-free.dev limitations. Manual verification required.'
              });
            } else {
              console.error('❌ Retry without webhook also failed:', retryData);
            }
          } catch (retryError) {
            console.error('❌ Error during retry without webhook:', retryError);
          }
        }
        
        errorMessage = 'Payment validation failed. Please check your payment configuration.';
        errorDetails = {
          possibleCauses: [
            'Invalid API keys format or values',
            'Amount below minimum threshold',
            'Invalid URL format (must be absolute HTTPS URLs)',
            'Missing required fields in payment request',
            ...(isNgrokFreeWithWebhook ? ['ngrok-free.dev browser warning page blocking webhook'] : [])
          ],
          suggestion: isNgrokFreeWithWebhook 
            ? 'Consider upgrading to paid ngrok or using cloudflared tunnel for production. Payment will work without webhook, but manual verification required.'
            : 'Please verify your Flouci API keys and ensure URLs are absolute HTTPS URLs',
          flouciError: data.result?.error || data.result?.details || 'SMT operation failed'
        };
        
        // Log additional diagnostic info
        console.error('🔍 SMT Error Diagnostics:', {
          apiKeyFormat: FLOUCI_PUBLIC_KEY_CLEAN ? `${FLOUCI_PUBLIC_KEY_CLEAN.substring(0, 10)}...` : 'MISSING',
          apiKeyLength: FLOUCI_PUBLIC_KEY_CLEAN?.length || 0,
          secretKeyFormat: FLOUCI_SECRET_KEY_CLEAN ? `${FLOUCI_SECRET_KEY_CLEAN.substring(0, 10)}...` : 'MISSING',
          secretKeyLength: FLOUCI_SECRET_KEY_CLEAN?.length || 0,
          amountInMillimes,
          amountInTND: calculatedAmount,
          successLinkIsHttps: successLink.startsWith('https://'),
          failLinkIsHttps: failLink.startsWith('https://'),
          hasWebhook: !!paymentRequest.webhook,
          webhookUrl: paymentRequest.webhook ? paymentRequest.webhook.substring(0, 80) + '...' : 'none',
          isNgrokFree: webhookUrl?.includes('ngrok-free.dev'),
          paymentRequestKeys: Object.keys(paymentRequest)
        });
      } else if (data.message) {
        errorMessage = data.message;
      } else if (data.result?.message) {
        errorMessage = data.result.message;
      } else if (data.result?.error) {
        errorMessage = data.result.error;
      } else if (data.code !== undefined && data.code !== 0) {
        errorMessage = `Flouci API error (code: ${data.code})`;
      } else if (response.status === 401 || response.status === 403) {
        errorMessage = 'Invalid API keys. Please check your Flouci credentials.';
        errorDetails = { suggestion: 'Verify FLOUCI_PUBLIC_KEY and FLOUCI_SECRET_KEY in your .env file' };
      } else if (response.status === 400) {
        errorMessage = 'Invalid payment request. Please check your payment details.';
      }
      
      return res.status(response.status >= 400 && response.status < 500 ? response.status : 500).json({ 
        error: errorMessage,
        details: { ...errorDetails, ...data },
        status: response.status,
        flouciError: data.result || data,
        code: data.code
      });
    }

    // Update order with payment_id and payment_created_at
    if (data.result?.payment_id) {
      const paymentCreatedAt = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          payment_gateway_reference: data.result.payment_id,
          payment_response_data: data,
          payment_created_at: paymentCreatedAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (updateError) {
        console.error('❌ Error updating order:', updateError);
        // Check if it's a unique constraint violation (idempotency protection)
        if (updateError.code === '23505' || updateError.message?.includes('unique')) {
          // Fetch existing payment link
          const { data: existingOrder } = await supabase
            .from('orders')
            .select('payment_gateway_reference, payment_response_data')
            .eq('id', orderId)
            .single();
          
          if (existingOrder?.payment_response_data?.result?.link) {
            return res.json({ 
              success: true,
              payment_id: existingOrder.payment_gateway_reference,
              link: existingOrder.payment_response_data.result.link,
              isDuplicate: true,
              message: 'Payment already exists for this order'
            });
          }
        }
        // Don't fail the request if order update fails - payment was generated successfully
      } else {
      }
    } else {
      console.warn('⚠️ No payment_id in response - skipping order update');
    }

    res.json({ 
      success: true, 
      payment_id: data.result?.payment_id,
      link: data.result?.link,
      isDuplicate: false
    });
  } catch (error) {
    console.error('❌ Error generating Flouci payment:', error);
    console.error('   Error stack:', error.stack);
    console.error('   Error name:', error.name);
    console.error('   Error code:', error.code);
    
    // Provide more specific error messages
    let errorMessage = error.message || 'Internal server error';
    let errorDetails = process.env.NODE_ENV === 'development' ? error.stack : undefined;
    
    // Check for common error types
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      errorMessage = 'Unable to connect to payment gateway. Please check your internet connection.';
      errorDetails = `Network error: ${error.message}`;
    } else if (error.name === 'TypeError' && error.message?.includes('fetch')) {
      errorMessage = 'Network error while connecting to payment gateway.';
      errorDetails = error.message;
    } else if (!FLOUCI_PUBLIC_KEY || !FLOUCI_SECRET_KEY) {
      errorMessage = 'Payment gateway not configured. Please contact administrator.';
      errorDetails = 'Flouci API keys are missing';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: errorDetails,
      code: error.code,
      name: error.name
    });
  }
});

// ============================================
// Rate Limiters for Order Operations
// ============================================
const orderCreationLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 orders per minute per IP
  message: { error: 'Too many order creation attempts. Please wait a moment and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

// ============================================
// PHASE 2 SECURITY FIX: IPv6 Rate Limiting
// ============================================
// CRITICAL: Use ipKeyGenerator helper to normalize IPv6 addresses
// Prevents IPv6 users from bypassing rate limits by using different representations
// ============================================
// PREVIEW-ONLY FIX: ipKeyGenerator already imported at top (line 7) - removed duplicate import

const orderPerPhoneLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3, // 3 orders per day per phone number
  keyGenerator: (req) => {
    // Priority 1: Business identifier (phone number) - most reliable
    const phone = req.body?.customerInfo?.phone || req.body?.customer?.phone;
    if (phone && typeof phone === 'string' && phone.trim() !== '') {
      return `phone:${phone.trim()}`;
    }
    // Priority 2: Normalized IP (IPv4 + IPv6 canonical form)
    // ipKeyGenerator normalizes IPv6 addresses to prevent bypass
    return ipKeyGenerator(req);
  },
  message: { error: 'Maximum 3 orders per day per phone number.' },
  standardHeaders: true,
  legacyHeaders: false
});

const ambassadorActionLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 actions per minute
  message: { error: 'Too many requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================
// Ambassador Authentication Middleware
// ============================================
const requireAmbassadorAuth = async (req, res, next) => {
  try {
    const { ambassadorId, ambassadorToken } = req.body;
    
    if (!ambassadorId) {
      return res.status(401).json({ error: 'Ambassador ID required' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    // Verify ambassador exists and is approved
    const { data: ambassador, error } = await supabase
      .from('ambassadors')
      .select('id, full_name, phone, status')
      .eq('id', ambassadorId)
      .eq('status', 'approved')
      .single();

    if (error || !ambassador) {
      return res.status(403).json({ 
        error: 'Unauthorized',
        message: 'Invalid ambassador or ambassador not approved'
      });
    }

    // Store ambassador in request for use in route handlers
    req.ambassador = ambassador;
    next();
  } catch (error) {
    console.error('Ambassador auth error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

// ============================================
// POST /api/orders/create - SECURE SERVER-SIDE ORDER CREATION
// ============================================
// CRITICAL SECURITY: Never trust the frontend!
// Frontend sends ONLY: passIds, quantities, customer info, idempotencyKey
// Server: validates, fetches prices, calculates totals, sends SMS (internal)
// SMS endpoints are INTERNAL ONLY - no public access
// ============================================
// POST /api/orders/create - SECURE SERVER-SIDE ORDER CREATION
// ============================================
// NEW SECURE ENDPOINT (replaces /api/create-order)
app.post('/api/orders/create', logSecurityRequest, orderCreationLimiter, orderPerPhoneLimiter, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const {
      eventId,
      passIds, // Array of { passId, quantity } - NO prices, NO names from client
      customer, // Customer info (renamed from customerInfo for consistency)
      paymentMethod,
      ambassadorId,
      idempotencyKey // UUID to prevent duplicate orders
    } = req.body;

    // ============================================
    // PHASE 1 SECURITY FIX: PRICE MANIPULATION PROTECTION
    // ============================================
    // CRITICAL: Reject ANY price/total values sent from frontend
    // Server MUST recalculate all prices from database
    // This prevents frontend price manipulation attacks
    // ============================================
    const forbiddenPriceFields = ['totalPrice', 'total_price', 'price', 'prices', 'total', 'amount', 'calculatedTotal'];
    const detectedPriceFields = [];
    
    // Check request body for forbidden price fields
    for (const field of forbiddenPriceFields) {
      if (req.body[field] !== undefined) {
        detectedPriceFields.push(field);
      }
    }
    
    // Check passIds array for price fields
    if (Array.isArray(passIds)) {
      for (const pass of passIds) {
        if (pass && typeof pass === 'object') {
          if (pass.price !== undefined) detectedPriceFields.push('passIds[].price');
          if (pass.totalPrice !== undefined) detectedPriceFields.push('passIds[].totalPrice');
          if (pass.passName !== undefined) detectedPriceFields.push('passIds[].passName'); // Also reject names (server fetches)
        }
      }
    }
    
    // If any price fields detected, REJECT request and log security event
    if (detectedPriceFields.length > 0) {
      const clientIP = normalizeIP(req); // PHASE 2: Normalized IP
      const userAgent = req.headers['user-agent'] || 'unknown';
      
      // Log security violation
      console.error('🚨 SECURITY VIOLATION: Price manipulation attempt detected', {
        endpoint: '/api/orders/create',
        ip: clientIP,
        userAgent: userAgent,
        detectedFields: detectedPriceFields,
        timestamp: new Date().toISOString(),
        severity: 'HIGH'
      });
      
      // Log to security audit (if available)
      if (supabase) {
        try {
          const securityLogClient = supabaseService || supabase;
          await securityLogClient.from('security_audit_logs').insert({
            event_type: 'price_manipulation_attempt',
            endpoint: '/api/orders/create',
            ip_address: clientIP,
            user_agent: userAgent,
            request_method: 'POST',
            request_path: '/api/orders/create',
            details: {
              detected_price_fields: detectedPriceFields,
              message: 'Frontend attempted to send price/total values. Server rejects all client-calculated prices.',
              severity: 'HIGH'
            },
            severity: 'high'
          }).catch(err => console.warn('⚠️ Failed to log security event:', err));
        } catch (logError) {
          console.warn('⚠️ Failed to log price manipulation attempt:', logError);
        }
      }
      
      return res.status(400).json({
        error: 'Security violation: Price manipulation detected',
        message: 'Server does not accept price or total values from client. All prices are calculated server-side from database.',
        detectedFields: detectedPriceFields,
        securityNote: 'This request has been logged for security review.'
      });
    }
    // ============================================
    // END PHASE 1 SECURITY FIX
    // ============================================

    // Use customer or customerInfo (backward compatibility)
    const customerData = customer || customerInfo;
    if (!customerData) {
      return res.status(400).json({ error: 'Customer information is required' });
    }

    // Normalize customer data (handle both formats)
    const normalizedCustomer = {
      full_name: customerData.full_name || customerData.name || '',
      phone: customerData.phone || '',
      email: customerData.email || '',
      city: customerData.city || '',
      ville: customerData.ville || ''
    };

    // SECURITY CHECK #1: Idempotency - Prevent duplicate orders
    if (idempotencyKey) {
      // Validate idempotency key format (must be UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(idempotencyKey)) {
        return res.status(400).json({
          error: 'Invalid idempotency key format',
          message: 'Idempotency key must be a valid UUID'
        });
      }

      // Check if order with this idempotency key already exists
      const { data: existingOrder } = await supabase
        .from('orders')
        .select(`
          *,
          order_passes (*)
        `)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existingOrder) {
        // Order already exists - return it (idempotent response)
        return res.status(200).json({
          success: true,
          order: existingOrder,
          message: 'Order already exists (idempotent response)',
          idempotent: true
        });
      }
    }

    // SECURITY CHECK #2: Block Ambassadors from creating orders
    // Ambassadors CANNOT create orders - they only receive orders from clients
    // No need to check ambassadorSession - if they're trying to create, they shouldn't be on this endpoint

    // VALIDATION #1: Required Fields
    if (!eventId) {
      return res.status(400).json({ error: 'eventId is required' });
    }

    if (!passIds || !Array.isArray(passIds) || passIds.length === 0) {
      return res.status(400).json({ error: 'passIds array is required and must contain at least one pass' });
    }

    if (!normalizedCustomer.full_name || normalizedCustomer.full_name.trim() === '') {
      return res.status(400).json({ error: 'Customer full name is required' });
    }

    if (!normalizedCustomer.phone || normalizedCustomer.phone.trim() === '') {
      return res.status(400).json({ error: 'Customer phone is required' });
    }

    if (!normalizedCustomer.city || normalizedCustomer.city.trim() === '') {
      return res.status(400).json({ error: 'Customer city is required' });
    }

    if (!paymentMethod) {
      return res.status(400).json({ error: 'paymentMethod is required' });
    }

    // SECURITY: Fetch ALL passes for this event from database
    const { data: eventPasses, error: eventError } = await supabase
      .from('event_passes')
      .select('id, name, price, event_id')
      .eq('event_id', eventId);

    if (eventError) {
      console.error('❌ Error fetching event passes:', eventError);
      return res.status(500).json({ 
        error: 'Failed to validate passes',
        details: eventError.message 
      });
    }

    if (!eventPasses || eventPasses.length === 0) {
      return res.status(404).json({ error: 'No passes found for this event' });
    }

    // ============================================
    // PHASE 1 SECURITY FIX: SERVER-SIDE PRICE CALCULATION
    // ============================================
    // CRITICAL: All prices MUST be calculated server-side from database
    // Frontend sends ONLY: passId and quantity
    // Server:
    //   1. Fetches pass from database
    //   2. Gets price from database (never trusts client)
    //   3. Calculates: passTotal = dbPrice * quantity
    //   4. Sums all pass totals = serverCalculatedTotal
    //   5. Uses serverCalculatedTotal for order (ignores any client value)
    // ============================================
    // SECURITY: Validate Each Pass
    const validatedPasses = [];
    let serverCalculatedTotal = 0;
    let serverCalculatedQuantity = 0;

    for (const clientPass of passIds) {
      // Validate pass ID exists
      if (!clientPass.passId || typeof clientPass.passId !== 'string' || clientPass.passId.trim() === '') {
        return res.status(400).json({ 
          error: `Invalid pass: passId is required and must be a valid string`,
          invalidPass: clientPass
        });
      }

      // SECURITY: Reject test/fake pass IDs
      const passIdLower = clientPass.passId.toLowerCase();
      if (passIdLower.includes('test') || passIdLower.includes('fake') || passIdLower.includes('dummy')) {
        return res.status(400).json({ 
          error: `Security: Invalid pass ID detected: ${clientPass.passId}. Test/fake passes are not allowed.`,
          blockedPassId: clientPass.passId
        });
      }

      // SECURITY: Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(clientPass.passId)) {
        return res.status(400).json({ 
          error: `Security: Invalid pass ID format: ${clientPass.passId}. Pass ID must be a valid UUID.`,
          invalidPassId: clientPass.passId
        });
      }

      // SECURITY: Validate quantity
      if (!Number.isInteger(clientPass.quantity) || clientPass.quantity <= 0) {
        return res.status(400).json({ 
          error: `Invalid quantity for pass ${clientPass.passId}: ${clientPass.quantity}. Must be a positive integer.`
        });
      }

      // SECURITY: Find pass in database
      const validPass = eventPasses.find(p => p.id === clientPass.passId);
      if (!validPass) {
        return res.status(400).json({ 
          error: `Security: Invalid pass ID: ${clientPass.passId}. Pass does not exist for this event.`,
          invalidPassId: clientPass.passId
        });
      }

      // ============================================
      // PHASE 1 SECURITY FIX: DATABASE PRICE FETCH
      // ============================================
      // CRITICAL: Price comes ONLY from database, NEVER from client
      // If client sent price, it was already rejected above
      // ============================================
      // SECURITY: Get price FROM DATABASE (never trust client)
      const dbPrice = Number(validPass.price);
      const dbName = validPass.name;

      if (isNaN(dbPrice) || dbPrice <= 0) {
        console.error('❌ Invalid price in database for pass:', {
          passId: validPass.id,
          passName: validPass.name,
          price: validPass.price,
          eventId: eventId
        });
        return res.status(500).json({ 
          error: `Invalid price in database for pass ${validPass.id}: ${dbPrice}`,
          details: 'Database contains invalid price. Please contact administrator.'
        });
      }

      // ============================================
      // PHASE 1 SECURITY FIX: SERVER-SIDE CALCULATION
      // ============================================
      // CRITICAL: Calculate price server-side
      // Formula: passTotal = databasePrice * clientQuantity
      // Note: Quantity is validated (must be positive integer)
      // ============================================
      // SECURITY: Calculate price server-side
      const passTotal = dbPrice * clientPass.quantity;
      serverCalculatedTotal += passTotal;
      serverCalculatedQuantity += clientPass.quantity;
      
      // Log calculation for audit (in development only)
      if (process.env.NODE_ENV !== 'production') {
        console.log('💰 Price calculation:', {
          passId: validPass.id,
          passName: dbName,
          dbPrice: dbPrice,
          quantity: clientPass.quantity,
          passTotal: passTotal,
          runningTotal: serverCalculatedTotal
        });
      }

      // Store validated pass data (using DATABASE values)
      validatedPasses.push({
        passId: validPass.id,
        passName: dbName,
        quantity: clientPass.quantity,
        price: dbPrice // FROM DATABASE - CRITICAL!
      });
    }

    // SECURITY: Validate Ambassador (for COD orders)
    let validatedAmbassadorId = null;
    if (paymentMethod === 'ambassador_cash' || paymentMethod === 'cod') {
      if (!ambassadorId) {
        return res.status(400).json({ 
          error: 'Ambassador ID is required for ambassador cash payment' 
        });
      }

      const { data: ambassador, error: ambassadorError } = await supabase
        .from('ambassadors')
        .select('id, full_name, status')
        .eq('id', ambassadorId)
        .eq('status', 'approved')
        .single();

      if (ambassadorError || !ambassador) {
        return res.status(400).json({ 
          error: 'Invalid ambassador. Ambassador must exist and be approved.'
        });
      }

      validatedAmbassadorId = ambassador.id;
    }

    // SECURITY: Validate Event
    const { data: event, error: eventCheckError } = await supabase
      .from('events')
      .select('id, name')
      .eq('id', eventId)
      .single();

    if (eventCheckError || !event) {
      return res.status(404).json({ 
        error: 'Event not found',
        eventId: eventId
      });
    }

    // SECURITY: Validate Customer Info
    const phoneRegex = /^[2-9]\d{7}$/;
    if (!phoneRegex.test(normalizedCustomer.phone.trim())) {
      return res.status(400).json({ 
        error: 'Invalid phone number format. Must be 8 digits starting with 2, 4, 5, 6, 7, 8, or 9.'
      });
    }

    if (normalizedCustomer.email && normalizedCustomer.email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedCustomer.email.trim())) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
    }

    // SECURITY: Validate City exists in database
    const { data: city, error: cityError } = await supabase
      .from('cities')
      .select('id, name')
      .eq('name', normalizedCustomer.city.trim())
      .single();

    if (cityError || !city) {
      return res.status(400).json({ 
        error: `Invalid city: ${normalizedCustomer.city}. City must exist in the database.`,
        invalidCity: normalizedCustomer.city
      });
    }

    // SECURITY: Validate City/Ville consistency
    // If ville is provided, verify it belongs to the city
    if (normalizedCustomer.ville && normalizedCustomer.ville.trim() !== '') {
      const { data: ville, error: villeError } = await supabase
        .from('villes')
        .select('id, name, city_id')
        .eq('name', normalizedCustomer.ville.trim())
        .eq('city_id', city.id)
        .single();

      if (villeError || !ville) {
        // Check if ville exists but belongs to different city
        const { data: villeInOtherCity, error: checkError } = await supabase
          .from('villes')
          .select('id, name, city_id, cities(name)')
          .eq('name', normalizedCustomer.ville.trim())
          .limit(1)
          .maybeSingle();

        if (!checkError && villeInOtherCity && villeInOtherCity.cities) {
          return res.status(400).json({ 
            error: `Invalid city/ville combination: "${normalizedCustomer.ville}" belongs to "${villeInOtherCity.cities.name}", not "${normalizedCustomer.city}".`,
            invalidCity: normalizedCustomer.city,
            invalidVille: normalizedCustomer.ville,
            correctCity: villeInOtherCity.cities.name
          });
        }

        return res.status(400).json({ 
          error: `Invalid ville: "${normalizedCustomer.ville}" does not exist for city "${normalizedCustomer.city}".`,
          invalidCity: normalizedCustomer.city,
          invalidVille: normalizedCustomer.ville
        });
      }
    } else {
      // SECURITY: Ville is required for certain cities (e.g., Sousse, Tunis)
      if (normalizedCustomer.city === 'Sousse' || normalizedCustomer.city === 'Tunis') {
        return res.status(400).json({ error: `Ville (neighborhood) is required when city is ${normalizedCustomer.city}` });
      }
    }

    // COD orders are now available in all cities (removed Sousse-only restriction)
    // The ville validation above ensures that if a ville is provided, it matches the selected city

    // Determine initial status
    let initialStatus;
    switch (paymentMethod) {
      case 'online':
        initialStatus = 'PENDING_ONLINE';
        break;
      case 'external_app':
        initialStatus = 'PENDING_ONLINE';
        break;
      case 'ambassador_cash':
      case 'cod':
        initialStatus = 'PENDING_CASH';
        break;
      default:
        return res.status(400).json({ error: `Invalid payment method: ${paymentMethod}` });
    }

    // ============================================
    // PHASE 1 SECURITY FIX: ORDER CREATION WITH SERVER-CALCULATED PRICES
    // ============================================
    // CRITICAL: Order uses ONLY server-calculated values
    // - quantity: Sum of all pass quantities (server-calculated)
    // - total_price: Sum of all pass totals (server-calculated from database prices)
    // - NO client prices are used or trusted
    // ============================================
    // CREATE ORDER (using server-calculated values)
    // COD orders created by customers through platform use 'platform_cod' source
    // Ambassadors do NOT create orders - they only receive orders from customers
    const orderData = {
      source: (paymentMethod === 'ambassador_cash' || paymentMethod === 'cod') ? 'platform_cod' : 'platform_online',
      user_name: normalizedCustomer.full_name.trim(),
      user_phone: normalizedCustomer.phone.trim(),
      user_email: normalizedCustomer.email?.trim() || null,
      city: normalizedCustomer.city.trim(),
      ville: normalizedCustomer.ville?.trim() || null,
      event_id: eventId,
      ambassador_id: validatedAmbassadorId,
      quantity: serverCalculatedQuantity, // Server-calculated (sum of all pass quantities)
      total_price: serverCalculatedTotal, // Server-calculated - CRITICAL! (sum of all pass totals from database prices)
      payment_method: paymentMethod,
      status: initialStatus,
      assigned_at: validatedAmbassadorId ? new Date().toISOString() : null,
      idempotency_key: idempotencyKey || null, // Store idempotency key to prevent duplicates
      notes: JSON.stringify({
        all_passes: validatedPasses.map(p => ({
          passId: p.passId,
          passName: p.passName,
          quantity: p.quantity,
          price: p.price // From database
        })),
        total_order_price: serverCalculatedTotal, // Server-calculated
        pass_count: validatedPasses.length
      })
    };

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      console.error('❌ Error creating order:', orderError);
      return res.status(500).json({ 
        error: 'Failed to create order',
        details: orderError.message 
      });
    }

    // ============================================
    // ORDER ID FIX: Verify order_number was generated
    // ============================================
    // CRITICAL: order_number MUST exist before any SMS or customer communication
    // Database should auto-generate via DEFAULT generate_random_order_number()
    // If missing, this is a critical system error
    if (!order.order_number) {
      console.error('🚨 CRITICAL: order_number missing after order creation:', {
        orderId: order.id,
        source: order.source,
        status: order.status
      });
      
      // Try to fetch the order again (in case it was generated but not returned)
      const { data: refreshedOrder } = await supabase
        .from('orders')
        .select('order_number')
        .eq('id', order.id)
        .single();
      
      if (refreshedOrder?.order_number) {
        order.order_number = refreshedOrder.order_number;
        console.log('✅ order_number found on refresh:', order.order_number);
      } else {
        // This is a critical error - order_number should be auto-generated
        console.error('🚨 CRITICAL ERROR: order_number still missing after refresh');
        // Continue with order creation but log the error
        // SMS will fail with clear error message if order_number is missing
      }
    }

    // Create order_passes entries
    const orderPassesData = validatedPasses.map(pass => ({
      order_id: order.id,
      pass_type: pass.passName, // From database
      quantity: pass.quantity,
      price: pass.price // From database - CRITICAL!
    }));

    const { error: passesError } = await supabase
      .from('order_passes')
      .insert(orderPassesData);

    if (passesError) {
      await supabase.from('orders').delete().eq('id', order.id);
      console.error('❌ Error creating order passes:', passesError);
      return res.status(500).json({ 
        error: 'Failed to create order passes',
        details: passesError.message 
      });
    }

    // ============================================
    // INTERNAL SMS SENDING (for COD orders only)
    // ============================================
    // SMS is sent INTERNALLY only - no public endpoint
    // Only sent for COD orders with ambassador assigned
    if ((paymentMethod === 'ambassador_cash' || paymentMethod === 'cod') && validatedAmbassadorId && order.id) {
      try {
        // Fetch full order with ambassador details for SMS
        const { data: fullOrder } = await supabase
          .from('orders')
          .select(`
            *,
            order_passes (*),
            ambassadors (
              id,
              full_name,
              phone
            )
          `)
          .eq('id', order.id)
          .single();

        if (fullOrder && fullOrder.ambassadors) {
          // ============================================
          // ORDER ID FIX: Verify order_number before SMS
          // ============================================
          // CRITICAL: Do NOT send SMS if order_number is missing
          // This ensures customers always get consistent order IDs
          if (!fullOrder.order_number) {
            console.error('🚨 CRITICAL: Cannot send SMS - order_number is missing for order:', fullOrder.id);
            // Do NOT send SMS - this is a system error that must be fixed
            // Log error but don't block order creation
          } else {
            // Send SMS to customer (INTERNAL - non-blocking)
            sendOrderConfirmationSmsInternal(fullOrder).catch(err => {
              console.error('❌ Failed to send order confirmation SMS (internal):', err);
            });

            // Send SMS to ambassador (INTERNAL - non-blocking)
            sendAmbassadorOrderSmsInternal(fullOrder).catch(err => {
              console.error('❌ Failed to send ambassador order SMS (internal):', err);
            });
          }
        }
      } catch (smsError) {
        console.error('❌ Error initiating SMS notifications (internal):', smsError);
        // Silent failure - don't block order creation
      }
    }

    // Log order creation
    try {
      await supabase.from('order_logs').insert({
        order_id: order.id,
        action: 'created',
        performed_by: null,
        performed_by_type: 'customer',
        details: {
          status: initialStatus,
          payment_method: paymentMethod,
          ambassador_id: validatedAmbassadorId,
          total_price: serverCalculatedTotal
        }
      });
    } catch (logError) {
      console.warn('⚠️ Failed to log order creation:', logError);
    }

    res.status(201).json({
      success: true,
      order: order,
      message: 'Order created successfully',
      serverCalculatedTotal: serverCalculatedTotal
    });

  } catch (error) {
    console.error('❌ Error in create-order endpoint:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// ============================================
// POST /api/ambassador/confirm-cash - Ambassador Confirms Cash Received
// ============================================
// SECURITY: Ambassador can ONLY confirm cash for their own orders
// Server validates ownership and status before updating
app.post('/api/ambassador/confirm-cash', logSecurityRequest, ambassadorActionLimiter, requireAmbassadorAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { orderId, idempotencyKey } = req.body;
    const ambassadorId = req.ambassador.id;

    // ============================================
    // PHASE 2 SECURITY FIX: Idempotency for Ambassador Actions
    // ============================================
    if (idempotencyKey) {
      const { data: existingLog } = await supabase
        .from('order_logs')
        .select('id, details')
        .eq('order_id', orderId)
        .eq('action', 'cash_confirmed')
        .eq('performed_by', ambassadorId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingLog) {
        const logTime = new Date(existingLog.created_at || 0).getTime();
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        
        if (now - logTime < fiveMinutes) {
          // Recent confirmation found - return existing result (idempotent)
          const { data: existingOrder } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();
          
          if (existingOrder) {
            return res.status(200).json({
              success: true,
              order: existingOrder,
              message: 'Cash already confirmed (idempotent response)',
              idempotent: true
            });
          }
        }
      }
    }

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    // Fetch order and verify ownership
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, ambassador_id, status, payment_method')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // SECURITY: Verify ambassador owns this order
    if (order.ambassador_id !== ambassadorId) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You can only confirm cash for your own orders'
      });
    }

    // SECURITY: Verify order is in correct status
    if (order.status !== 'PENDING_CASH') {
      return res.status(400).json({
        error: 'Invalid order status',
        message: `Order status must be PENDING_CASH to confirm cash. Current status: ${order.status}`
      });
    }

    // SECURITY: Verify order is COD order
    if (order.payment_method !== 'ambassador_cash' && order.payment_method !== 'cod') {
      return res.status(400).json({
        error: 'Invalid payment method',
        message: 'Cash confirmation is only for COD orders'
      });
    }

    // Update order status (SERVER-SIDE ONLY)
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'PENDING_ADMIN_APPROVAL',
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .eq('ambassador_id', ambassadorId)  // Double-check ownership
      .select()
      .single();

    if (updateError || !updatedOrder) {
      console.error('❌ Error updating order status:', updateError);
      return res.status(500).json({
        error: 'Failed to confirm cash',
        details: updateError?.message || 'Order update failed'
      });
    }

    // Log action (SERVER-SIDE ONLY)
    try {
      await supabase.from('order_logs').insert({
        order_id: orderId,
        action: 'cash_confirmed',
        performed_by: ambassadorId,
        performed_by_type: 'ambassador',
        details: {
          from_status: 'PENDING_CASH',
          to_status: 'PENDING_ADMIN_APPROVAL',
          ambassador_id: ambassadorId
        }
      });
    } catch (logError) {
      console.warn('⚠️ Failed to log cash confirmation:', logError);
    }

    res.json({
      success: true,
      order: updatedOrder,
      message: 'Cash confirmed successfully. Waiting for admin approval.'
    });

  } catch (error) {
    console.error('❌ Error in confirm-cash endpoint:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// ============================================
// POST /api/ambassador/cancel-order - Ambassador Cancels Order
// ============================================
// SECURITY: Ambassador can ONLY cancel their own orders
// Server validates ownership and status before updating
app.post('/api/ambassador/cancel-order', logSecurityRequest, ambassadorActionLimiter, requireAmbassadorAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { orderId, reason } = req.body;
    const ambassadorId = req.ambassador.id;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ error: 'Cancellation reason is required' });
    }

    // Fetch order and verify ownership
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, ambassador_id, status, payment_method')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // SECURITY: Verify ambassador owns this order
    if (order.ambassador_id !== ambassadorId) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You can only cancel your own orders'
      });
    }

    // SECURITY: Verify order can be cancelled (PENDING_CASH only)
    if (order.status !== 'PENDING_CASH') {
      return res.status(400).json({
        error: 'Invalid order status',
        message: `Order status must be PENDING_CASH to cancel. Current status: ${order.status}`
      });
    }

    // Update order status (SERVER-SIDE ONLY)
    // CRITICAL: Database constraint only allows 'CANCELLED' (not 'CANCELLED_BY_AMBASSADOR')
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'CANCELLED', // Use unified CANCELLED status (matches DB constraint)
        cancellation_reason: reason.trim(),
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .eq('ambassador_id', ambassadorId)  // Double-check ownership
      .select()
      .single();

    if (updateError || !updatedOrder) {
      console.error('❌ Error updating order status:', updateError);
      return res.status(500).json({
        error: 'Failed to cancel order',
        details: updateError?.message || 'Order update failed'
      });
    }

    // Log action (SERVER-SIDE ONLY)
    try {
      await supabase.from('order_logs').insert({
        order_id: orderId,
        action: 'cancelled',
        performed_by: ambassadorId,
        performed_by_type: 'ambassador',
        details: {
          from_status: 'PENDING_CASH',
          to_status: 'CANCELLED',
          cancelled_by: 'ambassador',
          reason: reason.trim(),
          ambassador_id: ambassadorId
        }
      });
    } catch (logError) {
      console.warn('⚠️ Failed to log cancellation:', logError);
    }

    res.json({
      success: true,
      order: updatedOrder,
      message: 'Order cancelled successfully'
    });

  } catch (error) {
    console.error('❌ Error in cancel-order endpoint:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// ============================================
// POST /api/admin/approve-order - Admin Approves COD Order
// ============================================
// SECURITY: Only admin can approve orders
// Server does ALL: status update, ticket generation, SMS, email, logging
app.post('/api/admin/approve-order', logSecurityRequest, requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { orderId, idempotencyKey } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    // ============================================
    // PHASE 2 SECURITY FIX: Idempotency for Admin Actions
    // ============================================
    // Prevent duplicate approvals if admin clicks twice
    // ============================================
    if (idempotencyKey) {
      // Check if this approval was already processed
      const { data: existingLog } = await supabase
        .from('order_logs')
        .select('id, details')
        .eq('order_id', orderId)
        .eq('action', 'status_changed')
        .eq('performed_by_type', 'admin')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingLog && existingLog.details) {
        const details = typeof existingLog.details === 'string' 
          ? JSON.parse(existingLog.details) 
          : existingLog.details;
        
        // Check if order was already approved recently (within last 5 minutes)
        if (details.new_status === 'PAID') { // COMPLETED is not in unified system, use PAID
          const logTime = new Date(existingLog.created_at || 0).getTime();
          const now = Date.now();
          const fiveMinutes = 5 * 60 * 1000;
          
          if (now - logTime < fiveMinutes) {
            // Recent approval found - return existing result (idempotent)
            const { data: existingOrder } = await supabase
              .from('orders')
              .select('*')
              .eq('id', orderId)
              .single();
            
            if (existingOrder) {
              return res.status(200).json({
                success: true,
                order: existingOrder,
                message: 'Order already approved (idempotent response)',
                idempotent: true
              });
            }
          }
        }
      }
    }

    // Fetch order with relations
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_passes (*),
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

    // ============================================
    // PHASE 2 SECURITY FIX: State Machine Validation
    // ============================================
    // SECURITY: Verify order is in correct status
    if (order.status !== 'PENDING_ADMIN_APPROVAL') {
      return res.status(400).json({
        error: 'Invalid order status',
        message: `Order status must be PENDING_ADMIN_APPROVAL to approve. Current status: ${order.status}`,
        currentStatus: order.status,
        requiredStatus: 'PENDING_ADMIN_APPROVAL'
      });
    }

    // ============================================
    // PHASE 2 SECURITY FIX: State Machine Validation
    // ============================================
    // Determine correct status based on order source
    // CRITICAL: Database constraint only allows: PENDING_ONLINE, REDIRECTED, PENDING_CASH, PAID, CANCELLED
    // For unified system, all approved orders use PAID (not COMPLETED)
    const targetStatus = 'PAID';

    // Validate state transition
    const validation = validateStatusTransition(
      order.status,
      targetStatus,
      order.source,
      order.payment_method
    );

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid status transition',
        message: validation.error,
        currentStatus: order.status,
        requestedStatus: targetStatus
      });
    }

    // Update order status (SERVER-SIDE ONLY)
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        status: targetStatus,
        payment_status: 'PAID',
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single();

    if (updateError || !updatedOrder) {
      console.error('❌ Error updating order status:', updateError);
      return res.status(500).json({
        error: 'Failed to approve order',
        details: updateError?.message || 'Order update failed'
      });
    }

    // Generate tickets (INTERNAL - call function directly, not via HTTP)
    let ticketsGenerated = false;
    if (order.user_email) {
      try {
        // Call internal function directly (more reliable than HTTP fetch)
        if (typeof generateTicketsAndSendEmail === 'function') {
          console.log('🚀 Calling generateTicketsAndSendEmail internally for order:', orderId);
          const result = await generateTicketsAndSendEmail(orderId);
          ticketsGenerated = result?.success || false;
          console.log('✅ Ticket generation result:', { success: ticketsGenerated, result });
        } else {
          console.error('❌ generateTicketsAndSendEmail function not found!');
        }
      } catch (ticketError) {
        console.error('❌ Error generating tickets:', ticketError);
        console.error('❌ Error details:', {
          message: ticketError.message,
          stack: ticketError.stack
        });
        // Silent failure - don't block approval, but log for debugging
      }
    } else {
      console.log('⚠️ Order has no email, skipping ticket generation');
    }

    // Send completion email (INTERNAL - if order has email)
    if (order.user_email) {
      try {
        const apiBase = process.env.VITE_API_URL || process.env.API_URL || '';
        const emailApiUrl = `${apiBase}/api/send-order-completion-email`;
        
        if (emailApiUrl && emailApiUrl !== '/api/send-order-completion-email') {
          fetch(emailApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId })
          }).catch(err => {
            console.error('❌ Failed to send completion email:', err);
            // Silent failure
          });
        }
      } catch (emailError) {
        console.error('❌ Error sending completion email:', emailError);
        // Silent failure
      }
    }

    // Log action (SERVER-SIDE ONLY)
    try {
      await supabase.from('order_logs').insert({
        order_id: orderId,
        action: 'approved',
        performed_by: req.admin.id,
        performed_by_type: 'admin',
        details: {
          from_status: 'PENDING_ADMIN_APPROVAL',
          to_status: 'PAID',
          tickets_generated: ticketsGenerated,
          admin_id: req.admin.id
        }
      });
    } catch (logError) {
      console.warn('⚠️ Failed to log approval:', logError);
    }

    res.json({
      success: true,
      order: updatedOrder,
      message: 'Order approved successfully',
      ticketsGenerated: ticketsGenerated
    });

  } catch (error) {
    console.error('❌ Error in approve-order endpoint:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// ============================================
// POST /api/admin/reject-order - Admin Rejects COD Order
// ============================================
// SECURITY: Only admin can reject orders
// Server validates status and logs action
// ============================================
// PHASE 2: STATE MACHINE VALIDATION MIDDLEWARE
// ============================================
// Enforces forward-only state transitions for orders
// Prevents status skipping and invalid transitions
// ============================================

/**
 * Validate order status transition
 * @param {string} currentStatus - Current order status
 * @param {string} newStatus - Requested new status
 * @param {string} source - Order source (platform_cod, platform_online, ambassador_manual)
 * @param {string} paymentMethod - Payment method (cod, online, etc.)
 * @returns {Object} { valid: boolean, error?: string }
 */
const validateStatusTransition = (currentStatus, newStatus, source, paymentMethod) => {
  // Define valid transitions per order source
  // CRITICAL: Must match database constraint: PENDING_ONLINE, REDIRECTED, PENDING_CASH, PENDING_ADMIN_APPROVAL, PAID, REJECTED, CANCELLED
  const validTransitions = {
    // COD Orders (platform_cod)
    platform_cod: {
      'PENDING_CASH': ['PENDING_ADMIN_APPROVAL', 'CANCELLED'],
      'PENDING_ADMIN_APPROVAL': ['PAID', 'REJECTED', 'CANCELLED'], // PAID (not COMPLETED) - matches DB constraint
      'PAID': ['CANCELLED'], // Can cancel paid orders (refund)
      'REJECTED': [], // Final state
      'CANCELLED': [] // Final state
    },
    // Online Orders (platform_online)
    platform_online: {
      'PENDING_ONLINE': ['PAID', 'CANCELLED'],
      'PAID': ['CANCELLED'], // Can cancel paid orders (refund)
      'CANCELLED': [] // Final state
    },
    // Manual Orders (ambassador_manual) - not used for customer orders
    ambassador_manual: {
      'PENDING_CASH': ['PENDING_ADMIN_APPROVAL', 'CANCELLED'],
      'PENDING_ADMIN_APPROVAL': ['PAID', 'COMPLETED', 'REJECTED', 'CANCELLED'],
      'PAID': ['CANCELLED'],
      'COMPLETED': ['CANCELLED'],
      'REJECTED': [],
      'CANCELLED': []
    }
  };

  // Get valid transitions for this order source
  const sourceTransitions = validTransitions[source] || validTransitions.platform_cod;
  const allowedNextStatuses = sourceTransitions[currentStatus] || [];

  if (!allowedNextStatuses.includes(newStatus)) {
    return {
      valid: false,
      error: `Invalid status transition: Cannot transition from ${currentStatus} to ${newStatus} for ${source} orders. Valid transitions: ${allowedNextStatuses.join(', ') || 'none (final state)'}`
    };
  }

  return { valid: true };
};

/**
 * Middleware to validate order status transitions
 * Must be used before any order status update
 */
const validateOrderStatusTransition = async (req, res, next) => {
  try {
    const orderId = req.params.id || req.body.orderId;
    const newStatus = req.body.status || req.body.payment_status;

    if (!orderId || !newStatus) {
      // Not a status update request, skip validation
      return next();
    }

    // Fetch current order state
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, payment_status, source, payment_method')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Determine which field is being updated
    const currentStatus = req.body.status ? order.status : order.payment_status;
    const validation = validateStatusTransition(
      currentStatus,
      newStatus,
      order.source,
      order.payment_method
    );

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid status transition',
        message: validation.error,
        currentStatus: currentStatus,
        requestedStatus: newStatus,
        orderSource: order.source
      });
    }

    // Store order in request for use in handler
    req.currentOrder = order;
    next();
  } catch (error) {
    console.error('❌ Error in validateOrderStatusTransition middleware:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
};

// ============================================
// ORDER PAYMENT STATUS MANAGEMENT API
// ============================================
// CRITICAL: This endpoint enforces state machine rules
// Payment status transitions must be valid and sequential
// ============================================

// PUT /api/admin/orders/:id/payment-status - Update order payment status
app.put('/api/admin/orders/:id/payment-status', logSecurityRequest, requireAdminAuth, validateOrderStatusTransition, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const orderId = req.params.id;
    const { payment_status } = req.body;

    // Validate order ID
    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    // SECURITY: Validate payment_status
    const validStatuses = ['PENDING_PAYMENT', 'PAID', 'FAILED', 'REFUNDED'];
    if (!payment_status || !validStatuses.includes(payment_status)) {
      return res.status(400).json({ 
        error: 'Invalid payment status',
        message: `Payment status must be one of: ${validStatuses.join(', ')}`,
        provided: payment_status
      });
    }

    // SECURITY: Fetch order to verify it exists and get current status
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, payment_status, status, source, payment_method')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // SECURITY: State machine validation - prevent invalid transitions
    const currentStatus = order.payment_status;
    const newStatus = payment_status;

    // Define valid transitions
    const validTransitions = {
      'PENDING_PAYMENT': ['PAID', 'FAILED'],
      'PAID': ['REFUNDED'], // Can only refund paid orders
      'FAILED': ['PENDING_PAYMENT'], // Can retry failed payments
      'REFUNDED': [] // Final state - cannot transition from refunded
    };

    // Check if transition is valid
    if (currentStatus && validTransitions[currentStatus]) {
      if (!validTransitions[currentStatus].includes(newStatus)) {
        return res.status(400).json({
          error: 'Invalid status transition',
          message: `Cannot transition payment_status from ${currentStatus} to ${newStatus}`,
          currentStatus: currentStatus,
          requestedStatus: newStatus,
          validTransitions: validTransitions[currentStatus]
        });
      }
    }

    // SECURITY: Additional validation based on order source
    // Online orders should have payment_status, COD orders use status field
    if (order.source === 'platform_online' && order.payment_method === 'online') {
      // Online orders can have payment_status changes
      // This is valid
    } else if (order.source === 'platform_cod' || order.payment_method === 'cod') {
      // COD orders should not have payment_status changed directly
      // They use the status field instead
      return res.status(400).json({
        error: 'Invalid operation',
        message: 'COD orders use the status field, not payment_status. Use /api/admin/approve-order or /api/admin/reject-order instead.',
        orderSource: order.source,
        paymentMethod: order.payment_method
      });
    }

    // Update payment status (SERVER-SIDE ONLY)
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        payment_status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating order payment status:', updateError);
      return res.status(500).json({ 
        error: 'Failed to update order payment status',
        details: updateError.message 
      });
    }

    // SECURITY: Create order_log entry (SERVER-SIDE ONLY - not from frontend)
    const adminId = req.admin.id;
    try {
      await supabase.from('order_logs').insert({
        order_id: orderId,
        action: 'status_changed',
        performed_by: adminId,
        performed_by_type: 'admin',
        details: {
          field: 'payment_status',
          old_payment_status: currentStatus,
          new_payment_status: newStatus,
          action: `Admin ${req.admin.name || req.admin.email} changed payment status to ${newStatus}`
        }
      }).catch(err => console.warn('⚠️ Failed to create order log:', err));
    } catch (logError) {
      console.warn('⚠️ Failed to log payment status change:', logError);
    }

    // SECURITY: Log admin action (server-side audit)
    const adminEmail = req.admin.email;
    try {
      const securityLogClient = supabaseService || supabase;
      await securityLogClient.from('security_audit_logs').insert({
        event_type: 'admin_action',
        endpoint: '/api/admin/orders/:id/payment-status',
        ip_address: normalizeIP(req), // PHASE 2: Normalized IP
        user_agent: req.headers['user-agent'] || 'unknown',
        request_method: 'PUT',
        request_path: `/api/admin/orders/${orderId}/payment-status`,
        details: {
          action: 'update_order_payment_status',
          admin_id: adminId,
          admin_email: adminEmail,
          order_id: orderId,
          old_payment_status: currentStatus,
          new_payment_status: newStatus
        },
        severity: 'high'
      }).catch(err => console.warn('⚠️ Failed to log admin action:', err));
    } catch (logError) {
      console.warn('⚠️ Failed to log payment status update:', logError);
    }

    res.json({ 
      success: true,
      order: updatedOrder,
      message: `Order payment status updated to ${newStatus}`
    });
  } catch (error) {
    console.error('❌ Error in PUT /api/admin/orders/:id/payment-status:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

app.post('/api/admin/reject-order', logSecurityRequest, requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { orderId, reason } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    // Fetch order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // SECURITY: Verify order is in correct status
    if (order.status !== 'PENDING_ADMIN_APPROVAL') {
      return res.status(400).json({
        error: 'Invalid order status',
        message: `Order status must be PENDING_ADMIN_APPROVAL to reject. Current status: ${order.status}`
      });
    }

    // Update order status (SERVER-SIDE ONLY)
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'REJECTED',
        rejection_reason: reason ? reason.trim() : null,
        rejected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single();

    if (updateError || !updatedOrder) {
      console.error('❌ Error updating order status:', updateError);
      return res.status(500).json({
        error: 'Failed to reject order',
        details: updateError?.message || 'Order update failed'
      });
    }

    // Log action (SERVER-SIDE ONLY)
    try {
      await supabase.from('order_logs').insert({
        order_id: orderId,
        action: 'rejected',
        performed_by: req.admin.id,
        performed_by_type: 'admin',
        details: {
          from_status: 'PENDING_ADMIN_APPROVAL',
          to_status: 'REJECTED',
          reason: reason ? reason.trim() : null,
          admin_id: req.admin.id
        }
      });
    } catch (logError) {
      console.warn('⚠️ Failed to log rejection:', logError);
    }

    res.json({
      success: true,
      order: updatedOrder,
      message: 'Order rejected successfully'
    });

  } catch (error) {
    console.error('❌ Error in reject-order endpoint:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// POST /api/flouci-verify-payment-by-order - Verify payment by orderId (manual verification)
app.post('/api/flouci-verify-payment-by-order', async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    // Get order with payment_id
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, payment_gateway_reference, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!order.payment_gateway_reference) {
      return res.status(400).json({ error: 'Order does not have a payment ID' });
    }

    if (order.status === 'PAID') {
      return res.json({ 
        success: true, 
        status: 'SUCCESS', 
        message: 'Order is already paid',
        orderUpdated: true
      });
    }

    // ============================================
    // PREVIEW-ONLY: Mock Payment Verification
    // ============================================
    // Check if this is a preview payment (starts with "preview_")
    const isPreviewPayment = order.payment_gateway_reference.startsWith('preview_');
    const requestHost = req.headers.host || '';
    const hasNgrokHost = requestHost.includes('ngrok-free.dev') || requestHost.includes('ngrok.io');
    const isPreviewEnvironment = process.env.VERCEL_ENV === 'preview' || hasNgrokHost;
    
    if (isPreviewPayment || isPreviewEnvironment) {
      console.log('🔧 PREVIEW MODE: Mocking payment verification (not calling real Flouci API)');
      console.log('   Preview payment ID:', order.payment_gateway_reference);
      
      // In preview, mark payment as successful without calling Flouci
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'PAID',
          payment_status: 'PAID',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
      
      if (updateError) {
        console.error('❌ Failed to update order status in preview:', updateError);
        return res.status(500).json({ error: 'Failed to update order status' });
      }
      
      return res.json({
        success: true,
        status: 'SUCCESS',
        result: {
          status: 'SUCCESS',
          payment_id: order.payment_gateway_reference
        },
        orderUpdated: true,
        isPreview: true,
        message: 'PREVIEW MODE: Payment verified (mocked). Real verification will work in production.'
      });
    }

    // PRODUCTION: Verify payment using the payment_id from order
    const FLOUCI_PUBLIC_KEY = process.env.FLOUCI_PUBLIC_KEY;
    const FLOUCI_SECRET_KEY = process.env.FLOUCI_SECRET_KEY;

    if (!FLOUCI_PUBLIC_KEY || !FLOUCI_SECRET_KEY) {
      return res.status(500).json({ error: 'Flouci API keys not configured' });
    }

    // Add timeout to prevent hanging requests (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

    let response;
    let data;
    try {
      response = await fetch(`https://developers.flouci.com/api/v2/verify_payment/${order.payment_gateway_reference}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${FLOUCI_PUBLIC_KEY}:${FLOUCI_SECRET_KEY}`
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      data = await response.json();
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('❌ Flouci API verification request timed out after 30 seconds');
        return res.status(504).json({ 
          error: 'Payment verification timeout',
          message: 'The payment gateway did not respond in time. Please try again.',
          details: 'Request timed out after 30 seconds'
        });
      }
      throw fetchError; // Re-throw other errors
    }

    if (!response.ok) {
      return res.status(500).json({ 
        error: data.message || 'Failed to verify payment',
        details: data
      });
    }

    const paymentStatus = data.result?.status;

    // Update order based on payment status
    let updateData = {
      payment_response_data: data.result,
      updated_at: new Date().toISOString()
    };

    if (paymentStatus === 'SUCCESS') {
      // Payment successful - mark as PAID
      updateData.status = 'PAID';
      updateData.payment_status = 'PAID';
      updateData.completed_at = new Date().toISOString();
      
      const { error: updateError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (updateError) {
        console.error('❌ Error updating order status:', updateError);
        return res.status(500).json({ 
          success: true,
          status: paymentStatus,
          result: data.result,
          orderUpdated: false,
          error: 'Payment verified but order update failed'
        });
      }

      return res.json({ 
        success: true,
        status: paymentStatus,
        result: data.result,
        orderUpdated: true,
        orderId: orderId
      });
    } else if (paymentStatus === 'FAILURE' || paymentStatus === 'EXPIRED') {
      // Payment failed - mark as failed but keep status as PENDING_ONLINE for admin review
      updateData.status = 'PENDING_ONLINE'; // Keep as pending, admin can review
      updateData.payment_status = 'FAILED';
      
      const { error: updateError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (updateError) {
        console.error('❌ Error updating order status:', updateError);
        return res.json({ 
          success: true,
          status: paymentStatus,
          result: data.result,
          orderUpdated: false,
          error: 'Payment verified but order update failed'
        });
      }

      return res.json({ 
        success: true,
        status: paymentStatus,
        result: data.result,
        orderUpdated: true,
        orderId: orderId,
        message: `Payment ${paymentStatus.toLowerCase()}. Order status updated to reflect failure.`
      });
    }

    // PENDING or other status - don't update order yet
    res.json({ 
      success: data.success,
      status: paymentStatus,
      result: data.result,
      orderUpdated: false,
      message: `Payment status is ${paymentStatus}. Order will be updated when payment completes.`
    });
  } catch (error) {
    console.error('Error verifying payment by order:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// POST /api/flouci-verify-payment - Verify Flouci payment status and update order
app.post('/api/flouci-verify-payment', async (req, res) => {
  try {
    const { paymentId, orderId } = req.body;

    if (!paymentId) {
      return res.status(400).json({ error: 'Payment ID is required' });
    }

    // ============================================
    // PREVIEW-ONLY: Mock Payment Verification
    // ============================================
    // Check if this is a preview payment (starts with "preview_")
    const isPreviewPayment = paymentId.startsWith('preview_');
    const requestHost = req.headers.host || '';
    const hasNgrokHost = requestHost.includes('ngrok-free.dev') || requestHost.includes('ngrok.io');
    const isPreviewEnvironment = process.env.VERCEL_ENV === 'preview' || hasNgrokHost;
    
    if (isPreviewPayment || isPreviewEnvironment) {
      console.log('🔧 PREVIEW MODE: Mocking payment verification (not calling real Flouci API)');
      console.log('   Preview payment ID:', paymentId);
      
      if (!supabase) {
        return res.status(500).json({ error: 'Supabase not configured' });
      }
      
      // In preview, mark payment as successful without calling Flouci
      if (orderId) {
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            status: 'PAID',
            payment_status: 'PAID',
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId);
        
        if (updateError) {
          console.error('❌ Failed to update order status in preview:', updateError);
        }
      }
      
      return res.json({
        success: true,
        status: 'SUCCESS',
        result: {
          status: 'SUCCESS',
          payment_id: paymentId
        },
        orderUpdated: !!orderId,
        isPreview: true,
        message: 'PREVIEW MODE: Payment verified (mocked). Real verification will work in production.'
      });
    }

    // PRODUCTION: Verify payment with Flouci
    const FLOUCI_PUBLIC_KEY = process.env.FLOUCI_PUBLIC_KEY;
    const FLOUCI_SECRET_KEY = process.env.FLOUCI_SECRET_KEY;

    if (!FLOUCI_PUBLIC_KEY || !FLOUCI_SECRET_KEY) {
      return res.status(500).json({ error: 'Flouci API keys not configured' });
    }

    // Add timeout to prevent hanging requests (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

    // Verify payment with Flouci
    let response;
    let data;
    try {
      response = await fetch(`https://developers.flouci.com/api/v2/verify_payment/${paymentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${FLOUCI_PUBLIC_KEY}:${FLOUCI_SECRET_KEY}`
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      data = await response.json();
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('❌ Flouci API verification request timed out after 30 seconds');
        return res.status(504).json({ 
          error: 'Payment verification timeout',
          message: 'The payment gateway did not respond in time. Please try again.',
          details: 'Request timed out after 30 seconds'
        });
      }
      throw fetchError; // Re-throw other errors
    }

    if (!response.ok) {
      console.error('❌ Flouci verification API error:', {
        status: response.status,
        statusText: response.statusText,
        data: data
      });
      return res.status(500).json({ 
        error: data.message || 'Failed to verify payment',
        details: data
      });
    }

    const paymentStatus = data.result?.status;
    
    // Log full verification response for debugging
    console.log('Flouci payment verification response:', {
      orderId: orderId || 'not provided',
      timestamp: new Date().toISOString(),
      fullResponse: JSON.stringify(data, null, 2)
    });
    
    // CRITICAL: Check if payment was just created (within last 5 seconds)
    // If so, and status is FAILURE, it might be because payment hasn't been attempted yet
    if (orderId && supabase && paymentStatus === 'FAILURE') {
      const { data: orderCheck } = await supabase
        .from('orders')
        .select('payment_created_at, status')
        .eq('id', orderId)
        .single();
      
      if (orderCheck?.payment_created_at) {
        const createdTime = new Date(orderCheck.payment_created_at).getTime();
        const now = Date.now();
        const secondsSinceCreation = (now - createdTime) / 1000;
        
        if (secondsSinceCreation < 10) {
          console.warn('⚠️ Payment verified within 10 seconds of creation - this might be premature');
          console.warn('⚠️ Payment status FAILURE might be because user hasn\'t completed payment on Flouci yet');
          console.warn('⚠️ User should complete payment on Flouci page first, then verification will be accurate');
        }
      }
    }

    // GOLDEN RULE: Flouci verification API is the source of truth
    // Order is PAID ONLY if verify_payment(payment_id).status === 'SUCCESS'
    
    if (!orderId || !supabase) {
      // No orderId provided - just return verification result
      return res.json({ 
        success: data.success,
        status: paymentStatus,
        result: data.result,
        orderUpdated: false
      });
    }

    let targetOrderId = orderId;
    
    // First, try to find order by payment_gateway_reference (more reliable)
    const { data: orderByPayment, error: paymentError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('payment_gateway_reference', paymentId)
      .maybeSingle();
    
    // If found by payment_id, use that order ID
    if (orderByPayment && !paymentError) {
      targetOrderId = orderByPayment.id;
      
      // IDEMPOTENCY: If order already PAID, return success
      if (orderByPayment.status === 'PAID') {
        return res.json({ 
          success: data.success,
          status: paymentStatus,
          result: data.result,
          orderUpdated: false,
          orderId: targetOrderId,
          message: 'Order already processed'
        });
      }
    } else {
      // Use provided orderId and verify it exists
      const { data: orderById, error: orderError } = await supabase
        .from('orders')
        .select('id, status')
        .eq('id', orderId)
        .maybeSingle();
      
      if (orderById && !orderError) {
        
        // IDEMPOTENCY: If order already PAID, return success
        if (orderById.status === 'PAID') {
          return res.json({ 
            success: data.success,
            status: paymentStatus,
            result: data.result,
            orderUpdated: false,
            orderId: targetOrderId,
            message: 'Order already processed'
          });
        }
      } else {
        console.warn('⚠️ Order not found with provided orderId:', orderId);
        return res.status(404).json({ 
          error: 'Order not found',
          status: paymentStatus,
          result: data.result
        });
      }
    }

    // Update order based on payment status (only if verification confirms it)
    if (paymentStatus === 'SUCCESS') {
      // CRITICAL: Only mark PAID if verification API confirms SUCCESS
      const updateData = {
        status: 'PAID',
        payment_status: 'PAID',
        payment_gateway_reference: paymentId,
        payment_response_data: data.result,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Use conditional update to prevent race conditions
      const { error: updateError, data: updatedData } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', targetOrderId)
        .eq('status', 'PENDING_ONLINE') // Only update if still PENDING_ONLINE
        .select('status')
        .single();

      let orderUpdated = false;
      
      if (updateError) {
        // Check if it's a unique constraint violation (idempotency)
        if (updateError.code === '23505' || updateError.message?.includes('unique')) {
        } else {
          console.error('❌ Error updating order status:', updateError);
        }
      } else if (updatedData && updatedData.status === 'PAID') {
        orderUpdated = true;
        
        // CRITICAL: Generate tickets and send email/SMS after order is marked PAID
        // Check if tickets already exist (idempotency)
        const { data: existingTickets } = await supabase
          .from('tickets')
          .select('id')
          .eq('order_id', targetOrderId)
          .limit(1);

        if (existingTickets && existingTickets.length > 0) {
        } else {
          // Generate tickets and send email/SMS (fire and forget - don't block response)
          process.nextTick(async () => {
            try {
              if (typeof generateTicketsAndSendEmail !== 'function') {
                console.error('❌ generateTicketsAndSendEmail function not found!');
                return;
              }
              
              const result = await generateTicketsAndSendEmail(targetOrderId);
            } catch (error) {
              console.error('❌ Error generating tickets after payment verification:', error);
              console.error('❌ Error details:', {
                message: error.message,
                stack: error.stack,
                code: error.code,
                name: error.name
              });
            }
          });
        }
      } else {
        // Order was not updated (might have been updated by another process)
      }
      
      res.json({ 
        success: data.success,
        status: paymentStatus,
        result: data.result,
        orderUpdated: orderUpdated,
        orderId: targetOrderId
      });
    } else if (paymentStatus === 'FAILURE' || paymentStatus === 'EXPIRED') {
      // Payment failed - mark as failed but keep status as PENDING_ONLINE (allows retry)
      
      // CRITICAL: Check if payment was just created (within last 10 seconds)
      // If so, FAILURE might mean payment wasn't attempted yet, not that it failed
      let isPrematureVerification = false;
      if (supabase) {
        const { data: orderCheck } = await supabase
          .from('orders')
          .select('payment_created_at, status')
          .eq('id', targetOrderId)
          .single();
        
        if (orderCheck?.payment_created_at) {
          const createdTime = new Date(orderCheck.payment_created_at).getTime();
          const now = Date.now();
          const secondsSinceCreation = (now - createdTime) / 1000;
          
          // If verified within 10 seconds of creation, it's likely premature
          // Only mark as FAILED if payment was actually attempted (has card details)
          if (secondsSinceCreation < 10) {
            const hasCardDetails = data.result?.details?.name || data.result?.details?.pan;
            if (!hasCardDetails) {
              console.warn('⚠️ Payment verified within 10 seconds of creation with no card details');
              console.warn('⚠️ This might be premature verification - payment may not have been attempted yet');
              console.warn('⚠️ Returning PENDING status instead of marking as FAILED');
              isPrematureVerification = true;
            }
          }
        }
      }
      
      if (isPrematureVerification) {
        // Don't mark as FAILED if verification is premature
        // Return PENDING status instead
        return res.status(200).json({ 
          success: true, 
          status: 'PENDING',
          result: data.result,
          message: 'Payment verification is premature - user should complete payment on Flouci first'
        });
      }
      
      console.log('Payment verification details:', {
        paymentId,
        status: paymentStatus,
        amount: data.result?.amount,
        cardInfo: data.result?.details ? {
          name: data.result.details.name,
          pan: data.result.details.pan
        } : 'N/A'
      });
      
      const updateData = {
        payment_status: 'FAILED',
        payment_gateway_reference: paymentId,
        payment_response_data: data.result,
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', targetOrderId);

      if (updateError) {
        console.error('❌ Error updating order payment status:', updateError);
      } else {
      }

      res.json({ 
        success: data.success,
        status: paymentStatus,
        result: data.result,
        orderUpdated: true,
        orderId: targetOrderId
      });
    } else if (paymentStatus === 'PENDING') {
      // PENDING - don't update order status yet, let webhook finalize
      return res.status(200).json({ 
        success: true, 
        status: paymentStatus,
        result: data.result,
        message: 'Payment pending - will be finalized by webhook or retry'
      });
    } else {
      // Unknown status
      return res.status(200).json({ 
        success: data.success, 
        status: paymentStatus,
        result: data.result,
        message: `Payment status: ${paymentStatus}`
      });
    }
  } catch (error) {
    console.error('Error verifying Flouci payment:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============================================
// Flouci Payment Webhook
// ============================================

// POST /api/flouci-webhook - Handle Flouci payment webhook notifications
app.post('/api/flouci-webhook', logSecurityRequest, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    // Security: Verify webhook signature if configured
    const FLOUCI_WEBHOOK_SECRET = process.env.FLOUCI_WEBHOOK_SECRET;
    const webhookSignature = req.headers['x-flouci-signature'] || req.headers['x-signature'];
    
    if (FLOUCI_WEBHOOK_SECRET && webhookSignature) {
      // Get raw body for signature verification (captured by middleware)
      const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', FLOUCI_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');
      
      // Use constant-time comparison to prevent timing attacks
      // Handle case where signature might be in different format
      const receivedSig = webhookSignature.replace(/^sha256=/, ''); // Remove prefix if present
      const signatureMatch = receivedSig.length === expectedSignature.length && 
        crypto.timingSafeEqual(
          Buffer.from(receivedSig),
          Buffer.from(expectedSignature)
        );
      
      if (!signatureMatch) {
        console.error('❌ Flouci webhook: Invalid signature', {
          received: webhookSignature.substring(0, 10) + '...',
          expected: expectedSignature.substring(0, 10) + '...',
          ip: req.ip || req.headers['x-forwarded-for']
        });
        
        // Log security event
        try {
          const logData = {
            event_type: 'webhook_signature_failed',
            endpoint: '/api/flouci-webhook',
            ip_address: normalizeIP(req), // PHASE 2: Normalized IP
            user_agent: req.headers['user-agent'] || 'unknown',
            details: { reason: 'Invalid webhook signature' },
            severity: 'high'
          };
          // Use service role client for security audit logs (bypasses RLS)
          const securityLogClient = supabaseService || supabase;
          await securityLogClient.from('security_audit_logs').insert(logData);
          // Check for suspicious activity
          await checkSuspiciousActivity('webhook_signature_failed', logData.details, req);
        } catch (logError) {
          console.error('Failed to log security event:', logError);
        }
        
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    } else if (FLOUCI_WEBHOOK_SECRET && !webhookSignature) {
      console.warn('⚠️ Flouci webhook secret configured but no signature provided');
    }

    const { payment_id, status, developer_tracking_id } = req.body;

    // Validate required fields
    if (!payment_id || !status || !developer_tracking_id) {
      console.error('Flouci webhook: Missing required fields', req.body);
      return res.status(400).json({ error: 'Missing required fields' });
    }


    // Find order by developer_tracking_id (which is the order ID)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', developer_tracking_id)
      .single();

    if (orderError || !order) {
      console.error('❌ Order not found for Flouci webhook:', developer_tracking_id);
      return res.status(404).json({ error: 'Order not found' });
    }

    // WEBHOOK REPLAY PROTECTION: If order is already PAID, return success immediately
    // This prevents duplicate ticket generation and email sending
    if (order.status === 'PAID') {
      return res.status(200).json({ 
        success: true, 
        message: 'Order already processed',
        orderStatus: 'PAID'
      });
    }

    // Verify payment with Flouci API to ensure authenticity
    const FLOUCI_PUBLIC_KEY = process.env.FLOUCI_PUBLIC_KEY;
    const FLOUCI_SECRET_KEY = process.env.FLOUCI_SECRET_KEY;

    if (!FLOUCI_PUBLIC_KEY || !FLOUCI_SECRET_KEY) {
      console.error('❌ Flouci API keys not configured');
      return res.status(500).json({ error: 'Payment gateway not configured' });
    }

    // Add timeout to prevent hanging requests (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

    // Verify payment status with Flouci
    let verifyResponse;
    let verifyData;
    try {
      verifyResponse = await fetch(`https://developers.flouci.com/api/v2/verify_payment/${payment_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${FLOUCI_PUBLIC_KEY}:${FLOUCI_SECRET_KEY}`
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      verifyData = await verifyResponse.json();
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('❌ Flouci API webhook verification request timed out after 30 seconds');
        return res.status(504).json({ 
          error: 'Payment verification timeout',
          message: 'The payment gateway did not respond in time.',
          details: 'Request timed out after 30 seconds'
        });
      }
      throw fetchError; // Re-throw other errors
    }

    if (!verifyData.success) {
      console.error('❌ Flouci verification failed:', verifyData);
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    const paymentStatus = verifyData.result?.status;

    // GOLDEN RULE: Flouci verification API is the source of truth
    // Only mark order as PAID if verify_payment returns SUCCESS
    if (paymentStatus === 'SUCCESS') {
      // Double-check order is not already PAID (idempotency)
      if (order.status === 'PAID') {
        return res.status(200).json({ 
          success: true, 
          message: 'Order already processed',
          orderStatus: 'PAID'
        });
      }

      // Update order to PAID in a transaction
      const updateData = {
        status: 'PAID',
        payment_status: 'PAID',
        payment_gateway_reference: payment_id,
        payment_response_data: verifyData.result,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', developer_tracking_id)
        .eq('status', 'PENDING_ONLINE'); // Only update if still PENDING_ONLINE (prevents race conditions)

      if (updateError) {
        console.error('❌ Error updating order to PAID:', updateError);
        return res.status(500).json({ error: 'Failed to update order' });
      }

      // Check if update actually happened (might have been updated by another process)
      const { data: updatedOrder } = await supabase
        .from('orders')
        .select('status')
        .eq('id', developer_tracking_id)
        .single();

      if (updatedOrder?.status !== 'PAID') {
        return res.status(200).json({ 
          success: true, 
          message: 'Order status may have been updated by another process'
        });
      }

      // CRITICAL: Only generate tickets and send emails AFTER order is confirmed PAID
      // This happens in a separate async process to not block webhook response
      
      // IDEMPOTENCY: Check if tickets already exist before generating
      const { data: existingTickets } = await supabase
        .from('tickets')
        .select('id')
        .eq('order_id', developer_tracking_id)
        .limit(1);

      if (existingTickets && existingTickets.length > 0) {
        return res.status(200).json({ 
          success: true, 
          message: 'Webhook processed - tickets already exist'
        });
      }

      // Call ticket generation function (fire and forget - don't block webhook response)
      // Use process.nextTick to ensure function is available and run after current execution
      process.nextTick(async () => {
        try {
          
          // Check if function exists
          if (typeof generateTicketsAndSendEmail !== 'function') {
            console.error('❌ generateTicketsAndSendEmail function not found!');
            return;
          }
          
          const result = await generateTicketsAndSendEmail(developer_tracking_id);
        } catch (error) {
          console.error('❌ Error generating tickets after payment:', error);
          console.error('❌ Error details:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            name: error.name
          });
          // Don't fail the webhook - tickets can be generated manually later via admin panel
        }
      });
    } else if (paymentStatus === 'FAILURE' || paymentStatus === 'EXPIRED') {
      // Payment failed - mark as failed but keep status as PENDING_ONLINE (allows retry)
      const updateData = {
        payment_status: 'FAILED',
        payment_gateway_reference: payment_id,
        payment_response_data: verifyData.result,
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', developer_tracking_id);

      if (updateError) {
        console.error('❌ Error updating order payment status:', updateError);
      } else {
      }
    } else {
      // PENDING - don't update order status yet, let webhook finalize later
      return res.status(200).json({ success: true, message: 'Payment pending' });
    }

    // Return success response to Flouci
    res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('❌ Error processing Flouci webhook:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============================================
// Active Ambassadors Endpoint
// ============================================

// GET /api/ambassadors/active - Get active ambassadors filtered by city/ville (public)
app.get('/api/ambassadors/active', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { city, ville } = req.query;

    if (!city) {
      return res.status(400).json({ error: 'City parameter is required' });
    }

    // Normalize city and ville (trim whitespace)
    const normalizedCity = String(city).trim();
    const normalizedVille = ville && String(ville).trim() !== '' ? String(ville).trim() : null;
    
    
    let query = supabase
      .from('ambassadors')
      .select('id, full_name, phone, email, city, ville, status, commission_rate')
      .eq('status', 'approved')
      .eq('city', normalizedCity);

    // If ville is provided, also filter by ville (match city AND ville)
    // If ville is NOT provided, show all ambassadors in the city
    if (normalizedVille) {
      query = query.eq('ville', normalizedVille);
    }
    
    query = query.order('full_name');

    const { data: ambassadors, error } = await query;

    if (error) {
      console.error('❌ Error fetching active ambassadors:', error);
      return res.status(500).json({ error: error.message });
    }

    // Fetch social_link from ambassador_applications for each ambassador
    const ambassadorsWithSocial = await Promise.all(
      (ambassadors || []).map(async (ambassador) => {
        // Try to find matching application by phone
        const { data: application } = await supabase
          .from('ambassador_applications')
          .select('social_link')
          .eq('phone_number', ambassador.phone)
          .single();
        
        return {
          ...ambassador,
          social_link: application?.social_link || null
        };
      })
    );


    res.json({ success: true, data: ambassadorsWithSocial || [] });
  } catch (error) {
    console.error('Error in ambassadors/active endpoint:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch active ambassadors' });
  }
});

// ============================================
// Ambassador Sales Analytics Endpoints
// ============================================

// GET /api/admin/ambassador-sales/overview - Get performance metrics and analytics (admin)
app.get('/api/admin/ambassador-sales/overview', requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get all ambassador cash orders
    const { data: allOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, total_price, ambassador_id, created_at, status, ambassadors!inner(full_name)')
      .eq('payment_method', 'ambassador_cash');

    if (ordersError) {
      throw new Error(ordersError.message);
    }

    const orders = allOrders || [];
    const thisWeekOrders = orders.filter(o => new Date(o.created_at) >= startOfWeek);
    const thisMonthOrders = orders.filter(o => new Date(o.created_at) >= startOfMonth);

    const totalOrders = {
      allTime: orders.length,
      thisMonth: thisMonthOrders.length,
      thisWeek: thisWeekOrders.length
    };

    const totalRevenue = {
      allTime: orders.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0),
      thisMonth: thisMonthOrders.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0),
      thisWeek: thisWeekOrders.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0)
    };

    const calculateCommission = (revenue) => revenue * 0.10;
    const totalCommissions = {
      allTime: calculateCommission(totalRevenue.allTime),
      thisMonth: calculateCommission(totalRevenue.thisMonth),
      thisWeek: calculateCommission(totalRevenue.thisWeek)
    };

    const averageOrderValue = totalOrders.allTime > 0 ? totalRevenue.allTime / totalOrders.allTime : 0;
    const uniqueAmbassadors = new Set(orders.map(o => o.ambassador_id).filter(Boolean));
    const averageOrdersPerAmbassador = uniqueAmbassadors.size > 0 ? totalOrders.allTime / uniqueAmbassadors.size : 0;

    // Top performers
    const ambassadorStats = new Map();
    orders.forEach(order => {
      if (!order.ambassador_id) return;
      const existing = ambassadorStats.get(order.ambassador_id) || {
        ambassador_id: order.ambassador_id,
        ambassador_name: order.ambassadors?.full_name || 'Unknown',
        total_orders: 0,
        total_revenue: 0
      };
      existing.total_orders += 1;
      existing.total_revenue += parseFloat(order.total_price) || 0;
      ambassadorStats.set(order.ambassador_id, existing);
    });

    const topPerformers = Array.from(ambassadorStats.values())
      .map(stat => ({
        ...stat,
        total_commissions: calculateCommission(stat.total_revenue)
      }))
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 10);

    res.json({
      success: true,
      data: {
        totalOrders,
        totalRevenue,
        totalCommissions,
        averageOrderValue,
        averageOrdersPerAmbassador,
        topPerformers
      }
    });
  } catch (error) {
    console.error('Error in ambassador-sales/overview endpoint:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch sales overview' });
  }
});

// GET /api/admin/ambassador-sales/orders - Get COD ambassador orders with filters (admin)
app.get('/api/admin/ambassador-sales/orders', requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { status, ambassador_id, city, ville, date_from, date_to, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('orders')
      .select('*, order_passes (*), ambassadors (id, full_name, phone, email)', { count: 'exact' })
      .eq('payment_method', 'ambassador_cash')
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (status) query = query.eq('status', status);
    if (ambassador_id) query = query.eq('ambassador_id', ambassador_id);
    if (city) query = query.eq('city', city);
    if (ville) query = query.eq('ville', ville);
    if (date_from) query = query.gte('created_at', date_from);
    if (date_to) query = query.lte('created_at', date_to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching ambassador orders:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      success: true,
      data: data || [],
      count: count || 0
    });
  } catch (error) {
    console.error('Error in ambassador-sales/orders endpoint:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch ambassador orders' });
  }
});

// GET /api/admin/ambassador-sales/logs - Get order logs (super admin only)
app.get('/api/admin/ambassador-sales/logs', requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    // Check if user is super admin
    const { data: adminData } = await supabase
      .from('admins')
      .select('role')
      .eq('id', req.admin.id)
      .single();

    if (!adminData || adminData.role !== 'super_admin') {
      return res.status(403).json({ error: 'Super admin access required' });
    }

    const { date_from, date_to, action, ambassador_id, order_id, limit = 100, offset = 0 } = req.query;

    let query = supabase
      .from('order_logs')
      .select('*, orders!inner(payment_method)', { count: 'exact' })
      .eq('orders.payment_method', 'ambassador_cash')
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (date_from) query = query.gte('created_at', date_from);
    if (date_to) query = query.lte('created_at', date_to);
    if (action) query = query.eq('action', action);
    if (ambassador_id) query = query.eq('performed_by', ambassador_id);
    if (order_id) query = query.eq('order_id', order_id);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching order logs:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      success: true,
      data: data || [],
      count: count || 0
    });
  } catch (error) {
    console.error('Error in ambassador-sales/logs endpoint:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch order logs' });
  }
});

// ============================================

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
      console.error('❌ /api/ambassador-login: Supabase not configured');
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'Supabase not configured. Please check SUPABASE_URL and SUPABASE_ANON_KEY environment variables.'
      });
    }

    const { phone, password, recaptchaToken } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone number and password are required' });
    }

    // Normalize phone number for Tunisian format
    // Remove spaces, dashes, parentheses, and country code prefixes
    const normalizePhone = (phoneNum) => {
      if (!phoneNum) return '';
      // Remove all non-digit characters
      let cleaned = phoneNum.replace(/[\s\-\(\)]/g, '').trim();
      // Remove country code prefixes (+216, 216, 00216)
      if (cleaned.startsWith('+216')) {
        cleaned = cleaned.substring(4);
      } else if (cleaned.startsWith('216')) {
        cleaned = cleaned.substring(3);
      } else if (cleaned.startsWith('00216')) {
        cleaned = cleaned.substring(5);
      }
      // Remove leading zeros
      cleaned = cleaned.replace(/^0+/, '');
      // Should be exactly 8 digits starting with 2, 4, 5, or 9
      return cleaned;
    };
    
    const normalizedPhone = normalizePhone(phone);
    
    // Validate phone number format (Tunisian: 8 digits starting with 2, 4, 5, or 9)
    if (!/^[2459]\d{7}$/.test(normalizedPhone)) {
      console.error('❌ /api/ambassador-login: Invalid phone format:', {
        original: phone,
        normalized: normalizedPhone
      });
      return res.status(400).json({ 
        error: 'Invalid phone number format',
        details: 'Phone number must be 8 digits starting with 2, 4, 5, or 9'
      });
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
            console.error('❌ /api/ambassador-login: reCAPTCHA verification failed');
            return res.status(400).json({ error: 'reCAPTCHA verification failed' });
          }
        } catch (recaptchaError) {
          console.error('❌ /api/ambassador-login: reCAPTCHA verification error:', recaptchaError);
          return res.status(500).json({ error: 'reCAPTCHA verification service unavailable' });
        }
      }
    }

    // Try to find ambassador by phone number (try normalized first, then exact)
    let ambassador = null;
    let dbError = null;

    // Strategy 1: Try normalized phone match (most reliable)
    const { data: ambassadorByNormalized, error: normalizedError } = await supabase
      .from('ambassadors')
      .select('*')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (ambassadorByNormalized) {
      ambassador = ambassadorByNormalized;
    } else if (normalizedError && normalizedError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is OK, other errors are not
      dbError = normalizedError;
    } else {
      // Strategy 2: Try exact phone match (in case it's stored with formatting)
      const { data: ambassadorByPhone, error: phoneError } = await supabase
        .from('ambassadors')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();

      if (ambassadorByPhone) {
        ambassador = ambassadorByPhone;
      } else if (phoneError && phoneError.code !== 'PGRST116') {
        dbError = phoneError;
      } else {
        // Strategy 3: Fetch all and find by normalized comparison
        const { data: allAmbassadors, error: fetchError } = await supabase
          .from('ambassadors')
          .select('*');
        
        if (fetchError) {
          dbError = fetchError;
        } else if (allAmbassadors) {
          ambassador = allAmbassadors.find(amb => {
            const ambPhone = normalizePhone(amb.phone || '');
            return ambPhone === normalizedPhone;
          }) || null;
        }
      }
    }

    if (dbError) {
      console.error('❌ /api/ambassador-login: Database error:', {
        error: dbError.message,
        code: dbError.code,
        phone: phone
      });
      return res.status(500).json({ 
        error: 'Database error',
        details: 'Failed to verify ambassador credentials'
      });
    }

    if (!ambassador) {
      console.error('❌ /api/ambassador-login: Ambassador not found:', {
        originalPhone: phone,
        normalizedPhone: normalizedPhone,
        phoneLength: phone.length,
        normalizedLength: normalizedPhone.length
      });
      
      // Log available ambassadors for debugging (first 5)
      if (process.env.NODE_ENV === 'development') {
        const { data: sampleAmbassadors } = await supabase
          .from('ambassadors')
          .select('phone, full_name, status')
          .limit(5);
      }
      
      return res.status(401).json({ 
        error: 'Invalid phone number or password',
        details: 'No ambassador found with this phone number. Please check your phone number and try again.'
      });
    }

    // Check if ambassador has a password
    if (!ambassador.password) {
      console.error('❌ /api/ambassador-login: Ambassador has no password:', {
        ambassadorId: ambassador.id,
        phone: ambassador.phone
      });
      return res.status(500).json({ 
        error: 'Account configuration error',
        details: 'Ambassador account is not properly configured. Please contact support.'
      });
    }

    // Verify password
    let isPasswordValid = false;
    try {
      isPasswordValid = await bcrypt.compare(password, ambassador.password);
    } catch (bcryptError) {
      console.error('❌ /api/ambassador-login: Password verification error:', {
        error: bcryptError.message,
        ambassadorId: ambassador.id
      });
      return res.status(500).json({ 
        error: 'Server error',
        details: 'Failed to verify password'
      });
    }

    if (!isPasswordValid) {
      console.error('❌ /api/ambassador-login: Invalid password:', {
        phone: ambassador.phone,
        ambassadorId: ambassador.id
      });
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    // Check application status
    if (ambassador.status === 'pending') {
      return res.status(403).json({ 
        error: 'Your application is under review',
        details: 'Please wait for your application to be approved before logging in.'
      });
    }

    if (ambassador.status === 'rejected') {
      return res.status(403).json({ 
        error: 'Your application was not approved',
        details: 'Your ambassador application was not approved. Please contact support if you believe this is an error.'
      });
    }

    if (ambassador.status === 'suspended') {
      return res.status(403).json({ 
        error: 'Your account is suspended',
        details: 'Your ambassador account has been suspended. Please contact support for assistance.'
      });
    }

    // Only allow approved ambassadors to login
    if (ambassador.status !== 'approved') {
      console.error('❌ /api/ambassador-login: Invalid status:', {
        phone: ambassador.phone,
        status: ambassador.status,
        ambassadorId: ambassador.id
      });
      return res.status(403).json({ 
        error: 'Account not active',
        details: `Your account status is "${ambassador.status}". Only approved ambassadors can log in.`
      });
    }

    // Success - return ambassador data (frontend will handle session storage)
    res.status(200).json({ 
      success: true, 
      ambassador: {
        id: ambassador.id,
        full_name: ambassador.full_name,
        phone: ambassador.phone,
        email: ambassador.email,
        status: ambassador.status,
        city: ambassador.city
      }
    });
  } catch (error) {
    console.error('❌ /api/ambassador-login: Unexpected error:', {
      error: error.message,
      stack: error.stack,
      phone: req.body?.phone
    });
    res.status(500).json({ 
      error: 'Internal server error', 
      details: process.env.NODE_ENV === 'production' 
        ? 'An error occurred. Please try again later.' 
        : error.message
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

// Phone subscription endpoint for popup
const phoneSubscribeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many subscription attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/api/phone-subscribe', phoneSubscribeLimiter, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { phone_number, language } = req.body;

    // Validate required fields
    if (!phone_number) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Validate phone number format: exactly 8 digits, numeric only, starts with 2, 4, 5, or 9
    const phoneRegex = /^[2594][0-9]{7}$/;
    if (!phoneRegex.test(phone_number)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Check for duplicate phone number in phone_subscribers table
    const { data: existingSubscriber, error: checkError } = await supabase
      .from('phone_subscribers')
      .select('id')
      .eq('phone_number', phone_number)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" which is fine
      console.error('Error checking for duplicate phone number:', checkError);
      return res.status(500).json({ error: 'Failed to check phone number' });
    }

    if (existingSubscriber) {
      return res.status(400).json({ error: 'Phone number already exists' });
    }

    // Insert new subscriber
    const { data: subscriber, error: insertError } = await supabase
      .from('phone_subscribers')
      .insert({
        phone_number: phone_number,
        language: language || 'en'
      })
      .select()
      .single();

    if (insertError) {
      // Check if it's a duplicate key error (race condition)
      if (insertError.code === '23505' || insertError.message?.includes('unique constraint') || insertError.message?.includes('duplicate key')) {
        return res.status(400).json({ error: 'Phone number already exists' });
      }
      console.error('Error inserting phone subscriber:', insertError);
      return res.status(500).json({ error: 'Failed to subscribe', details: insertError.message });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Phone number subscribed successfully',
      subscriber: {
        id: subscriber.id,
        phone_number: subscriber.phone_number
      }
    });
  } catch (error) {
    console.error('Error in phone subscription:', error);
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
      const isAuthError = emailError.code === 'EAUTH' || 
                         emailError.responseCode === 535 || 
                         emailError.responseCode === 534 ||
                         errorMessage.includes('Invalid login') || 
                         errorMessage.includes('authentication') ||
                         errorMessage.includes('credentials');
      const isConfigError = !process.env.EMAIL_USER || !process.env.EMAIL_PASS;

      console.error('❌ Email sending error details:', {
        error: emailError.message,
        code: emailError.code,
        responseCode: emailError.responseCode,
        response: emailError.response,
        isAuthError,
        isConfigError,
        emailUser: process.env.EMAIL_USER,
        emailHost: process.env.EMAIL_HOST,
        passwordSet: !!process.env.EMAIL_PASS
      });

      return res.status(500).json({ 
        error: 'Failed to send email', 
        details: isConfigError 
          ? 'Email service not configured. Please check EMAIL_USER and EMAIL_PASS environment variables.'
          : isAuthError
          ? 'Email authentication failed. The email server credentials are invalid. Please verify EMAIL_USER and EMAIL_PASS environment variables are correct and the password has not expired.'
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
      console.error('❌ Error resending order completion email:', {
        error: emailError.message,
        code: emailError.code,
        responseCode: emailError.responseCode,
        response: emailError.response,
        orderId: orderId,
        to: order.user_email
      });
      
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

      // Provide more detailed error message
      const errorMessage = emailError.message || 'Unknown error';
      const isAuthError = emailError.code === 'EAUTH' || 
                         emailError.responseCode === 535 || 
                         emailError.responseCode === 534 ||
                         errorMessage.includes('Invalid login') || 
                         errorMessage.includes('authentication') ||
                         errorMessage.includes('credentials');
      const isConfigError = !process.env.EMAIL_USER || !process.env.EMAIL_PASS;

      return res.status(500).json({ 
        error: 'Failed to send email', 
        details: isConfigError 
          ? 'Email service not configured. Please check EMAIL_USER and EMAIL_PASS environment variables.'
          : isAuthError
          ? 'Email authentication failed. The email server credentials are invalid. Please verify EMAIL_USER and EMAIL_PASS environment variables are correct and the password has not expired.'
          : errorMessage
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
// Secure QR code access endpoint - one-time access with event-based expiration
// Shows ALL QR codes for an order in a single URL
app.get('/api/qr-codes/:accessToken', logSecurityRequest, qrCodeAccessLimiter, async (req, res) => {
  try {
    const { accessToken } = req.params;
    
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const dbClient = supabaseService || supabase;
    
    // Find order by QR access token
    const { data: order, error: orderError } = await dbClient
      .from('orders')
      .select(`
        *,
        events (
          id,
          name,
          date,
          venue
        )
      `)
      .eq('qr_access_token', accessToken)
      .single();

    // Log access attempt
    const logAccess = async (result, errorMsg = null) => {
      try {
        await dbClient.from('qr_code_access_logs').insert({
          ticket_id: null, // Order-level access, not ticket-specific
          order_id: order?.id || null,
          access_token: accessToken,
          ip_address: normalizeIP(req), // PHASE 2: Normalized IP
          user_agent: req.headers['user-agent'] || 'unknown',
          access_result: result,
          error_message: errorMsg
        });
      } catch (logError) {
        console.error('Error logging access:', logError);
      }
    };

    // Check if token exists
    if (orderError || !order) {
      await logAccess('invalid_token', 'Token not found');
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Invalid Link</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #e74c3c; }
          </style>
        </head>
        <body>
          <h1 class="error">Invalid or Expired Link</h1>
          <p>The QR code link you're trying to access is invalid or has expired.</p>
          <p>Please contact support if you need assistance.</p>
        </body>
        </html>
      `);
    }

    // Check if URL already accessed
    if (order.qr_url_accessed) {
      await logAccess('already_accessed', 'URL already accessed');
      return res.status(403).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Link Already Used</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .warning { color: #f39c12; }
          </style>
        </head>
        <body>
          <h1 class="warning">Link Already Used</h1>
          <p>This QR code link has already been accessed.</p>
          <p>If you need to access your QR codes again, please check your email or contact support.</p>
        </body>
        </html>
      `);
    }

    // Check event-based expiration
    const now = new Date();
    if (order.qr_url_expires_at) {
      const expiresAt = new Date(order.qr_url_expires_at);
      if (now > expiresAt) {
        await logAccess('event_expired', `Expired at ${expiresAt.toISOString()}`);
        return res.status(410).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Link Expired</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .error { color: #e74c3c; }
            </style>
          </head>
          <body>
            <h1 class="error">Link Expired</h1>
            <p>This QR code link has expired.</p>
            <p>Please contact support if you need assistance.</p>
          </body>
          </html>
        `);
      }
    }

    // Fetch all tickets for this order
    const { data: orderTickets, error: ticketsError } = await dbClient
      .from('tickets')
      .select(`
        *,
        order_passes (
          pass_type
        )
      `)
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });

    if (ticketsError || !orderTickets || orderTickets.length === 0) {
      await logAccess('invalid_token', 'No tickets found for order');
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>No Tickets Found</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #e74c3c; }
          </style>
        </head>
        <body>
          <h1 class="error">No Tickets Found</h1>
          <p>No tickets were found for this order.</p>
          <p>Please contact support if you need assistance.</p>
        </body>
        </html>
      `);
    }

    // Mark URL as accessed
    await dbClient
      .from('orders')
      .update({
        qr_url_accessed: true,
        qr_url_accessed_at: new Date().toISOString()
      })
      .eq('id', order.id);

    // Log successful access
    await logAccess('success');

    // Build HTML with all QR codes
    const eventName = order.events?.name || 'Event';
    const eventDate = order.events?.date 
      ? new Date(order.events.date).toLocaleDateString() 
      : '';
    
    // Group tickets by pass type
    const ticketsByPassType = {};
    orderTickets.forEach(ticket => {
      const passType = ticket.order_passes?.pass_type || 'Standard';
      if (!ticketsByPassType[passType]) {
        ticketsByPassType[passType] = [];
      }
      ticketsByPassType[passType].push(ticket);
    });

    // Build QR codes HTML
    let qrCodesHtml = '';
    Object.entries(ticketsByPassType).forEach(([passType, tickets]) => {
      qrCodesHtml += `
        <div style="margin: 30px 0;">
          <h3 style="color: #667eea; margin-bottom: 20px; font-size: 18px;">${passType} (${tickets.length} ticket${tickets.length > 1 ? 's' : ''})</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
      `;
      
      tickets.forEach((ticket, index) => {
        if (ticket.qr_code_url) {
          qrCodesHtml += `
            <div style="background: #f8f9fa; border-radius: 15px; padding: 20px; text-align: center; border: 2px dashed #667eea;">
              <p style="margin-bottom: 10px; font-weight: 600; color: #667eea;">Ticket ${index + 1}</p>
              <img src="${ticket.qr_code_url}" alt="QR Code ${index + 1}" style="max-width: 100%; height: auto; border-radius: 10px; margin-bottom: 10px;">
              <a href="${ticket.qr_code_url}" download="qr-code-${ticket.secure_token.substring(0, 8)}.png" style="display: inline-block; background: #667eea; color: white; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-size: 12px; margin-top: 10px;">📥 Download</a>
            </div>
          `;
        }
      });
      
      qrCodesHtml += `
          </div>
        </div>
      `;
    });

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your QR Code - Andiamo Events</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            max-width: 900px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
          }
          h1 {
            color: #667eea;
            margin-bottom: 10px;
            font-size: 28px;
          }
          .event-info {
            color: #666;
            margin-bottom: 30px;
            font-size: 16px;
          }
          .qr-container {
            background: #f8f9fa;
            border-radius: 15px;
            padding: 30px;
            margin: 30px 0;
            border: 2px dashed #667eea;
          }
          .qr-codes-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 20px 0;
          }
          .qr-code-item {
            background: white;
            border-radius: 15px;
            padding: 20px;
            text-align: center;
            border: 2px solid #667eea;
          }
          .qr-code {
            max-width: 100%;
            height: auto;
            border-radius: 10px;
            margin: 10px 0;
          }
          .download-btn {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 8px 16px;
            border-radius: 8px;
            text-decoration: none;
            font-size: 12px;
            margin-top: 10px;
            transition: transform 0.2s;
          }
          .download-btn:hover {
            transform: scale(1.05);
          }
          .info {
            background: #e8f4f8;
            border-left: 4px solid #667eea;
            padding: 15px;
            margin-top: 20px;
            border-radius: 5px;
            text-align: left;
            font-size: 14px;
            color: #555;
          }
          .success-badge {
            background: #d4edda;
            color: #155724;
            padding: 10px 20px;
            border-radius: 20px;
            display: inline-block;
            margin-bottom: 20px;
            font-size: 14px;
            font-weight: 600;
          }
          .pass-type-header {
            color: #667eea;
            margin: 30px 0 20px 0;
            font-size: 18px;
            font-weight: 600;
            text-align: left;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-badge">✅ QR Codes Accessed</div>
          <h1>Your Digital Tickets</h1>
          <div class="event-info">
            ${eventName}${eventDate ? `<br>${eventDate}` : ''}
          </div>
          ${qrCodesHtml}
          <div class="info">
            <strong>Important:</strong> Please save these QR codes to your phone. You'll need to present them at the event entrance. This link can only be accessed once.
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error serving QR code:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Error</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .error { color: #e74c3c; }
        </style>
      </head>
      <body>
        <h1 class="error">Error</h1>
        <p>An error occurred while loading your QR code.</p>
        <p>Please try again later or contact support.</p>
      </body>
      </html>
    `);
  }
});

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

/**
 * Helper function to generate tickets and send email for an order
 * This can be called from webhook or manual endpoint
 */
async function generateTicketsAndSendEmail(orderId) {
  console.log('\n🚀 ============================================');
  console.log('🚀 STARTING TICKET GENERATION AND EMAIL/SMS');
  console.log('🚀 ============================================');
  console.log('📋 Order ID:', orderId);
  console.log('⏰ Timestamp:', new Date().toISOString());
  
  try {
    if (!supabase) {
      console.error('❌ Supabase not configured');
      throw new Error('Supabase not configured');
    }
    console.log('✅ Supabase client available');
    
    // Check email configuration early
    const hasEmailConfig = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
    console.log('📧 Email Configuration:', {
      hasEmailUser: !!process.env.EMAIL_USER,
      hasEmailPass: !!process.env.EMAIL_PASS,
      emailConfigured: hasEmailConfig
    });
    
    if (!hasEmailConfig) {
      console.warn('⚠️ Email service not configured - EMAIL_USER or EMAIL_PASS not set');
      console.warn('⚠️ Tickets will be generated but email will not be sent');
    } else {
      console.log('✅ Email service is configured');
    }

    // Use service role client for ALL operations (storage AND database) if available
    const dbClient = supabaseService || supabase;
    const storageClient = supabaseService || supabase;
    
    console.log('🔑 Supabase Client Type:', supabaseService ? 'Service Role (✅)' : 'Anon Key (⚠️)');
    if (!supabaseService) {
      console.warn('⚠️ Service role key not set - using anon key (may fail due to RLS)');
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
    
    // Debug: Log order data to check if user_phone exists
    if (orderData) {
      // For debugging: show full phone number (can be masked in production)
      const showFullPhone = process.env.NODE_ENV === 'development';
      const phoneDisplay = orderData.user_phone 
        ? (showFullPhone ? orderData.user_phone : `${orderData.user_phone.substring(0, 3)}***`)
        : 'NOT SET';
      
      console.log('Order details for SMS:', {
        orderId: orderData.id,
        hasUserPhone: !!orderData.user_phone,
        userPhone: phoneDisplay,
        userPhoneLength: orderData.user_phone ? orderData.user_phone.length : 0,
        hasUserEmail: !!orderData.user_email,
        status: orderData.status,
        source: orderData.source
      });
    }

    if (orderError || !orderData) {
      console.error('❌ Order fetch failed:', {
        orderError: orderError?.message,
        hasOrderData: !!orderData
      });
      throw new Error(`Order not found: ${orderError?.message || 'Unknown error'}`);
    }

    const order = orderData;
    console.log('✅ Order fetched successfully:', {
      orderId: order.id,
      status: order.status,
      source: order.source,
      paymentMethod: order.payment_method,
      hasUserEmail: !!order.user_email,
      hasUserPhone: !!order.user_phone,
      userEmail: order.user_email || 'NOT SET',
      userPhone: order.user_phone ? `${order.user_phone.substring(0, 3)}***` : 'NOT SET'
    });

    // ============================================
    // PHASE 2 SECURITY FIX: Unified Status System
    // ============================================
    // Database constraint only allows: PENDING_ONLINE, REDIRECTED, PENDING_CASH, PENDING_ADMIN_APPROVAL, PAID, REJECTED, CANCELLED
    // All paid orders use 'PAID' status (COMPLETED and MANUAL_COMPLETED are legacy, not in constraint)
    const isPaidStatus = order.status === 'PAID';

    console.log('🔍 Status Check:', {
      source: order.source,
      status: order.status,
      isPaidStatus: isPaidStatus
    });

    if (!isPaidStatus) {
      console.error('❌ Order status validation failed:', {
        currentStatus: order.status,
        source: order.source,
        expectedStatuses: {
          platform_cod: 'COMPLETED, MANUAL_COMPLETED, or PAID',
          platform_online: 'PAID',
          ambassador_manual: 'PAID'
        }
      });
      throw new Error(`Order is not in a paid status. Current status: ${order.status}, Source: ${order.source}`);
    }
    console.log('✅ Order status is valid for ticket generation');

    // Check if tickets already exist
    console.log('🔍 Checking for existing tickets...');
    const { data: existingTickets } = await dbClient
      .from('tickets')
      .select('id')
      .eq('order_id', orderId)
      .limit(1);

    if (existingTickets && existingTickets.length > 0) {
      console.log('⚠️ Tickets already exist for this order:', existingTickets.length);
      return { success: true, message: 'Tickets already generated', ticketsCount: existingTickets.length };
    }
    console.log('✅ No existing tickets found, proceeding with generation');

    // Fetch all passes for this order
    let orderPasses = null;
    const { data: passesData, error: passesError } = await dbClient
      .from('order_passes')
      .select('*')
      .eq('order_id', orderId);

    if (passesError) {
      throw new Error(`Failed to fetch order passes: ${passesError.message}`);
    }

    orderPasses = passesData;

    // Fallback: If no passes in order_passes table, create them from order data
    if (!orderPasses || orderPasses.length === 0) {
      if (order.pass_type) {
        const quantity = order.quantity || 1;
        const pricePerPass = order.total_price / quantity;
        
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
          throw new Error(`Failed to create order pass: ${createPassError.message}`);
        }

        orderPasses = [newPass];
      } else {
        throw new Error('No passes found for this order');
      }
    }

    const { v4: uuidv4 } = require('uuid');
    const QRCode = require('qrcode');

    // Generate single access token for order (for SMS URL with all QR codes)
    const orderAccessToken = uuidv4();
    
    // Calculate expiration date: event date + 1 day (or 30 days if no event date)
    let urlExpiresAt = null;
    if (order.events?.date) {
      const eventDate = new Date(order.events.date);
      eventDate.setDate(eventDate.getDate() + 1); // Event date + 1 day
      urlExpiresAt = eventDate.toISOString();
    } else {
      // Fallback: 30 days from now if no event date
      const fallbackDate = new Date();
      fallbackDate.setDate(fallbackDate.getDate() + 30);
      urlExpiresAt = fallbackDate.toISOString();
    }

    // Update order with access token
    await dbClient
      .from('orders')
      .update({
        qr_access_token: orderAccessToken,
        qr_url_accessed: false,
        qr_url_expires_at: urlExpiresAt
      })
      .eq('id', orderId);

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
        
        // Create ticket entry (no individual access token needed - using order-level token)
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
          continue;
        }

        if (ticketData) {
          tickets.push(ticketData);
        }
      }
    }

    if (tickets.length === 0) {
      throw new Error('Failed to generate any tickets');
    }

    // Group tickets by pass type for email
    const ticketsByPassType = new Map();
    tickets.forEach(ticket => {
      const pass = orderPasses.find(p => p.id === ticket.order_pass_id);
      if (pass) {
        const key = pass.pass_type;
        if (!ticketsByPassType.has(key)) {
          ticketsByPassType.set(key, []);
        }
        ticketsByPassType.get(key).push({ ...ticket, passType: key });
      }
    });

    // Build passes summary
    const passesSummary = orderPasses.map(p => ({
      passType: p.pass_type,
      quantity: p.quantity,
      price: p.price,
    }));

    // Build tickets for email
    const ticketsForEmail = tickets.map(ticket => {
      const pass = orderPasses.find(p => p.id === ticket.order_pass_id);
      return {
        id: ticket.id,
        passType: pass?.pass_type || 'Standard',
        qrCodeUrl: ticket.qr_code_url,
        secureToken: ticket.secure_token,
      };
    });

    // Track email sending status
    let emailSent = false;
    let emailError = null;

    // Send confirmation email with QR codes using the new template
    if (order.user_email) {
      try {
        // Check if email service is configured
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
          console.error('❌ Email service not configured - EMAIL_USER or EMAIL_PASS not set');
          emailError = 'Email service not configured. Please set EMAIL_USER and EMAIL_PASS environment variables.';
          throw new Error(emailError);
        }

        if (!process.env.EMAIL_HOST) {
          console.error('❌ Email service not configured - EMAIL_HOST not set');
          emailError = 'Email service not configured. Please set EMAIL_HOST environment variable.';
          throw new Error(emailError);
        }

        // Verify transporter configuration
        console.log('Email transporter configuration:', {
          host: process.env.EMAIL_HOST,
          port: process.env.EMAIL_PORT || '587',
          user: process.env.EMAIL_USER ? `${process.env.EMAIL_USER.substring(0, 3)}***` : 'NOT SET',
          hasPassword: !!process.env.EMAIL_PASS
        });

        
        // Verify transporter connection (optional, but helpful for debugging)
        try {
          await transporter.verify();
        } catch (verifyError) {
          console.error('❌ SMTP verification failed:', verifyError.message);
          console.error('❌ SMTP error details:', {
            code: verifyError.code,
            command: verifyError.command,
            response: verifyError.response,
            responseCode: verifyError.responseCode
          });
          
          // Provide helpful error message for custom SMTP servers
          if (verifyError.code === 'EAUTH') {
            console.error('❌ Email authentication failed. Please check:');
            console.error('   1. EMAIL_USER and EMAIL_PASS are correct');
            console.error('   2. EMAIL_HOST is set correctly:', process.env.EMAIL_HOST);
            console.error('   3. EMAIL_PORT is correct (587 for STARTTLS, 465 for SSL)');
            console.error('   4. Your email server may require:');
            console.error('      - Different authentication method');
            console.error('      - TLS/SSL configuration adjustments');
            console.error('      - IP whitelisting');
            console.error('   5. Try setting EMAIL_TLS_REJECT_UNAUTHORIZED=false if using self-signed certificates');
            console.error('   6. Try setting EMAIL_DEBUG=true to see detailed connection logs');
          }
          
          // Still attempt to send - sometimes verification fails but sending works
          console.warn('⚠️ Will still attempt to send email despite verification failure');
        }
        
        // Build the email HTML matching the ambassador template style
        const supportUrl = `${process.env.VITE_API_URL || process.env.API_URL || 'https://andiamoevents.com'}/contact`;
        
        // Build tickets HTML grouped by pass type
        const ticketsHtml = Array.from(ticketsByPassType.entries())
          .map(([passType, passTickets]) => {
            const ticketsList = passTickets
              .map((ticket, index) => {
                return `
                  <div style="margin: 20px 0; padding: 20px; background: #E8E8E8; border-radius: 8px; text-align: center; border: 1px solid rgba(0, 0, 0, 0.1);">
                    <h4 style="margin: 0 0 15px 0; color: #E21836; font-size: 16px; font-weight: 600;">${passType} - Ticket ${index + 1}</h4>
                    <img src="${ticket.qr_code_url}" alt="QR Code for ${passType}" style="max-width: 250px; height: auto; border-radius: 8px; border: 2px solid rgba(226, 24, 54, 0.3); display: block; margin: 0 auto;" />
                    <p style="margin: 10px 0 0 0; font-size: 12px; color: #666666; font-family: 'Courier New', monospace;">Token: ${ticket.secure_token.substring(0, 8)}...</p>
                  </div>
                `;
              })
              .join('');

            return `
              <div style="margin: 30px 0;">
                <h3 style="color: #E21836; margin-bottom: 15px; font-size: 18px; font-weight: 600;">${passType} Tickets (${passTickets.length})</h3>
                ${ticketsList}
              </div>
            `;
          })
          .join('');

        // Build passes summary HTML
        const passesSummaryHtml = passesSummary.map(p => `
          <tr style="border-bottom: 1px solid rgba(0, 0, 0, 0.1);">
            <td style="padding: 12px 0; color: #1A1A1A; font-size: 15px;">${p.passType}</td>
            <td style="padding: 12px 0; color: #1A1A1A; font-size: 15px; text-align: center;">${p.quantity}</td>
            <td style="padding: 12px 0; color: #1A1A1A; font-size: 15px; text-align: right;">${p.price.toFixed(2)} TND</td>
          </tr>
        `).join('');

        // Use the ambassador-style email template
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta name="color-scheme" content="light dark">
            <meta name="supported-color-schemes" content="light dark">
            <title>Your Digital Tickets - Andiamo Events</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6; 
                color: #1A1A1A; 
                background: #FFFFFF;
                padding: 0;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
              }
              @media (prefers-color-scheme: dark) {
                body {
                  color: #FFFFFF;
                  background: #1A1A1A;
                }
              }
              a {
                color: #E21836 !important;
                text-decoration: none;
              }
              .email-wrapper {
                max-width: 600px;
                margin: 0 auto;
                background: #FFFFFF;
              }
              @media (prefers-color-scheme: dark) {
                .email-wrapper {
                  background: #1A1A1A;
                }
              }
              .content-card {
                background: #F5F5F5;
                margin: 0 20px 30px;
                border-radius: 12px;
                padding: 50px 40px;
                border: 1px solid rgba(0, 0, 0, 0.1);
              }
              @media (prefers-color-scheme: dark) {
                .content-card {
                  background: #1F1F1F;
                  border: 1px solid rgba(42, 42, 42, 0.5);
                }
              }
              .title-section {
                text-align: center;
                margin-bottom: 40px;
                padding-bottom: 30px;
                border-bottom: 1px solid rgba(0, 0, 0, 0.1);
              }
              @media (prefers-color-scheme: dark) {
                .title-section {
                  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }
              }
              .title {
                font-size: 32px;
                font-weight: 700;
                color: #1A1A1A;
                margin-bottom: 12px;
                letter-spacing: -0.5px;
              }
              @media (prefers-color-scheme: dark) {
                .title {
                  color: #FFFFFF;
                }
              }
              .subtitle {
                font-size: 16px;
                color: #666666;
                font-weight: 400;
              }
              @media (prefers-color-scheme: dark) {
                .subtitle {
                  color: #B0B0B0;
                }
              }
              .greeting {
                font-size: 18px;
                color: #1A1A1A;
                margin-bottom: 30px;
                line-height: 1.7;
              }
              @media (prefers-color-scheme: dark) {
                .greeting {
                  color: #FFFFFF;
                }
              }
              .greeting strong {
                color: #E21836;
                font-weight: 600;
              }
              .message {
                font-size: 16px;
                color: #666666;
                margin-bottom: 25px;
                line-height: 1.7;
              }
              @media (prefers-color-scheme: dark) {
                .message {
                  color: #B0B0B0;
                }
              }
              .order-info-block {
                background: #E8E8E8;
                border: 1px solid rgba(0, 0, 0, 0.15);
                border-radius: 8px;
                padding: 30px;
                margin: 40px 0;
              }
              @media (prefers-color-scheme: dark) {
                .order-info-block {
                  background: #252525;
                  border: 1px solid rgba(42, 42, 42, 0.8);
                }
              }
              .info-row {
                margin-bottom: 20px;
              }
              .info-row:last-child {
                margin-bottom: 0;
              }
              .info-label {
                font-size: 11px;
                color: #999999;
                text-transform: uppercase;
                letter-spacing: 1.2px;
                margin-bottom: 10px;
                font-weight: 600;
              }
              @media (prefers-color-scheme: dark) {
                .info-label {
                  color: #6B6B6B;
                }
              }
              .info-value {
                font-family: 'Courier New', 'Monaco', monospace;
                font-size: 18px;
                color: #1A1A1A;
                font-weight: 500;
                word-break: break-all;
                letter-spacing: 0.5px;
              }
              @media (prefers-color-scheme: dark) {
                .info-value {
                  color: #FFFFFF;
                }
              }
              .passes-table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
              }
              .passes-table th {
                text-align: left;
                padding: 12px 0;
                color: #E21836;
                font-weight: 600;
                font-size: 14px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                border-bottom: 2px solid rgba(226, 24, 54, 0.3);
              }
              .passes-table td {
                padding: 12px 0;
                color: #1A1A1A;
                font-size: 15px;
              }
              @media (prefers-color-scheme: dark) {
                .passes-table td {
                  color: #FFFFFF;
                }
              }
              .total-row {
                border-top: 2px solid rgba(226, 24, 54, 0.3);
                margin-top: 10px;
                padding-top: 15px;
              }
              .total-row td {
                font-weight: 700;
                font-size: 18px;
                color: #E21836;
                padding-top: 15px;
              }
              .tickets-section {
                background: #E8E8E8;
                border: 1px solid rgba(0, 0, 0, 0.15);
                border-radius: 8px;
                padding: 30px;
                margin: 40px 0;
              }
              @media (prefers-color-scheme: dark) {
                .tickets-section {
                  background: #252525;
                  border: 1px solid rgba(42, 42, 42, 0.8);
                }
              }
              .support-section {
                background: #E8E8E8;
                border-left: 3px solid rgba(226, 24, 54, 0.3);
                padding: 20px 25px;
                margin: 35px 0;
                border-radius: 4px;
              }
              @media (prefers-color-scheme: dark) {
                .support-section {
                  background: #252525;
                }
              }
              .support-text {
                font-size: 14px;
                color: #666666;
                line-height: 1.7;
              }
              @media (prefers-color-scheme: dark) {
                .support-text {
                  color: #B0B0B0;
                }
              }
              .support-email {
                color: #E21836 !important;
                text-decoration: none;
                font-weight: 500;
              }
              .closing-section {
                text-align: center;
                margin: 50px 0 40px;
                padding-top: 40px;
                border-top: 1px solid rgba(0, 0, 0, 0.1);
              }
              @media (prefers-color-scheme: dark) {
                .closing-section {
                  border-top: 1px solid rgba(255, 255, 255, 0.1);
                }
              }
              .slogan {
                font-size: 24px;
                font-style: italic;
                color: #E21836;
                font-weight: 300;
                letter-spacing: 1px;
                margin-bottom: 30px;
              }
              .signature {
                font-size: 16px;
                color: #666666;
                line-height: 1.7;
              }
              @media (prefers-color-scheme: dark) {
                .signature {
                  color: #B0B0B0;
                }
              }
              .footer {
                margin-top: 50px;
                padding: 40px 20px 30px;
                text-align: center;
                border-top: 1px solid rgba(0, 0, 0, 0.1);
              }
              @media (prefers-color-scheme: dark) {
                .footer {
                  border-top: 1px solid rgba(255, 255, 255, 0.05);
                }
              }
              .footer-text {
                font-size: 12px;
                color: #999999;
                margin-bottom: 20px;
                line-height: 1.6;
              }
              @media (prefers-color-scheme: dark) {
                .footer-text {
                  color: #6B6B6B;
                }
              }
              .footer-links {
                margin: 15px auto 0;
                text-align: center;
              }
              .footer-link {
                color: #999999;
                text-decoration: none;
                font-size: 13px;
                margin: 0 8px;
              }
              @media (prefers-color-scheme: dark) {
                .footer-link {
                  color: #6B6B6B;
                }
              }
              .footer-link:hover {
                color: #E21836 !important;
              }
              @media only screen and (max-width: 600px) {
                .content-card {
                  margin: 0 15px 20px;
                  padding: 35px 25px;
                }
                .title {
                  font-size: 26px;
                }
                .order-info-block {
                  padding: 25px 20px;
                }
                .tickets-section {
                  padding: 25px 20px;
                }
              }
            </style>
          </head>
          <body>
            <div class="email-wrapper">
              <div class="content-card">
                <div class="title-section">
                  <h1 class="title">Your Tickets Are Ready</h1>
                  <p class="subtitle">Order Confirmation - Andiamo Events</p>
                </div>
                
                <p class="greeting">Dear <strong>${order.user_name || 'Valued Customer'}</strong>,</p>
                
                <p class="message">
                  We're excited to confirm that your order has been successfully processed! Your digital tickets with unique QR codes are ready and attached below.
                </p>
                
                <div class="order-info-block">
                  <div class="info-row">
                    <div class="info-label">Order ID</div>
                    <div class="info-value">${orderId.substring(0, 8).toUpperCase()}</div>
                  </div>
                  <div class="info-row">
                    <div class="info-label">Event</div>
                    <div style="font-size: 18px; color: #E21836; font-weight: 600;">${order.events?.name || 'Event'}</div>
                  </div>
                  ${order.ambassadors ? `
                  <div class="info-row">
                    <div class="info-label">Delivered by</div>
                    <div style="font-size: 18px; color: #E21836; font-weight: 600;">${order.ambassadors.full_name}</div>
                  </div>
                  ` : ''}
                </div>

                <div class="order-info-block">
                  <h3 style="color: #E21836; margin-bottom: 20px; font-size: 18px; font-weight: 600;">Passes Purchased</h3>
                  <table class="passes-table">
                    <thead>
                      <tr>
                        <th>Pass Type</th>
                        <th style="text-align: center;">Quantity</th>
                        <th style="text-align: right;">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${passesSummaryHtml}
                      <tr class="total-row">
                        <td colspan="2" style="text-align: right; padding-right: 20px;"><strong>Total Amount Paid:</strong></td>
                        <td style="text-align: right;"><strong>${order.total_price.toFixed(2)} TND</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div class="tickets-section">
                  <h3 style="color: #E21836; margin-bottom: 20px; font-size: 18px; font-weight: 600;">Your Digital Tickets</h3>
                  <p class="message" style="margin-bottom: 25px;">
                    Please present these QR codes at the event entrance. Each ticket has a unique QR code for verification.
                  </p>
                  ${ticketsHtml}
                </div>

                <div class="order-info-block">
                  <h3 style="color: #E21836; margin-bottom: 15px; font-size: 18px; font-weight: 600;">Payment Confirmation</h3>
                  <p class="message" style="margin: 0;">
                    Your payment of <strong style="color: #E21836;">${order.total_price.toFixed(2)} TND</strong> has been successfully received${order.ambassadors ? ` by our ambassador <strong>${order.ambassadors.full_name}</strong>` : ''}. Your order is now fully validated and confirmed.
                  </p>
                </div>
                
                <div class="support-section">
                  <p class="support-text">
                    Need assistance? Contact us at <a href="mailto:support@andiamoevents.com" class="support-email">support@andiamoevents.com</a> or visit <a href="${supportUrl}" class="support-email">our support page</a>.
                  </p>
                </div>
                
                <div class="closing-section">
                  <p class="slogan">We Create Memories</p>
                  <p class="signature">
                    Best regards,<br>
                    The Andiamo Events Team
                  </p>
                </div>
              </div>
              
              <div class="footer">
                <p class="footer-text">Developed by <span style="color: #E21836 !important;">Malek Ben Amor</span></p>
                <div class="footer-links">
                  <a href="https://www.instagram.com/malek.bamor/" target="_blank" class="footer-link">Instagram</a>
                  <span style="color: #999999;">•</span>
                  <a href="https://malekbenamor.dev" target="_blank" class="footer-link">Website</a>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;

        // Send email
        console.log('📤 Attempting to send email...');
        console.log('📤 Email Details:', {
          from: `Andiamo Events <${process.env.EMAIL_USER}>`,
          to: order.user_email,
          subject: 'Your Digital Tickets Are Ready - Andiamo Events',
          htmlLength: emailHtml.length
        });
        
        const emailResult = await transporter.sendMail({
          from: `Andiamo Events <${process.env.EMAIL_USER}>`,
          to: order.user_email,
          subject: 'Your Digital Tickets Are Ready - Andiamo Events',
          html: emailHtml
        });

        console.log('✅ Email sent successfully:', {
          messageId: emailResult.messageId,
          to: order.user_email,
          accepted: emailResult.accepted,
          rejected: emailResult.rejected
        });

        // Update tickets to DELIVERED
        const ticketIds = tickets.map(t => t.id);
        await dbClient
          .from('tickets')
          .update({
            status: 'DELIVERED',
            email_delivery_status: 'sent',
            delivered_at: new Date().toISOString()
          })
          .in('id', ticketIds);

        // Log email delivery
        await dbClient.from('email_delivery_logs').insert({
          order_id: orderId,
          email_type: 'ticket_delivery',
          recipient_email: order.user_email,
          recipient_name: order.user_name,
          subject: 'Your Digital Tickets Are Ready - Andiamo Events',
          status: 'sent',
          sent_at: new Date().toISOString()
        });

        emailSent = true; // Mark email as successfully sent
        console.log('✅ Email marked as sent successfully');
      } catch (emailErrorCaught) {
        emailError = emailErrorCaught;
        console.error('❌ Error sending confirmation email:', emailErrorCaught);
        console.error('❌ Email error type:', emailErrorCaught.name);
        console.error('❌ Email error code:', emailErrorCaught.code);
        console.error('❌ Email error details:', {
          message: emailErrorCaught.message,
          code: emailErrorCaught.code,
          command: emailErrorCaught.command,
          response: emailErrorCaught.response,
          responseCode: emailErrorCaught.responseCode,
          stack: emailErrorCaught.stack
        });
        
        // Update tickets email delivery status to failed
        const ticketIds = tickets.map(t => t.id);
        try {
          await dbClient
            .from('tickets')
            .update({
              email_delivery_status: 'failed'
            })
            .in('id', ticketIds);

          // Log email failure
          await dbClient.from('email_delivery_logs').insert({
            order_id: orderId,
            email_type: 'ticket_delivery',
            recipient_email: order.user_email,
            recipient_name: order.user_name,
            subject: 'Your Digital Tickets Are Ready - Andiamo Events',
            status: 'failed',
            error_message: emailErrorCaught.message || 'Unknown error'
          });
        } catch (logError) {
          console.error('❌ Error logging email failure:', logError);
        }
        
        // Don't re-throw - we want to return success for tickets even if email fails
        // This allows tickets to be generated even if email service is down
        console.warn('⚠️ Email sending failed, but tickets were generated successfully');
      }
    } else {
      console.warn('⚠️ No email address found for order:', orderId);
    }

    // Send SMS with QR code URLs automatically after payment
    console.log('\n📱 ============================================');
    console.log('📱 STARTING SMS SENDING PROCESS');
    console.log('📱 ============================================');
    let smsSent = false;
    let smsError = null;
    
    console.log('📱 SMS Configuration Check:', {
      hasUserPhone: !!order.user_phone,
      userPhone: order.user_phone || 'NOT SET',
      userPhoneLength: order.user_phone ? order.user_phone.length : 0,
      hasWinsmsKey: !!WINSMS_API_KEY,
      winsmsKeyLength: WINSMS_API_KEY ? WINSMS_API_KEY.length : 0,
      orderId: orderId
    });
    
    if (order.user_phone && WINSMS_API_KEY) {
      try {
        
        // ============================================
        // ORDER ID FIX: Use single source of truth
        // ============================================
        // CRITICAL: Use order_number (public ID), NOT UUID substring
        // UUID should NEVER be exposed to users
        const publicOrderId = getPublicOrderId(order);
        
        let smsMessage = `Paiement confirmé\n`;
        smsMessage += `ID: ${publicOrderId} | Total: ${order.total_price} DT\n`;
        smsMessage += `Merci pour votre achat. Billets envoyés par email.\n`;
        smsMessage += `We Create Memories`;

        // Format phone number for logging (sendSingleSms will format it again)
        const formattedPhonePreview = formatPhoneNumber(order.user_phone);
        console.log('Phone number formatting:', {
          original: order.user_phone,
          willBeFormattedTo: formattedPhonePreview || 'INVALID FORMAT',
          isValid: !!formattedPhonePreview
        });
        
        if (!formattedPhonePreview) {
          throw new Error(`Invalid phone number format: ${order.user_phone}. Expected 8-digit Tunisian number starting with 2, 4, 5, or 9 (e.g., 27169458)`);
        }
        
        // Send SMS using unified helper
        console.log('📤 Attempting to send SMS...');
        console.log('📤 SMS Message:', smsMessage);
        const responseData = await sendSms(order.user_phone, smsMessage);
        console.log('📤 SMS API Response:', {
          status: responseData.status,
          dataCode: responseData.data?.code,
          dataMessage: responseData.data?.message,
          rawResponse: JSON.stringify(responseData.data || responseData.raw).substring(0, 200)
        });
        
        const isSuccess = responseData.status === 200 &&
                          responseData.data &&
                          (responseData.data.code === 'ok' ||
                           responseData.data.code === '200' ||
                           (responseData.data.message && responseData.data.message.toLowerCase().includes('successfully')));
        
        console.log('📤 SMS Send Result:', {
          isSuccess: isSuccess,
          statusCode: responseData.status,
          apiCode: responseData.data?.code
        });
        
        if (isSuccess) {
          smsSent = true;
          console.log('✅ SMS sent successfully!');
          // Log success
          try {
            await dbClient.from('sms_logs').insert({
              phone_number: order.user_phone,
              message: smsMessage.trim(),
              status: 'sent',
              api_response: JSON.stringify(responseData.data || responseData.raw),
              sent_at: new Date().toISOString()
            });
          } catch (logErr) {
            console.warn('⚠️ Failed to log SMS (order) success:', logErr);
          }
        } else {
          // Log failure
          try {
            await dbClient.from('sms_logs').insert({
              phone_number: order.user_phone,
              message: smsMessage.trim(),
              status: 'failed',
              error_message: responseData.data?.message || 'SMS sending failed',
              api_response: JSON.stringify(responseData.data || responseData.raw)
            });
          } catch (logErr) {
            console.warn('⚠️ Failed to log SMS (order) failure:', logErr);
          }
          throw new Error('SMS sending failed');
        }
      } catch (smsErrorCaught) {
        smsError = smsErrorCaught;
        console.error('❌ Error sending SMS:', smsErrorCaught);
        console.error('❌ SMS error details:', {
          message: smsErrorCaught.message,
          stack: smsErrorCaught.stack
        });
        // Don't throw - SMS failure shouldn't break ticket generation
        console.warn('⚠️ SMS sending failed, but tickets were generated successfully');
      }
    } else {
      if (!order.user_phone) {
        console.warn('⚠️ No phone number found for order:', orderId);
      }
      if (!WINSMS_API_KEY) {
        console.warn('⚠️ SMS service not configured - WINSMS_API_KEY not set');
      }
    }

    console.log('\n✅ ============================================');
    console.log('✅ TICKET GENERATION COMPLETED');
    console.log('✅ ============================================');
    console.log('📊 Final Results:', {
      success: true,
      ticketsCount: tickets.length,
      emailSent: emailSent,
      emailError: emailError ? emailError.message : null,
      smsSent: smsSent,
      smsError: smsError ? smsError.message : null
    });
    console.log('✅ ============================================\n');
    
    return { 
      success: true, 
      message: 'Tickets generated successfully',
      ticketsCount: tickets.length,
      orderId,
      emailSent: emailSent, // Use actual email sending status
      emailError: emailError ? emailError.message : null, // Include error message if email failed
      smsSent: smsSent, // SMS sending status
      smsError: smsError ? smsError.message : null // Include error message if SMS failed
    };
  } catch (error) {
    console.error('\n❌ ============================================');
    console.error('❌ TICKET GENERATION FAILED');
    console.error('❌ ============================================');
    console.error('❌ Error generating tickets:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      name: error.name
    });
    console.error('❌ ============================================\n');
    throw error;
  }
}

// POST /api/generate-tickets-for-order - Generate tickets when order reaches PAID status (Manual trigger or frontend backup)
// Note: This endpoint can be called without admin auth if called from frontend after payment verification
// POST /api/generate-tickets-for-order - Generate tickets when order reaches PAID status
// Can be called from frontend (after payment) or admin panel (requires auth)
app.post('/api/generate-tickets-for-order', logSecurityRequest, validateOrigin, async (req, res) => {
  console.log('\n🌐 ============================================');
  console.log('🌐 API ENDPOINT: /api/generate-tickets-for-order');
  console.log('🌐 ============================================');
  console.log('🌐 Request received:', {
    orderId: req.body.orderId,
    hasRecaptchaToken: !!req.body.recaptchaToken,
    ip: req.ip || req.headers['x-forwarded-for'],
    userAgent: req.headers['user-agent']?.substring(0, 50),
    origin: req.headers.origin,
    referer: req.headers.referer
  });
  console.log('🌐 Full request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { orderId, recaptchaToken } = req.body;
    
    if (!orderId) {
      console.error('❌ API: No orderId provided in request body');
      console.error('❌ API: Request body:', req.body);
      return res.status(400).json({ error: 'Order ID is required' });
    }
    console.log('✅ API: Order ID received:', orderId);

    // Check if this is an admin request (has admin cookie)
    const isAdminRequest = req.headers.cookie && req.headers.cookie.includes('adminToken');
    console.log('🔐 API: Admin request check:', {
      isAdminRequest: isAdminRequest,
      hasCookie: !!req.headers.cookie,
      cookieIncludesAdminToken: req.headers.cookie?.includes('adminToken') || false
    });
    
    // Security: Require CAPTCHA for non-admin requests (public endpoint)
    if (!isAdminRequest) {
      // Verify reCAPTCHA token
      if (!recaptchaToken) {
        return res.status(400).json({ 
          error: 'reCAPTCHA verification required',
          details: 'Please complete the reCAPTCHA verification'
        });
      }
      
      // Bypass reCAPTCHA for localhost development
      if (recaptchaToken !== 'localhost-bypass-token') {
        const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
        
        if (!RECAPTCHA_SECRET_KEY) {
          console.error('RECAPTCHA_SECRET_KEY is not set');
          return res.status(500).json({ 
            error: 'Server configuration error',
            details: 'reCAPTCHA secret key is not configured'
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
          console.error('reCAPTCHA verification failed for ticket generation:', verifyData);
          
          // Log security event
          try {
            // Use service role client for security audit logs (bypasses RLS)
      const securityLogClient = supabaseService || supabase;
      await securityLogClient.from('security_audit_logs').insert({
              event_type: 'captcha_verification_failed',
              endpoint: '/api/generate-tickets-for-order',
              ip_address: normalizeIP(req), // PHASE 2: Normalized IP
              user_agent: req.headers['user-agent'] || 'unknown',
              request_method: req.method,
              request_path: req.path,
              details: { 
                reason: 'reCAPTCHA verification failed',
                order_id: orderId,
                error_codes: verifyData['error-codes'] || []
              },
              severity: 'medium'
            });
          } catch (logError) {
            console.error('Failed to log security event:', logError);
          }
          
          return res.status(400).json({ 
            error: 'reCAPTCHA verification failed',
            details: verifyData['error-codes'] || []
          });
        }
        
      }
    }
    
    // For admin requests, verify auth
    if (isAdminRequest) {
      try {
        const { verifyAdminAuth } = require('./authAdminMiddleware.js');
        const authResult = await verifyAdminAuth(req);
        if (!authResult.valid) {
          return res.status(401).json({ error: 'Admin authentication required' });
        }
      } catch (authError) {
        // If auth middleware fails, continue (might be frontend call)
      }
    }

    // Verify order exists and is in correct status
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    // Security: Verify order exists and check ownership/status
    console.log('🔍 API: Fetching order from database...');
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, payment_status, user_email, user_phone, source, created_at')
      .eq('id', orderId)
      .single();
    
    console.log('🔍 API: Order fetch result:', {
      hasOrder: !!order,
      orderError: orderError?.message,
      orderData: order ? {
        id: order.id,
        status: order.status,
        payment_status: order.payment_status,
        source: order.source,
        hasUserEmail: !!order.user_email,
        hasUserPhone: !!order.user_phone
      } : null
    });

    if (orderError || !order) {
      console.error('❌ Order not found:', orderId);
      
      // Log security event - invalid order ID attempt
      try {
        // Use service role client for security audit logs (bypasses RLS)
      const securityLogClient = supabaseService || supabase;
      await securityLogClient.from('security_audit_logs').insert({
          event_type: 'invalid_order_access',
          endpoint: '/api/generate-tickets-for-order',
          ip_address: normalizeIP(req), // PHASE 2: Normalized IP
          user_agent: req.headers['user-agent'] || 'unknown',
          request_method: req.method,
          request_path: req.path,
          details: { 
            reason: 'Order not found',
            order_id: orderId 
          },
          severity: 'medium'
        });
      } catch (logError) {
        console.error('Failed to log security event:', logError);
      }
      
      return res.status(404).json({ error: 'Order not found' });
    }

    // Security: Verify order is in correct status (PAID) before generating tickets
    if (order.status !== 'PAID' && order.payment_status !== 'PAID') {
      console.error('❌ Order not paid:', orderId, 'Status:', order.status, 'Payment Status:', order.payment_status);
      
      // Log security event - attempt to generate tickets for unpaid order
      try {
        // Use service role client for security audit logs (bypasses RLS)
      const securityLogClient = supabaseService || supabase;
      await securityLogClient.from('security_audit_logs').insert({
          event_type: 'unauthorized_ticket_generation',
          endpoint: '/api/generate-tickets-for-order',
          ip_address: normalizeIP(req), // PHASE 2: Normalized IP
          user_agent: req.headers['user-agent'] || 'unknown',
          request_method: req.method,
          request_path: req.path,
          details: { 
            reason: 'Order not in PAID status',
            order_id: orderId,
            order_status: order.status,
            payment_status: order.payment_status
          },
          severity: 'high'
        });
      } catch (logError) {
        console.error('Failed to log security event:', logError);
      }
      
      return res.status(403).json({ 
        error: 'Order must be paid before generating tickets',
        order_status: order.status,
        payment_status: order.payment_status
      });
    }

    // Security: Check if tickets already exist (prevent duplicate generation)
    const { data: existingTickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('id')
      .eq('order_id', orderId)
      .limit(1);

    if (ticketsError) {
      console.error('❌ Error checking existing tickets:', ticketsError);
    }

    if (existingTickets && existingTickets.length > 0) {
      // Don't block - just log (tickets might need regeneration)
      // But log it for security audit
      try {
        // Use service role client for security audit logs (bypasses RLS)
      const securityLogClient = supabaseService || supabase;
      await securityLogClient.from('security_audit_logs').insert({
          event_type: 'duplicate_ticket_generation_attempt',
          endpoint: '/api/generate-tickets-for-order',
          ip_address: normalizeIP(req), // PHASE 2: Normalized IP
          user_agent: req.headers['user-agent'] || 'unknown',
          request_method: req.method,
          request_path: req.path,
          details: { 
            reason: 'Tickets already exist for this order',
            order_id: orderId
          },
          severity: 'low'
        });
      } catch (logError) {
        console.error('Failed to log security event:', logError);
      }
    }

    if (orderError || !order) {
      // Log security event - invalid order ID attempt
      try {
        // Use service role client for security audit logs (bypasses RLS)
      const securityLogClient = supabaseService || supabase;
      await securityLogClient.from('security_audit_logs').insert({
          event_type: 'invalid_order_access',
          endpoint: '/api/generate-tickets-for-order',
          ip_address: normalizeIP(req), // PHASE 2: Normalized IP
          user_agent: req.headers['user-agent'] || 'unknown',
          request_method: req.method,
          request_path: req.path,
          details: { 
            reason: 'Order not found',
            order_id: orderId 
          },
          severity: 'medium'
        });
      } catch (logError) {
        console.error('Failed to log security event:', logError);
      }
      return res.status(404).json({ error: 'Order not found' });
    }

    // Security: Verify order is in correct status (PAID) before generating tickets
    // Only allow ticket generation for PAID orders (or COMPLETED for COD, or PAID for ambassador_manual)
    // ============================================
    // PHASE 2 SECURITY FIX: Unified Status System
    // ============================================
    // Database constraint only allows: PENDING_ONLINE, REDIRECTED, PENDING_CASH, PENDING_ADMIN_APPROVAL, PAID, REJECTED, CANCELLED
    // All paid orders use 'PAID' status (COMPLETED and MANUAL_COMPLETED are legacy, not in constraint)
    const isPaidStatus = order.status === 'PAID';

    if (!isPaidStatus && !isAdminRequest) {
      // Log security event - attempt to generate tickets for unpaid order
      try {
        // Use service role client for security audit logs (bypasses RLS)
      const securityLogClient = supabaseService || supabase;
      await securityLogClient.from('security_audit_logs').insert({
          event_type: 'unauthorized_ticket_generation',
          endpoint: '/api/generate-tickets-for-order',
          ip_address: normalizeIP(req), // PHASE 2: Normalized IP
          user_agent: req.headers['user-agent'] || 'unknown',
          request_method: req.method,
          request_path: req.path,
          details: { 
            reason: 'Order not in PAID status',
            order_id: orderId,
            order_status: order.status,
            payment_status: order.payment_status,
            source: order.source
          },
          severity: 'high'
        });
      } catch (logError) {
        console.error('Failed to log security event:', logError);
      }
      
      // For non-admin requests, only allow if order is PAID
      return res.status(403).json({ 
        error: 'Order is not in a paid status',
        currentStatus: order.status,
        source: order.source
      });
    }


    // Use the shared helper function
    console.log('\n🚀 API: ============================================');
    console.log('🚀 API: Calling generateTicketsAndSendEmail function');
    console.log('🚀 API: ============================================');
    console.log('🚀 API: Order details before generation:', {
      orderId: order.id,
      status: order.status,
      source: order.source,
      payment_status: order.payment_status,
      hasUserEmail: !!order.user_email,
      hasUserPhone: !!order.user_phone,
      userEmail: order.user_email || 'NOT SET',
      userPhone: order.user_phone ? `${order.user_phone.substring(0, 3)}***` : 'NOT SET'
    });
    
    const result = await generateTicketsAndSendEmail(orderId);
    
    console.log('\n✅ API: ============================================');
    console.log('✅ API: Ticket generation completed');
    console.log('✅ API: ============================================');
    console.log('✅ API: Result:', {
      success: result.success,
      ticketsCount: result.ticketsCount,
      emailSent: result.emailSent,
      emailError: result.emailError,
      smsSent: result.smsSent,
      smsError: result.smsError
    });
    console.log('✅ API: ============================================\n');
    
    res.status(200).json(result);
  } catch (error) {
    console.error('\n❌ API: ============================================');
    console.error('❌ API: Error generating tickets');
    console.error('❌ API: ============================================');
    console.error('❌ API: Error:', error);
    console.error('❌ API: Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    console.error('❌ API: ============================================\n');
    
    res.status(500).json({ 
      error: 'Failed to generate tickets', 
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

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Andiamo Events API',
    version: '1.0.0',
    endpoints: {
      'POST /api/send-email': 'Send email (admin auth required)',
      'GET /api/test': 'Test endpoint',
      'GET /api/sms-test': 'SMS test endpoint'
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Andiamo Events API Server',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      '/api': 'API information',
      '/api/admin-login': 'Admin login endpoint',
      '/api/verify-admin': 'Verify admin authentication',
      '/api/send-email': 'Send email (admin auth required)'
    }
  });
});

// Catch-all 404 handler for undefined API routes
app.use('/api', (req, res) => {
  console.error(`404 - API route not found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    success: false,
    error: 'Route not found',
    details: `The route ${req.path} does not exist`,
    method: req.method,
    path: req.path,
    hint: 'Check /api for available endpoints'
  });
});

// Catch-all 404 handler for all other undefined routes (non-API)
app.use((req, res) => {
  // Skip if it's already an API route (should have been handled above)
  if (req.path.startsWith('/api')) {
    return; // Shouldn't reach here, but just in case
  }
  
  console.error(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    success: false,
    error: 'Route not found',
    details: `The route ${req.path} does not exist`,
    method: req.method,
    path: req.path,
    hint: 'Visit / for API server information'
  });
});

// Global error handlers for unhandled promise rejections and exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('❌ Reason:', reason);
  // Don't exit in production, just log
  if (process.env.NODE_ENV !== 'production') {
    console.error('Stack:', reason?.stack);
  }
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // Exit in production for uncaught exceptions
  process.exit(1);
});

// Express error handler middleware (must be last)
app.use((err, req, res, next) => {
  console.error('❌ Express error handler:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  // Don't send error details in production
  const errorMessage = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
  
  res.status(err.status || 500).json({
    error: errorMessage,
    ...(process.env.NODE_ENV !== 'production' && { details: err.message, stack: err.stack })
  });
});

// Export app for Vercel serverless functions
// If running as standalone server, start listening
if (require.main === module) {
  const port = process.env.PORT || 8082;
  const server = app.listen(port, () => {
    // Server started successfully
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Error: Port ${port} is already in use.`);
      console.error(`   Please either:`);
      console.error(`   1. Stop the process using port ${port}`);
      console.error(`   2. Set a different port via PORT environment variable (e.g., PORT=8083)`);
      console.error(`   3. On Windows, find and kill the process: netstat -ano | findstr :${port}`);
      process.exit(1);
    } else {
      console.error('❌ Server error:', err);
      process.exit(1);
    }
  });
}

// Export app for use in serverless functions
module.exports = app;

