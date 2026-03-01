// Load environment variables first so SENTRY_DSN is available
try {
  require('dotenv').config();
} catch (e) {
  // dotenv might not be available
}

// Sentry must be initialized first for error tracking
const Sentry = require('@sentry/node');
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
    integrations: [Sentry.expressIntegration()],
  });
}

const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
// Import ipKeyGenerator helper for proper IPv6 handling
// In express-rate-limit v8+, ipKeyGenerator is a named export
const { ipKeyGenerator } = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const https = require('https');
const querystring = require('querystring');
const crypto = require('crypto');

// Import centralized SMS template helpers
const {
  buildClientOrderConfirmationSMS,
  buildAmbassadorNewOrderSMS,
  buildClientAdminApprovalSMS
} = require('./smsTemplates.cjs');

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

// CORS configuration - allow all origins in development, specific origins in production
const isDevelopment = process.env.NODE_ENV !== 'production';

// Default production origins (can be overridden via ALLOWED_ORIGINS env var)
// Include localhost for local dev when NODE_ENV=production (e.g. npm run dev with production build)
const defaultProductionOrigins = [
  'https://www.andiamoevents.com',
  'https://andiamoevents.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://172.20.10.4:3000',
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^http:\/\/172\.\d+\.\d+\.\d+:\d+$/,
  /^http:\/\/192\.168\.\d+\.\d+:\d+$/
];

const allowedOrigins = isDevelopment
  ? ['http://localhost:8080', 'http://localhost:3000', 'http://localhost:5173', 'http://192.168.1.*', 'http://10.0.*', 'http://127.0.0.1:3000', 'http://172.20.10.4:3000', /^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/, /^http:\/\/192\.168\.\d+\.\d+:\d+$/, /^http:\/\/172\.\d+\.\d+\.\d+:\d+$/]
  : (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : defaultProductionOrigins);

// Shared CORS utility function for API routes
// This function can be used by serverless functions that don't use the Express cors middleware
function getCorsOrigin(req) {
  const origin = req.headers.origin || req.headers.referer?.split('/').slice(0, 3).join('/');
  
  if (isDevelopment) {
    return origin || '*';
  }
  
  if (!origin) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    return '*';
  }
  
  // Check if origin matches allowed patterns
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
  
  if (isAllowed) {
    return origin;
  }
  
  // On Vercel, allow same-origin requests
  const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_URL;
  if (isVercel && origin && (origin.includes(process.env.VERCEL_URL || '') || origin.includes(process.env.VERCEL_BRANCH_URL || ''))) {
    return origin;
  }
  
  // Default: return null to indicate origin not allowed
  return null;
}

// Shared function to set CORS headers (for use in API routes)
function setCORSHeaders(res, req, options = {}) {
  const origin = getCorsOrigin(req);
  
  if (origin === null) {
    // Origin not allowed - don't set CORS headers
    return false;
  }
  
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', options.methods || 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', options.headers || 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
  
  return true;
}

app.use(cors({
  origin: (origin, callback) => {
    // In development, allow all origins (including no origin)
    if (isDevelopment) {
      console.log('🌐 CORS: Development mode - allowing origin:', origin || 'no origin');
      return callback(null, true);
    }
    
    // Allow requests with no origin (like mobile apps or curl requests) in production too
    if (!origin) {
      console.log('🌐 CORS: No origin - allowing request');
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
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Security: Security headers middleware
// Adds security headers to all responses (for API routes)
app.use((req, res, next) => {
  // Set security headers
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  // HSTS: only over HTTPS (browsers ignore on HTTP; avoid sending when behind HTTP proxy)
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (isSecure) {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  
  // CSP Report-Only (will be switched to enforcing after monitoring)
  const cspPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' https: data:",
    "font-src 'self' https: data:",
    "style-src 'self' 'unsafe-inline' https:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: https://www.clarity.ms https://scripts.clarity.ms",
    "connect-src 'self' https: wss: *.supabase.co *.supabase.in *.google.com *.gstatic.com *.vercel-analytics.com *.vercel-insights.com *.clarity.ms https://c.bing.com",
    "frame-src 'self' https: *.google.com",
    "report-uri /api/csp-report"
  ].join('; ');
  res.setHeader('Content-Security-Policy-Report-Only', cspPolicy);
  
  next();
});

// Security: Request logging middleware for security audit
// Logs all requests to sensitive endpoints for security auditing
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
    responseBody = typeof body === 'string' ? body.substring(0, 500) : JSON.stringify(body).substring(0, 500);
    responseStatus = res.statusCode || 200;
    return originalSend.call(this, body);
  };
  
  res.json = function(body) {
    responseBody = JSON.stringify(body).substring(0, 500);
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
      let sanitizedBody = null;
      if (req.body) {
        const bodyCopy = { ...req.body };
        // Remove sensitive fields
        if (bodyCopy.password) bodyCopy.password = '[REDACTED]';
        if (bodyCopy.token) bodyCopy.token = bodyCopy.token.substring(0, 10) + '...';
        if (bodyCopy.recaptchaToken) bodyCopy.recaptchaToken = '[REDACTED]';
        sanitizedBody = bodyCopy;
      }
      
      // Use service role client for security audit logs (bypasses RLS)
      const securityLogClient = supabaseService || supabase;
      await securityLogClient.from('security_audit_logs').insert({
        event_type: 'api_request',
        endpoint: req.path,
        ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
        user_agent: req.headers['user-agent'] || 'unknown',
        request_method: req.method,
        request_path: req.path,
        request_body: sanitizedBody,
        response_status: responseStatus,
        details: {
          query_params: req.query,
          headers: {
            origin: req.headers.origin,
            referer: req.headers.referer,
            'content-type': req.headers['content-type']
          }
        },
        severity: severity
      });
    } catch (logError) {
      // Don't fail the request if logging fails
      console.error('Failed to log security request:', logError);
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
        ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
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
        ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
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
    user: user.trim(), // Remove any whitespace - should be full email: Contact@andiamoevents.com
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
// Wrap in try/catch so require(server.cjs) does not throw when email env is missing
// (e.g. in Vercel serverless api/scan.js); scan routes do not use email.
let transporter = null;
try {
  transporter = getEmailTransporter();
} catch (e) {
  if (process.env.VERCEL !== '1' && !process.env.VERCEL_URL) {
    console.warn('Email not configured (transporter null):', e.message);
  }
}

// Security: Monitoring and alerting for suspicious activity
const checkSuspiciousActivity = async (eventType, details, req) => {
  if (!supabase) return;
  
  try {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
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
          // CRITICAL: Brevo SMTP restriction - The SMTP login (EMAIL_USER) must NEVER be used as the "from" address.
          // Emails must be sent from a verified sender domain. Use contact@andiamoevents.com instead.
          await transporter.sendMail({
            from: '"Andiamo Events Security" <contact@andiamoevents.com>',
            replyTo: '"Andiamo Events" <contact@andiamoevents.com>',
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

const scannerLoginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again later.' },
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
          ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
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
const smsLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 SMS requests per hour per IP
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
          ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
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
    
    // CRITICAL: Brevo SMTP restriction - The SMTP login (EMAIL_USER) must NEVER be used as the "from" address.
    // Emails must be sent from a verified sender domain. Use contact@andiamoevents.com instead.
    await transporter.sendMail({
      from: '"Andiamo Events" <contact@andiamoevents.com>',
      replyTo: '"Andiamo Events" <contact@andiamoevents.com>',
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
      sameSite: 'lax', // More permissive for cross-site requests
      path: '/', // Ensure cookie is available for all paths
      maxAge: 60 * 60 * 1000 // 1 hour (matches JWT expiration) - fixed expiration, cannot be extended
    };
    
    // Only set domain in production or if explicitly configured
    // Don't set domain for localhost - it breaks cookie setting
    if (isProduction && process.env.COOKIE_DOMAIN) {
      cookieOptions.domain = process.env.COOKIE_DOMAIN;
    }
    
    res.cookie('adminToken', token, cookieOptions);
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

// ============================================
// SCAN SYSTEM & SCANNER (never trust frontend)
// ============================================

// GET /api/scan-system-status — public, returns only { enabled }. Scanner app uses this when disabled.
app.get('/api/scan-system-status', async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ enabled: false });
    const db = supabaseService || supabase;
    const { data: row, error } = await db.from('scan_system_config').select('scan_enabled').limit(1).single();
    if (error || !row) return res.json({ enabled: false });
    return res.json({ enabled: !!row.scan_enabled });
  } catch (e) {
    return res.json({ enabled: false });
  }
});

// POST /api/scanner-login — rate limited. Password checked server-side only; never trust client.
app.post('/api/scanner-login', scannerLoginLimiter, async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Service unavailable' });
    const db = supabaseService || supabase;
    const { email, password } = req.body || {};
    const em = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const pw = typeof password === 'string' ? password : '';
    if (!em || !pw) return res.status(400).json({ error: 'Email and password required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return res.status(400).json({ error: 'Invalid email' });
    if (pw.length < 6) return res.status(400).json({ error: 'Invalid credentials' });
    const { data: sc, error: e } = await db.from('scanners').select('id, email, name, password_hash, is_active').eq('email', em).single();
    if (e || !sc || !sc.is_active) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(pw, sc.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret && process.env.NODE_ENV === 'production') return res.status(500).json({ error: 'Server error' });
    const token = jwt.sign({ scannerId: sc.id, email: sc.email, type: 'scanner' }, jwtSecret || 'fallback-secret-dev-only', { expiresIn: '8h' });
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('scannerToken', token, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: 8 * 60 * 60 * 1000 });
    return res.json({ success: true, scanner: { id: sc.id, email: sc.email, name: sc.name } });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/scanner-logout
app.post('/api/scanner-logout', (req, res) => {
  res.clearCookie('scannerToken', { path: '/' });
  return res.json({ success: true });
});

// PATCH /api/admin/scan-system-config — super_admin only. Body: { scan_enabled: boolean }
app.patch('/api/admin/scan-system-config', requireAdminAuth, requireSuperAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
    const v = req.body && req.body.scan_enabled;
    const scan_enabled = v === true || v === 'true';
    const db = supabaseService || supabase;
    const { data: cfg } = await db.from('scan_system_config').select('id').limit(1).single();
    if (!cfg) return res.status(500).json({ error: 'Config not found' });
    const { error } = await db.from('scan_system_config').update({ scan_enabled, updated_by: req.admin.id, updated_at: new Date().toISOString() }).eq('id', cfg.id);
    if (error) return res.status(500).json({ error: 'Update failed' });
    return res.json({ success: true, enabled: scan_enabled });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
});

// GET /api/admin/scan-system-config — super_admin only, for Scanners tab (enabled, updated_at, updated_by)
app.get('/api/admin/scan-system-config', requireAdminAuth, requireSuperAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
    const db = supabaseService || supabase;
    const { data: r, error } = await db.from('scan_system_config').select('scan_enabled, updated_at, updated_by').limit(1).single();
    if (error || !r) return res.json({ enabled: false, updated_at: null, updated_by: null });
    let name = null;
    if (r.updated_by) {
      const { data: a } = await db.from('admins').select('name').eq('id', r.updated_by).single();
      if (a) name = a.name;
    }
    return res.json({ enabled: !!r.scan_enabled, updated_at: r.updated_at, updated_by: r.updated_by, updated_by_name: name });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
});

// GET /api/admin/scanners — super_admin only
app.get('/api/admin/scanners', requireAdminAuth, requireSuperAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
    const db = supabaseService || supabase;
    const { data: rows, error } = await db.from('scanners').select('id, name, email, is_active, created_by, created_at').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const adminIds = [...new Set((rows || []).map(r => r.created_by).filter(Boolean))];
    let names = {};
    if (adminIds.length) {
      const { data: adm } = await db.from('admins').select('id, name').in('id', adminIds);
      (adm || []).forEach(a => { names[a.id] = a.name; });
    }
    const list = (rows || []).map(r => ({ ...r, created_by_name: names[r.created_by] || null }));
    return res.json({ scanners: list });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
});

// POST /api/admin/scanners — super_admin only. Body: { name, email, password }
app.post('/api/admin/scanners', requireAdminAuth, requireSuperAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
    const { name, email, password } = req.body || {};
    const n = typeof name === 'string' ? name.trim() : '';
    const em = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const pw = typeof password === 'string' ? password : '';
    if (!n || !em || !pw) return res.status(400).json({ error: 'Name, email and password required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return res.status(400).json({ error: 'Invalid email' });
    if (pw.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const db = supabaseService || supabase;
    const { data: ex } = await db.from('scanners').select('id').eq('email', em).single();
    if (ex) return res.status(400).json({ error: 'Email already used' });
    const hash = await bcrypt.hash(pw, 10);
    const { data: ins, error } = await db.from('scanners').insert({ name: n, email: em, password_hash: hash, created_by: req.admin.id }).select('id, name, email, is_active, created_at').single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(ins);
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/admin/scanners/:id — super_admin only. Body: { name?, email?, is_active?, password? } (password optional)
app.patch('/api/admin/scanners/:id', requireAdminAuth, requireSuperAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
    const id = req.params.id;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Invalid id' });
    const { name, email, is_active, password } = req.body || {};
    const db = supabaseService || supabase;
    const up = {};
    if (typeof name === 'string' && name.trim()) up.name = name.trim();
    if (typeof email === 'string' && email.trim()) { const e = email.trim().toLowerCase(); if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) up.email = e; }
    if (typeof is_active === 'boolean') up.is_active = is_active;
    if (typeof password === 'string' && password.length >= 8) up.password_hash = await bcrypt.hash(password, 10);
    if (Object.keys(up).length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    up.updated_at = new Date().toISOString();
    if (up.email) {
      const { data: ex } = await db.from('scanners').select('id').eq('email', up.email).neq('id', id).single();
      if (ex) return res.status(400).json({ error: 'Email already used' });
    }
    const { data: u, error } = await db.from('scanners').update(up).eq('id', id).select('id, name, email, is_active, updated_at').single();
    if (error) return res.status(500).json({ error: error.message });
    if (!u) return res.status(404).json({ error: 'Not found' });
    return res.json(u);
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/admin/scanners/:id — super_admin only (soft: set is_active=false or hard delete)
app.delete('/api/admin/scanners/:id', requireAdminAuth, requireSuperAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
    const id = req.params.id;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Invalid id' });
    const db = supabaseService || supabase;
    const { error } = await db.from('scanners').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
});

// POST /api/scanner/validate-ticket — requireScannerAuth. scanner_id from JWT only. Check scan_enabled. secure_token -> qr_tickets.
app.post('/api/scanner/validate-ticket', requireScannerAuth, async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ success: false, result: 'error', message: 'Service unavailable' });
    const db = supabaseService || supabase;
    const { data: cfg } = await db.from('scan_system_config').select('scan_enabled').limit(1).single();
    if (!cfg || !cfg.scan_enabled) return res.status(503).json({ success: false, enabled: false, message: 'Scan system is not started', result: 'disabled' });
    const scannerId = req.scanner.scannerId;
    const { secure_token, event_id, scan_location, device_info } = req.body || {};
    const st = typeof secure_token === 'string' ? secure_token.trim() : '';
    const ev = typeof event_id === 'string' ? event_id.trim() : '';
    if (!st) return res.status(400).json({ success: false, result: 'invalid', message: 'secure_token required' });
    if (!ev || !/^[0-9a-f-]{36}$/i.test(ev)) return res.status(400).json({ success: false, result: 'invalid', message: 'event_id required and must be UUID' });
    const sl = typeof scan_location === 'string' ? scan_location.trim().slice(0, 500) : null;
    const di = typeof device_info === 'string' ? device_info.trim().slice(0, 500) : null;
    const { data: qt, error: qtErr } = await db.from('qr_tickets').select('*').eq('secure_token', st).single();
    if (qtErr || !qt) {
      await db.from('scans').insert({ event_id: ev, scanner_id: scannerId, scan_result: 'invalid', scan_location: sl, device_info: di, notes: 'Token not found' });
      return res.status(200).json({ success: false, result: 'invalid', message: 'Ticket not found' });
    }
    const now = new Date();
    const evId = qt.event_id ? String(qt.event_id) : null;
    if (evId && evId !== ev) {
      await db.from('scans').insert({ event_id: ev, scanner_id: scannerId, qr_ticket_id: qt.id, scan_result: 'wrong_event', scan_location: sl, device_info: di, ambassador_id: qt.ambassador_id, notes: 'Wrong event' });
      return res.status(200).json({ success: false, result: 'wrong_event', message: 'This ticket is for a different event', correct_event: { event_id: evId, event_name: qt.event_name || null, event_date: qt.event_date || null } });
    }
    const { data: existing } = await db.from('scans').select('id, scan_time, scanner_id').eq('qr_ticket_id', qt.id).eq('scan_result', 'valid').limit(1).single();
    if (existing) {
      let prevName = 'Unknown';
      if (existing.scanner_id) { const { data: sn } = await db.from('scanners').select('name').eq('id', existing.scanner_id).single(); if (sn) prevName = sn.name; }
      await db.from('scans').insert({ event_id: ev, scanner_id: scannerId, qr_ticket_id: qt.id, scan_result: 'already_scanned', scan_location: sl, device_info: di, ambassador_id: qt.ambassador_id, notes: 'Duplicate' });
      const isInvDup = qt.source === 'official_invitation';
      let invDup = null;
      if (isInvDup && qt.invitation_id) { const { data: id } = await db.from('official_invitations').select('invitation_number, recipient_name, recipient_phone, recipient_email').eq('id', qt.invitation_id).single(); invDup = id; }
      const ticketDup = isInvDup ? {
        is_invitation: true,
        pass_type: qt.pass_type || null,
        invitation_number: invDup?.invitation_number || null,
        recipient_name: invDup?.recipient_name || qt.buyer_name || null,
        recipient_phone: invDup?.recipient_phone || qt.buyer_phone || null,
        recipient_email: invDup?.recipient_email || qt.buyer_email || null,
      } : undefined;
      return res.status(200).json({ success: false, result: 'already_scanned', message: 'Ticket already scanned', previous_scan: { scanned_at: existing.scan_time, scanner_name: prevName }, ...(ticketDup && { ticket: ticketDup }) });
    }
    await db.from('qr_tickets').update({ ticket_status: 'USED', updated_at: now.toISOString() }).eq('id', qt.id);
    const { data: scanRow } = await db.from('scans').insert({ event_id: ev, scanner_id: scannerId, qr_ticket_id: qt.id, scan_result: 'valid', scan_location: sl, device_info: di, ambassador_id: qt.ambassador_id, notes: 'Valid' }).select('scan_time').single();
    const isInv = qt.source === 'official_invitation';
    let invData = null;
    if (isInv && qt.invitation_id) {
      const { data: inv } = await db.from('official_invitations').select('invitation_number, recipient_name, recipient_phone, recipient_email').eq('id', qt.invitation_id).single();
      invData = inv;
    }
    const ticket = {
      pass_type: qt.pass_type || null,
      buyer_name: qt.buyer_name || null,
      ambassador_name: isInv ? null : (qt.ambassador_name || null),
      event_name: qt.event_name || null,
      event_date: qt.event_date || null,
      event_venue: qt.event_venue || null,
      is_invitation: isInv,
      source: qt.source || null,
      scanned_at: (scanRow && scanRow.scan_time) || now.toISOString(),
      ...(isInv && {
        invitation_number: invData?.invitation_number || null,
        recipient_name: invData?.recipient_name || qt.buyer_name || null,
        recipient_phone: invData?.recipient_phone || qt.buyer_phone || null,
        recipient_email: invData?.recipient_email || qt.buyer_email || null,
      }),
    };
    return res.status(200).json({ success: true, result: 'valid', message: 'Ticket validated', ticket });
  } catch (e) {
    return res.status(500).json({ success: false, result: 'error', message: 'Server error' });
  }
});

// GET /api/scanner/events — requireScannerAuth. scan_enabled checked; return upcoming only.
app.get('/api/scanner/events', requireScannerAuth, async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
    const db = supabaseService || supabase;
    const { data: cfg } = await db.from('scan_system_config').select('scan_enabled').limit(1).single();
    if (!cfg || !cfg.scan_enabled) return res.status(503).json({ error: 'Scan system is not started', enabled: false });
    const now = new Date().toISOString();
    const { data: rows, error } = await db.from('events').select('id, name, date, venue, city').eq('event_type', 'upcoming').gte('date', now).order('date', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ events: rows || [] });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
});

// GET /api/scanner/scans — requireScannerAuth. scanner_id from JWT only; never from query.
app.get('/api/scanner/scans', requireScannerAuth, async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
    const db = supabaseService || supabase;
    const scannerId = req.scanner.scannerId;
    const event_id = typeof req.query.event_id === 'string' ? req.query.event_id.trim() : null;
    const date_from = typeof req.query.date_from === 'string' ? req.query.date_from : null;
    const date_to = typeof req.query.date_to === 'string' ? req.query.date_to : null;
    const scan_result = typeof req.query.scan_result === 'string' ? req.query.scan_result.trim() : null;
    let q = db.from('scans').select('id, scan_time, scan_result, scan_location, event_id, qr_ticket_id', { count: 'exact' }).eq('scanner_id', scannerId).order('scan_time', { ascending: false }).range(0, 99);
    if (event_id && /^[0-9a-f-]{36}$/i.test(event_id)) q = q.eq('event_id', event_id);
    if (date_from) q = q.gte('scan_time', date_from);
    if (date_to) q = q.lte('scan_time', date_to);
    if (['valid','invalid','already_scanned','wrong_event'].includes(scan_result)) q = q.eq('scan_result', scan_result);
    const { data: rows, error, count } = await q;
    if (error) return res.status(500).json({ error: error.message });
    const ids = (rows || []).map(r => r.qr_ticket_id).filter(Boolean);
    let extra = {};
    if (ids.length) {
      const { data: qr } = await db.from('qr_tickets').select('id, buyer_name, pass_type, ambassador_name, event_name').in('id', ids);
      (qr || []).forEach(q => { extra[q.id] = q; });
    }
    const list = (rows || []).map(r => ({ ...r, buyer_name: (r.qr_ticket_id && extra[r.qr_ticket_id]) ? extra[r.qr_ticket_id].buyer_name : null, pass_type: (r.qr_ticket_id && extra[r.qr_ticket_id]) ? extra[r.qr_ticket_id].pass_type : null, ambassador_name: (r.qr_ticket_id && extra[r.qr_ticket_id]) ? extra[r.qr_ticket_id].ambassador_name : null, event_name: (r.qr_ticket_id && extra[r.qr_ticket_id]) ? extra[r.qr_ticket_id].event_name : null }));
    return res.json({ scans: list, total: count != null ? count : list.length });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
});

// GET /api/scanner/statistics — requireScannerAuth. scanner_id from JWT only.
app.get('/api/scanner/statistics', requireScannerAuth, async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
    const db = supabaseService || supabase;
    const scannerId = req.scanner.scannerId;
    const event_id = typeof req.query.event_id === 'string' ? req.query.event_id.trim() : null;
    const date_from = typeof req.query.date_from === 'string' ? req.query.date_from : null;
    const date_to = typeof req.query.date_to === 'string' ? req.query.date_to : null;
    let q = db.from('scans').select('scan_result, qr_ticket_id').eq('scanner_id', scannerId);
    if (event_id && /^[0-9a-f-]{36}$/i.test(event_id)) q = q.eq('event_id', event_id);
    if (date_from) q = q.gte('scan_time', date_from);
    if (date_to) q = q.lte('scan_time', date_to);
    const { data: rows, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    const total = (rows || []).length;
    const byStatus = { valid: 0, invalid: 0, already_scanned: 0, wrong_event: 0 };
    (rows || []).forEach(r => { if (byStatus[r.scan_result] != null) byStatus[r.scan_result]++; });
    const qids = (rows || []).map(r => r.qr_ticket_id).filter(Boolean);
    let byPass = {};
    if (qids.length) {
      const { data: qr } = await db.from('qr_tickets').select('id, pass_type').in('id', qids);
      (qr || []).forEach(q => { byPass[q.pass_type] = (byPass[q.pass_type] || 0) + 1; });
    }
    return res.json({ total, byStatus, byPass });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
});

// GET /api/admin/scanners/:id/scans — super_admin
app.get('/api/admin/scanners/:id/scans', requireAdminAuth, requireSuperAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
    const id = req.params.id;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Invalid id' });
    const db = supabaseService || supabase;
    const event_id = typeof req.query.event_id === 'string' ? req.query.event_id.trim() : null;
    const date_from = typeof req.query.date_from === 'string' ? req.query.date_from : null;
    const date_to = typeof req.query.date_to === 'string' ? req.query.date_to : null;
    const scan_result = typeof req.query.scan_result === 'string' ? req.query.scan_result.trim() : null;
    let q = db.from('scans').select('id, scan_time, scan_result, scan_location, event_id, qr_ticket_id, scanner_id', { count: 'exact' }).eq('scanner_id', id).order('scan_time', { ascending: false }).range(0, 199);
    if (event_id && /^[0-9a-f-]{36}$/i.test(event_id)) q = q.eq('event_id', event_id);
    if (date_from) q = q.gte('scan_time', date_from);
    if (date_to) q = q.lte('scan_time', date_to);
    if (['valid','invalid','already_scanned','wrong_event'].includes(scan_result)) q = q.eq('scan_result', scan_result);
    const { data: rows, error, count } = await q;
    if (error) return res.status(500).json({ error: error.message });
    const qids = (rows || []).map(r => r.qr_ticket_id).filter(Boolean);
    let extra = {};
    if (qids.length) { const { data: qr } = await db.from('qr_tickets').select('id, buyer_name, pass_type, ambassador_name, event_name').in('id', qids); (qr || []).forEach(q => { extra[q.id] = q; }); }
    const list = (rows || []).map(r => ({ ...r, buyer_name: (r.qr_ticket_id && extra[r.qr_ticket_id]) ? extra[r.qr_ticket_id].buyer_name : null, pass_type: (r.qr_ticket_id && extra[r.qr_ticket_id]) ? extra[r.qr_ticket_id].pass_type : null, ambassador_name: (r.qr_ticket_id && extra[r.qr_ticket_id]) ? extra[r.qr_ticket_id].ambassador_name : null, event_name: (r.qr_ticket_id && extra[r.qr_ticket_id]) ? extra[r.qr_ticket_id].event_name : null })); 
    return res.json({ scans: list, total: count != null ? count : list.length });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
});

// GET /api/admin/scanners/:id/statistics — super_admin
app.get('/api/admin/scanners/:id/statistics', requireAdminAuth, requireSuperAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
    const id = req.params.id;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Invalid id' });
    const db = supabaseService || supabase;
    let q = db.from('scans').select('scan_result, qr_ticket_id').eq('scanner_id', id);
    const event_id = typeof req.query.event_id === 'string' ? req.query.event_id.trim() : null;
    if (event_id && /^[0-9a-f-]{36}$/i.test(event_id)) q = q.eq('event_id', event_id);
    const { data: rows, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    const total = (rows || []).length;
    const byStatus = { valid: 0, invalid: 0, already_scanned: 0, wrong_event: 0 };
    (rows || []).forEach(r => { if (byStatus[r.scan_result] != null) byStatus[r.scan_result]++; });
    const qids = (rows || []).map(r => r.qr_ticket_id).filter(Boolean);
    let byPass = {}; if (qids.length) { const { data: qr } = await db.from('qr_tickets').select('id, pass_type').in('id', qids); (qr || []).forEach(q => { byPass[q.pass_type] = (byPass[q.pass_type] || 0) + 1; }); }
    return res.json({ total, byStatus, byPass });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
});

// GET /api/admin/scan-history — super_admin. Filters: scanner_id, event_id, date_from, date_to, scan_result
// Fallback: if qr_ticket_id/scanner_id are missing (migration 20250804000000 not run), use base columns only.
app.get('/api/admin/scan-history', requireAdminAuth, requireSuperAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
    const db = supabaseService || supabase;
    const scanner_id = typeof req.query.scanner_id === 'string' ? req.query.scanner_id.trim() : null;
    const event_id = typeof req.query.event_id === 'string' ? req.query.event_id.trim() : null;
    const date_from = typeof req.query.date_from === 'string' ? req.query.date_from : null;
    const date_to = typeof req.query.date_to === 'string' ? req.query.date_to : null;
    const scan_result = typeof req.query.scan_result === 'string' ? req.query.scan_result.trim() : null;
    const buildQuery = (cols) => {
      let q = db.from('scans').select(cols, { count: 'exact' }).order('scan_time', { ascending: false }).range(0, 199);
      if (scanner_id && /^[0-9a-f-]{36}$/i.test(scanner_id) && cols.includes('scanner_id')) q = q.eq('scanner_id', scanner_id);
      if (event_id && /^[0-9a-f-]{36}$/i.test(event_id)) q = q.eq('event_id', event_id);
      if (date_from) q = q.gte('scan_time', date_from);
      if (date_to) q = q.lte('scan_time', date_to);
      if (['valid','invalid','already_scanned','wrong_event'].includes(scan_result)) q = q.eq('scan_result', scan_result);
      return q;
    };
    let q = buildQuery('id, scan_time, scan_result, scan_location, event_id, qr_ticket_id, scanner_id');
    let { data: rows, error, count } = await q;
    if (error && /qr_ticket_id|scanner_id|does not exist/i.test((error.message || ''))) {
      q = buildQuery('id, scan_time, scan_result, scan_location, event_id');
      const r2 = await q;
      rows = r2.data;
      error = r2.error;
      count = r2.count;
    }
    if (error) {
      console.error('[/api/admin/scan-history]', error.message);
      return res.status(500).json({ error: error.message });
    }
    const hasScannerCols = rows && rows[0] && ('qr_ticket_id' in rows[0] || 'scanner_id' in rows[0]);
    const qids = hasScannerCols ? (rows || []).map(r => r.qr_ticket_id).filter(Boolean) : [];
    const sids = hasScannerCols ? (rows || []).map(r => r.scanner_id).filter(Boolean) : [];
    let qr = {}, sc = {};
    if (qids.length) { const { data: qrData } = await db.from('qr_tickets').select('id, buyer_name, pass_type, ambassador_name, event_name').in('id', qids); (qrData || []).forEach(q => { qr[q.id] = q; }); }
    if (sids.length) { const { data: scData } = await db.from('scanners').select('id, name').in('id', sids); (scData || []).forEach(s => { sc[s.id] = s; }); }
    const list = (rows || []).map(r => ({
      ...r,
      buyer_name: (r.qr_ticket_id && qr[r.qr_ticket_id]) ? qr[r.qr_ticket_id].buyer_name : null,
      pass_type: (r.qr_ticket_id && qr[r.qr_ticket_id]) ? qr[r.qr_ticket_id].pass_type : null,
      ambassador_name: (r.qr_ticket_id && qr[r.qr_ticket_id]) ? qr[r.qr_ticket_id].ambassador_name : null,
      event_name: (r.qr_ticket_id && qr[r.qr_ticket_id]) ? qr[r.qr_ticket_id].event_name : null,
      scanner_name: (r.scanner_id && sc[r.scanner_id]) ? sc[r.scanner_id].name : null
    }));
    return res.json({ scans: list, total: count != null ? count : list.length });
  } catch (e) {
    console.error('[/api/admin/scan-history]', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/scan-statistics — super_admin
// Fallback: if qr_ticket_id/scanner_id are missing (migration 20250804000000 not run), use scan_result only.
app.get('/api/admin/scan-statistics', requireAdminAuth, requireSuperAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
    const db = supabaseService || supabase;
    const scanner_id = typeof req.query.scanner_id === 'string' ? req.query.scanner_id.trim() : null;
    const event_id = typeof req.query.event_id === 'string' ? req.query.event_id.trim() : null;
    const date_from = typeof req.query.date_from === 'string' ? req.query.date_from : null;
    const date_to = typeof req.query.date_to === 'string' ? req.query.date_to : null;
    const buildQuery = (cols) => {
      let q = db.from('scans').select(cols);
      if (scanner_id && /^[0-9a-f-]{36}$/i.test(scanner_id) && cols.includes('scanner_id')) q = q.eq('scanner_id', scanner_id);
      if (event_id && /^[0-9a-f-]{36}$/i.test(event_id)) q = q.eq('event_id', event_id);
      if (date_from) q = q.gte('scan_time', date_from);
      if (date_to) q = q.lte('scan_time', date_to);
      return q;
    };
    let q = buildQuery('scan_result, qr_ticket_id, scanner_id');
    let { data: rows, error } = await q;
    if (error && /qr_ticket_id|scanner_id|does not exist/i.test((error.message || ''))) {
      const r2 = await buildQuery('scan_result');
      rows = r2.data;
      error = r2.error;
    }
    if (error) {
      console.error('[/api/admin/scan-statistics]', error.message);
      return res.status(500).json({ error: error.message });
    }
    const total = (rows || []).length;
    const byStatus = { valid: 0, invalid: 0, already_scanned: 0, wrong_event: 0 };
    const byScanner = {};
    (rows || []).forEach(r => {
      if (byStatus[r.scan_result] != null) byStatus[r.scan_result]++;
      if (r.scanner_id) byScanner[r.scanner_id] = (byScanner[r.scanner_id] || 0) + 1;
    });
    const hasQrCol = rows && rows[0] && ('qr_ticket_id' in rows[0]);
    const qids = hasQrCol ? (rows || []).map(r => r.qr_ticket_id).filter(Boolean) : [];
    let byPass = {};
    if (qids.length) { const { data: qr } = await db.from('qr_tickets').select('id, pass_type').in('id', qids); (qr || []).forEach(q => { byPass[q.pass_type] = (byPass[q.pass_type] || 0) + 1; }); }
    return res.json({ total, byStatus, byPass, byScanner });
  } catch (e) {
    console.error('[/api/admin/scan-statistics]', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Admin logs endpoint - Read-only, admin-only access
// Aggregates logs from site_logs, security_audit_logs, sms_logs, and email_delivery_logs
app.get('/api/admin/logs', requireAdminAuth, async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ 
      error: 'Supabase not configured',
      details: 'Please check SUPABASE_URL and SUPABASE_ANON_KEY environment variables'
    });
  }

  try {
    // Parse query parameters (all optional)
    const {
      type,           // log_type: info, warning, error, success, action
      category,       // category filter
      userRole,      // user_type: admin, ambassador, guest
      userId,        // user_id UUID
      startDate,     // ISO date string
      endDate,       // ISO date string
      search,        // Full-text search on message
      limit = '50',  // Pagination limit (default 50, max 200)
      offset = '0',  // Pagination offset
      sortBy = 'time', // Sort by: time, type
      order = 'desc'  // Sort order: asc, desc
    } = req.query;

    // Validate and sanitize inputs
    const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);
    const sortOrder = order === 'asc' ? 'asc' : 'desc';
    
    // Validate date range (max 30 days default, but allow override)
    let startDateObj = null;
    let endDateObj = null;
    if (startDate) {
      startDateObj = new Date(startDate);
      if (isNaN(startDateObj.getTime())) {
        return res.status(400).json({ error: 'Invalid startDate format. Use ISO 8601 format.' });
      }
    }
    if (endDate) {
      endDateObj = new Date(endDate);
      if (isNaN(endDateObj.getTime())) {
        return res.status(400).json({ error: 'Invalid endDate format. Use ISO 8601 format.' });
      }
    }
    
    // Default to last 30 days if no date range specified
    if (!startDateObj && !endDateObj) {
      endDateObj = new Date();
      startDateObj = new Date();
      startDateObj.setDate(startDateObj.getDate() - 30);
    } else if (!startDateObj) {
      startDateObj = new Date(endDateObj);
      startDateObj.setDate(startDateObj.getDate() - 30);
    } else if (!endDateObj) {
      endDateObj = new Date();
    }

    // Ensure endDate is after startDate
    if (endDateObj < startDateObj) {
      return res.status(400).json({ error: 'endDate must be after startDate' });
    }

    // Build queries for each log table
    const allLogs = [];

    // 1. Query site_logs
    try {
      let siteLogsQuery = supabase
        .from('site_logs')
        .select('*', { count: 'exact' });

      if (type) {
        siteLogsQuery = siteLogsQuery.eq('log_type', type);
      }
      if (category) {
        siteLogsQuery = siteLogsQuery.eq('category', category);
      }
      if (userRole) {
        siteLogsQuery = siteLogsQuery.eq('user_type', userRole);
      }
      if (userId) {
        siteLogsQuery = siteLogsQuery.eq('user_id', userId);
      }
      if (startDateObj) {
        siteLogsQuery = siteLogsQuery.gte('created_at', startDateObj.toISOString());
      }
      if (endDateObj) {
        siteLogsQuery = siteLogsQuery.lte('created_at', endDateObj.toISOString());
      }
      if (search) {
        // Full-text search on message field
        siteLogsQuery = siteLogsQuery.ilike('message', `%${search}%`);
      }

      siteLogsQuery = siteLogsQuery.order('created_at', { ascending: sortOrder === 'asc' });

      const { data: siteLogs, error: siteLogsError } = await siteLogsQuery;

      if (!siteLogsError && siteLogs) {
        siteLogs.forEach(log => {
          allLogs.push({
            id: log.id,
            source: 'site_logs',
            log_type: log.log_type,
            category: log.category,
            message: log.message,
            details: log.details,
            user_id: log.user_id,
            user_type: log.user_type,
            ip_address: log.ip_address,
            user_agent: log.user_agent,
            page_url: log.page_url,
            request_method: log.request_method,
            request_path: log.request_path,
            response_status: log.response_status,
            error_stack: log.error_stack,
            created_at: log.created_at
          });
        });
      }
    } catch (err) {
      console.warn('Error querying site_logs:', err.message);
    }

    // 2. Query security_audit_logs
    try {
      let securityLogsQuery = supabase
        .from('security_audit_logs')
        .select('*');

      if (userRole) {
        // Security logs don't have user_type, but we can filter by user_id if provided
        if (userId) {
          securityLogsQuery = securityLogsQuery.eq('user_id', userId);
        }
      }
      if (startDateObj) {
        securityLogsQuery = securityLogsQuery.gte('created_at', startDateObj.toISOString());
      }
      if (endDateObj) {
        securityLogsQuery = securityLogsQuery.lte('created_at', endDateObj.toISOString());
      }
      if (search) {
        securityLogsQuery = securityLogsQuery.or(`event_type.ilike.%${search}%,endpoint.ilike.%${search}%`);
      }

      securityLogsQuery = securityLogsQuery.order('created_at', { ascending: sortOrder === 'asc' });

      const { data: securityLogs, error: securityLogsError } = await securityLogsQuery;

      if (!securityLogsError && securityLogs) {
        securityLogs.forEach(log => {
          // Map security log to unified format
          const logType = log.severity === 'critical' || log.severity === 'high' ? 'error' :
                         log.severity === 'medium' ? 'warning' : 'info';
          
          allLogs.push({
            id: log.id,
            source: 'security_audit_logs',
            log_type: logType,
            category: 'security',
            message: `${log.event_type}: ${log.endpoint}`,
            details: {
              event_type: log.event_type,
              endpoint: log.endpoint,
              request_method: log.request_method,
              request_path: log.request_path,
              request_body: log.request_body,
              response_status: log.response_status,
              severity: log.severity,
              ...log.details
            },
            user_id: log.user_id,
            user_type: null, // Security logs don't have user_type
            ip_address: log.ip_address,
            user_agent: log.user_agent,
            request_method: log.request_method,
            request_path: log.request_path,
            response_status: log.response_status,
            created_at: log.created_at
          });
        });
      }
    } catch (err) {
      console.warn('Error querying security_audit_logs:', err.message);
    }

    // 3. Query sms_logs
    try {
      let smsLogsQuery = supabase
        .from('sms_logs')
        .select('*');

      if (startDateObj) {
        smsLogsQuery = smsLogsQuery.gte('created_at', startDateObj.toISOString());
      }
      if (endDateObj) {
        smsLogsQuery = smsLogsQuery.lte('created_at', endDateObj.toISOString());
      }
      if (search) {
        smsLogsQuery = smsLogsQuery.or(`phone_number.ilike.%${search}%,message.ilike.%${search}%`);
      }

      smsLogsQuery = smsLogsQuery.order('created_at', { ascending: sortOrder === 'asc' });

      const { data: smsLogs, error: smsLogsError } = await smsLogsQuery;

      if (!smsLogsError && smsLogs) {
        smsLogs.forEach(log => {
          const logType = log.status === 'failed' ? 'error' :
                         log.status === 'sent' ? 'success' : 'info';
          
          allLogs.push({
            id: log.id,
            source: 'sms_logs',
            log_type: logType,
            category: 'sms',
            message: `SMS ${log.status}: ${log.phone_number}`,
            details: {
              phone_number: log.phone_number,
              message: log.message,
              status: log.status,
              api_response: log.api_response,
              error_message: log.error_message,
              sent_at: log.sent_at
            },
            user_id: null,
            user_type: null,
            created_at: log.created_at
          });
        });
      }
    } catch (err) {
      console.warn('Error querying sms_logs:', err.message);
    }

    // 4. Query email_delivery_logs
    try {
      let emailLogsQuery = supabase
        .from('email_delivery_logs')
        .select('*');

      if (startDateObj) {
        emailLogsQuery = emailLogsQuery.gte('created_at', startDateObj.toISOString());
      }
      if (endDateObj) {
        emailLogsQuery = emailLogsQuery.lte('created_at', endDateObj.toISOString());
      }
      if (search) {
        emailLogsQuery = emailLogsQuery.or(`recipient_email.ilike.%${search}%,subject.ilike.%${search}%`);
      }

      emailLogsQuery = emailLogsQuery.order('created_at', { ascending: sortOrder === 'asc' });

      const { data: emailLogs, error: emailLogsError } = await emailLogsQuery;

      if (!emailLogsError && emailLogs) {
        emailLogs.forEach(log => {
          const logType = log.status === 'failed' ? 'error' :
                         log.status === 'sent' ? 'success' : 'info';
          
          allLogs.push({
            id: log.id,
            source: 'email_delivery_logs',
            log_type: logType,
            category: 'email',
            message: `Email ${log.status}: ${log.email_type} to ${log.recipient_email}`,
            details: {
              order_id: log.order_id,
              email_type: log.email_type,
              recipient_email: log.recipient_email,
              recipient_name: log.recipient_name,
              subject: log.subject,
              status: log.status,
              error_message: log.error_message,
              sent_at: log.sent_at,
              retry_count: log.retry_count
            },
            user_id: null,
            user_type: null,
            created_at: log.created_at
          });
        });
      }
    } catch (err) {
      console.warn('Error querying email_delivery_logs:', err.message);
    }

    // Sort all logs by created_at
    allLogs.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    // Apply pagination
    const total = allLogs.length;
    const paginatedLogs = allLogs.slice(offsetNum, offsetNum + limitNum);

    // Mask sensitive data before sending
    const maskedLogs = paginatedLogs.map(log => {
      const masked = { ...log };
      
      // Mask email addresses (show first 3 chars + domain)
      if (masked.details?.recipient_email) {
        const email = masked.details.recipient_email;
        const [local, domain] = email.split('@');
        if (local && domain) {
          masked.details.recipient_email = `${local.substring(0, 3)}***@${domain}`;
        }
      }
      
      // Mask phone numbers (show last 4 digits)
      if (masked.details?.phone_number) {
        const phone = masked.details.phone_number;
        masked.details.phone_number = `***${phone.slice(-4)}`;
      }
      
      // Mask tokens in request_body
      if (masked.details?.request_body) {
        const body = JSON.stringify(masked.details.request_body);
        if (body.includes('token') || body.includes('password')) {
          masked.details.request_body = '[REDACTED - Contains sensitive data]';
        }
      }
      
      // Mask IP addresses (show first 2 octets)
      if (masked.ip_address && masked.ip_address !== 'unknown') {
        const parts = masked.ip_address.split('.');
        if (parts.length === 4) {
          masked.ip_address = `${parts[0]}.${parts[1]}.***.***`;
        }
      }
      
      return masked;
    });

    res.json({
      success: true,
      logs: maskedLogs,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total
      },
      filters: {
        type: type || null,
        category: category || null,
        userRole: userRole || null,
        userId: userId || null,
        startDate: startDateObj?.toISOString() || null,
        endDate: endDateObj?.toISOString() || null,
        search: search || null
      }
    });
  } catch (error) {
    console.error('❌ /api/admin/logs: Error:', {
      error: error.message,
      stack: error.stack,
      adminId: req.admin?.id
    });
    res.status(500).json({ 
      error: 'Server error',
      details: error.message || 'An unexpected error occurred while fetching logs'
    });
  }
});

// ============================================
// OFFICIAL INVITATIONS API ENDPOINTS (Super Admin Only)
// ============================================

// Middleware to verify super admin
function requireSuperAdmin(req, res, next) {
  if (!req.admin) {
    return res.status(401).json({ 
      error: 'Not authenticated', 
      valid: false
    });
  }
  
  if (req.admin.role !== 'super_admin') {
    return res.status(403).json({ 
      error: 'Forbidden', 
      details: 'This endpoint requires super admin privileges',
      valid: false
    });
  }
  
  next();
}

// Scanner auth: NEVER trust frontend. scannerId only from verified JWT.
function requireScannerAuth(req, res, next) {
  try {
    const token = req.cookies?.scannerToken;
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated', reason: 'No scanner token' });
    }
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret && process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: 'Server configuration error' });
    }
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret || 'fallback-secret-dev-only');
    } catch (e) {
      res.clearCookie('scannerToken', { path: '/' });
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    if (decoded.type !== 'scanner' || !decoded.scannerId || !decoded.email) {
      res.clearCookie('scannerToken', { path: '/' });
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.scanner = { scannerId: decoded.scannerId, email: decoded.email };
    next();
  } catch (e) {
    res.clearCookie('scannerToken', { path: '/' });
    return res.status(500).json({ error: 'Authentication error' });
  }
}

// Helper function to log invitation actions
async function logInvitationAction(action, invitationId, adminId, details = {}) {
  if (!supabase) return;
  
  try {
    await supabase.from('site_logs').insert({
      log_type: 'action',
      category: 'official_invitation',
      message: `Official Invitation: ${action}`,
      details: {
        invitation_id: invitationId,
        action,
        ...details
      },
      user_id: adminId,
      user_type: 'admin',
      request_method: 'POST',
      request_path: '/api/admin/official-invitations'
    });
  } catch (error) {
    console.error('Failed to log invitation action:', error);
  }
}

// POST /api/admin/official-invitations/create - Create official invitation
app.post('/api/admin/official-invitations/create', requireAdminAuth, requireSuperAdmin, async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ 
      error: 'Supabase not configured'
    });
  }

  try {
    const { guest_name, guest_phone, guest_email, event_id, pass_type_id, quantity } = req.body;

    // Validate required fields
    if (!guest_name || !guest_phone || !guest_email || !event_id || !pass_type_id || !quantity) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'guest_name, guest_phone, guest_email, event_id, pass_type_id, and quantity are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guest_email)) {
      return res.status(400).json({ 
        error: 'Invalid email address',
        details: `The email address "${guest_email}" is not valid`
      });
    }

    // Validate quantity
    const quantityNum = parseInt(quantity, 10);
    if (isNaN(quantityNum) || quantityNum < 1 || quantityNum > 100) {
      return res.status(400).json({ 
        error: 'Invalid quantity',
        details: 'Quantity must be between 1 and 100'
      });
    }

    // Use service role client for all database operations (bypasses RLS)
    const dbClient = supabaseService || supabase;

    // Fetch event details
    const { data: event, error: eventError } = await dbClient
      .from('events')
      .select('id, name, date, venue, city')
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ 
        error: 'Event not found',
        details: 'The specified event does not exist'
      });
    }

    // Fetch pass type details
    const { data: passType, error: passError } = await dbClient
      .from('event_passes')
      .select('id, name, description, price, event_id')
      .eq('id', pass_type_id)
      .eq('event_id', event_id)
      .single();

    if (passError || !passType) {
      return res.status(404).json({ 
        error: 'Pass type not found',
        details: 'The specified pass type does not exist for this event'
      });
    }

    // Create invitation record
    const { data: invitation, error: invitationError } = await dbClient
      .from('official_invitations')
      .insert({
        recipient_name: guest_name.trim(),
        recipient_phone: guest_phone.trim(),
        recipient_email: guest_email.trim().toLowerCase(),
        event_id: event_id,
        pass_type: passType.name,
        pass_type_id: pass_type_id,
        quantity: quantityNum,
        zone_name: passType.name, // Use pass name as zone name
        zone_description: passType.description || '',
        status: 'pending',
        created_by: req.admin.id
      })
      .select()
      .single();

    if (invitationError) {
      console.error('Error creating invitation:', invitationError);
      return res.status(500).json({ 
        error: 'Failed to create invitation',
        details: invitationError.message
      });
    }

    // Generate QR codes
    const QRCode = require('qrcode');
    const { v4: uuidv4 } = require('uuid');
    const qrCodes = [];
    const qrTicketsEntries = [];

    for (let i = 0; i < quantityNum; i++) {
      // Generate unique secure token
      const secureToken = uuidv4();
      
      // Generate QR code image
      const qrCodeBuffer = await QRCode.toBuffer(secureToken, { 
        type: 'png', 
        width: 300,
        errorCorrectionLevel: 'M'
      });

      // Upload QR code to storage
      const fileName = `invitations/${invitation.id}/${secureToken}.png`;
      const storageClient = supabaseService || supabase;
      const { error: uploadError } = await storageClient.storage
        .from('tickets')
        .upload(fileName, qrCodeBuffer, {
          contentType: 'image/png',
          upsert: true
        });

      if (uploadError) {
        console.error(`Error uploading QR code ${i + 1}:`, uploadError);
        continue;
      }

      // Get public URL
      const { data: urlData } = storageClient.storage
        .from('tickets')
        .getPublicUrl(fileName);

      const qrCodeUrl = urlData?.publicUrl;

      if (!qrCodeUrl) {
        console.error(`Failed to get public URL for QR code ${i + 1}`);
        continue;
      }

      qrCodes.push({
        secure_token: secureToken,
        qr_code_url: qrCodeUrl
      });

      // Create qr_tickets entry
      qrTicketsEntries.push({
        secure_token: secureToken,
        ticket_id: null, // No ticket entry for invitations
        order_id: null, // No order for invitations
        invitation_id: invitation.id,
        source: 'official_invitation',
        payment_method: 'external_app',
        buyer_name: guest_name.trim(),
        buyer_phone: guest_phone.trim(),
        buyer_email: guest_email.trim().toLowerCase(),
        buyer_city: event.city || 'N/A',
        event_id: event_id,
        event_name: event.name,
        event_date: event.date,
        event_venue: event.venue,
        event_city: event.city,
        order_pass_id: null,
        pass_type: passType.name,
        pass_price: passType.price || 0,
        ticket_status: 'VALID',
        qr_code_url: qrCodeUrl,
        generated_at: new Date().toISOString()
      });
    }

    // Insert all qr_tickets entries
    if (qrTicketsEntries.length > 0) {
      const dbClient = supabaseService || supabase;
      const { error: qrTicketsError } = await dbClient
        .from('qr_tickets')
        .insert(qrTicketsEntries);

      if (qrTicketsError) {
        console.error('Error creating qr_tickets entries:', qrTicketsError);
        return res.status(500).json({ 
          error: 'Failed to create QR tickets',
          details: qrTicketsError.message
        });
      }
    }

    // Validate that we have at least one QR code
    if (qrCodes.length === 0) {
      console.error('No QR codes were generated successfully');
      return res.status(500).json({ 
        error: 'Failed to generate QR codes',
        details: 'No QR codes could be generated or uploaded. Please try again.'
      });
    }

    // Send email with QR codes
    const emailConfig = createOfficialInvitationEmailHTML({
      guestName: guest_name.trim(),
      guestPhone: guest_phone.trim(),
      guestEmail: guest_email.trim().toLowerCase(),
      event: {
        name: event.name,
        date: event.date,
        venue: event.venue,
        city: event.city
      },
      passType: passType.name,
      invitationNumber: invitation.invitation_number,
      zoneName: passType.name,
      zoneDescription: passType.description || '',
      qrCodes: qrCodes
    });

    // Send email via existing endpoint logic
    let emailSent = false;
    let emailError = null;
    
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587', 10),
        secure: process.env.EMAIL_PORT === '465',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      await transporter.sendMail({
        from: emailConfig.from,
        to: emailConfig.to,
        subject: emailConfig.subject,
        html: emailConfig.html
      });

      emailSent = true;
    } catch (emailErr) {
      console.error('Error sending invitation email:', emailErr);
      emailError = emailErr.message;
    }

    // Update invitation status
    // Use service role client to bypass RLS
    const updateData = {
      status: emailSent ? 'sent' : 'failed',
      sent_at: emailSent ? new Date().toISOString() : null,
      email_delivery_status: emailSent ? 'sent' : 'failed'
    };

    await dbClient
      .from('official_invitations')
      .update(updateData)
      .eq('id', invitation.id);

    // Log action
    await logInvitationAction('created', invitation.id, req.admin.id, {
      guest_name,
      guest_email,
      event_id,
      pass_type: passType.name,
      quantity: quantityNum,
      qr_codes_generated: qrCodes.length,
      email_sent: emailSent
    });

    res.json({
      success: true,
      invitation: {
        ...invitation,
        ...updateData
      },
      qr_codes_count: qrCodes.length,
      email_sent: emailSent,
      email_error: emailError
    });

  } catch (error) {
    console.error('Error creating official invitation:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
});

// GET /api/admin/official-invitations - List all invitations
app.get('/api/admin/official-invitations', requireAdminAuth, requireSuperAdmin, async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ 
      error: 'Supabase not configured'
    });
  }

  try {
    // Use service role client to bypass RLS (backend operations)
    const dbClient = supabaseService || supabase;

    const { event_id, status, search, limit = '50', offset = '0' } = req.query;

    let query = dbClient
      .from('official_invitations')
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
      .order('created_at', { ascending: false });

    // Apply filters
    if (event_id) {
      query = query.eq('event_id', event_id);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.or(`recipient_name.ilike.%${search}%,recipient_phone.ilike.%${search}%,recipient_email.ilike.%${search}%,invitation_number.ilike.%${search}%`);
    }

    // Apply pagination
    const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);
    query = query.range(offsetNum, offsetNum + limitNum - 1);

    const { data: invitations, error, count } = await query;

    if (error) {
      throw error;
    }

    // Get count
    let countQuery = dbClient
      .from('official_invitations')
      .select('*', { count: 'exact', head: true });

    if (event_id) {
      countQuery = countQuery.eq('event_id', event_id);
    }
    if (status) {
      countQuery = countQuery.eq('status', status);
    }
    if (search) {
      countQuery = countQuery.or(`recipient_name.ilike.%${search}%,recipient_phone.ilike.%${search}%,recipient_email.ilike.%${search}%,invitation_number.ilike.%${search}%`);
    }

    const { count: totalCount } = await countQuery;

    // Get total QR codes count for all invitations (matching the same filters)
    let totalQrCount = 0;

    // If we have filters, we need to count QR codes only for matching invitations
    if (event_id || status || search) {
      // First get the invitation IDs that match the filters
      let filterQuery = dbClient
        .from('official_invitations')
        .select('id');

      if (event_id) {
        filterQuery = filterQuery.eq('event_id', event_id);
      }
      if (status) {
        filterQuery = filterQuery.eq('status', status);
      }
      if (search) {
        filterQuery = filterQuery.or(`recipient_name.ilike.%${search}%,recipient_phone.ilike.%${search}%,recipient_email.ilike.%${search}%,invitation_number.ilike.%${search}%`);
      }

      const { data: filteredInvitations } = await filterQuery;
      const invitationIds = filteredInvitations?.map(inv => inv.id) || [];

      if (invitationIds.length > 0) {
        const { count: qrCount } = await dbClient
          .from('qr_tickets')
          .select('*', { count: 'exact', head: true })
          .in('invitation_id', invitationIds);
        totalQrCount = qrCount || 0;
      } else {
        // No matching invitations, so no QR codes
        totalQrCount = 0;
      }
    } else {
      // No filters - count all QR codes for all invitations
      const { count: qrCount } = await dbClient
        .from('qr_tickets')
        .select('*', { count: 'exact', head: true })
        .not('invitation_id', 'is', null);
      totalQrCount = qrCount || 0;
    }

    res.json({
      success: true,
      data: invitations || [],
      count: totalCount || 0,
      qr_count: totalQrCount || 0
    });

  } catch (error) {
    console.error('Error fetching invitations:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
});

// GET /api/admin/official-invitations/:id - Get single invitation details
app.get('/api/admin/official-invitations/:id', requireAdminAuth, requireSuperAdmin, async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ 
      error: 'Supabase not configured'
    });
  }

  try {
    // Use service role client to bypass RLS (backend operations)
    const dbClient = supabaseService || supabase;

    const { id } = req.params;

    // Fetch invitation
    const { data: invitation, error: invitationError } = await dbClient
      .from('official_invitations')
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
      .eq('id', id)
      .single();

    if (invitationError || !invitation) {
      return res.status(404).json({ 
        error: 'Invitation not found'
      });
    }

    // Fetch QR codes
    const { data: qrTickets, error: qrError } = await dbClient
      .from('qr_tickets')
      .select('*')
      .eq('invitation_id', id)
      .order('generated_at', { ascending: true });

    res.json({
      success: true,
      invitation,
      qr_tickets: qrTickets || []
    });

  } catch (error) {
    console.error('Error fetching invitation details:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
});

// POST /api/admin/official-invitations/:id/resend - Resend invitation email
app.post('/api/admin/official-invitations/:id/resend', requireAdminAuth, requireSuperAdmin, async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ 
      error: 'Supabase not configured'
    });
  }

  try {
    const { id } = req.params;

    // Use service role client to bypass RLS (backend operations)
    const dbClient = supabaseService || supabase;

    // Fetch invitation
    const { data: invitation, error: invitationError } = await dbClient
      .from('official_invitations')
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
      .eq('id', id)
      .single();

    if (invitationError || !invitation) {
      return res.status(404).json({ 
        error: 'Invitation not found'
      });
    }

    // Fetch QR codes
    const { data: qrTickets, error: qrError } = await dbClient
      .from('qr_tickets')
      .select('secure_token, qr_code_url')
      .eq('invitation_id', id);

    if (qrError || !qrTickets || qrTickets.length === 0) {
      return res.status(404).json({ 
        error: 'QR codes not found for this invitation'
      });
    }

    // Send email
    const emailConfig = createOfficialInvitationEmailHTML({
      guestName: invitation.recipient_name,
      guestPhone: invitation.recipient_phone,
      guestEmail: invitation.recipient_email,
      event: {
        name: invitation.events.name,
        date: invitation.events.date,
        venue: invitation.events.venue,
        city: invitation.events.city
      },
      passType: invitation.pass_type,
      invitationNumber: invitation.invitation_number,
      zoneName: invitation.zone_name,
      zoneDescription: invitation.zone_description,
      qrCodes: qrTickets.map(qt => ({
        secure_token: qt.secure_token,
        qr_code_url: qt.qr_code_url
      }))
    });

    let emailSent = false;
    let emailError = null;

    try {
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587', 10),
        secure: process.env.EMAIL_PORT === '465',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      await transporter.sendMail({
        from: emailConfig.from,
        to: emailConfig.to,
        subject: emailConfig.subject,
        html: emailConfig.html
      });

      emailSent = true;
    } catch (emailErr) {
      console.error('Error resending invitation email:', emailErr);
      emailError = emailErr.message;
    }

    // Update invitation status
    await dbClient
      .from('official_invitations')
      .update({
        status: emailSent ? 'sent' : 'failed',
        sent_at: emailSent ? new Date().toISOString() : invitation.sent_at,
        email_delivery_status: emailSent ? 'sent' : 'failed'
      })
      .eq('id', id);

    // Log action
    await logInvitationAction('resend_email', id, req.admin.id, {
      email_sent: emailSent,
      email_error: emailError
    });

    res.json({
      success: emailSent,
      email_sent: emailSent,
      email_error: emailError
    });

  } catch (error) {
    console.error('Error resending invitation email:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
});

// DELETE /api/admin/official-invitations/:id - Delete invitation
app.delete('/api/admin/official-invitations/:id', requireAdminAuth, requireSuperAdmin, async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ 
      error: 'Supabase not configured'
    });
  }

  try {
    // Use service role client to bypass RLS (backend operations)
    const dbClient = supabaseService || supabase;
    
    const { id } = req.params;

    // Check if invitation exists
    const { data: invitation, error: invitationError } = await dbClient
      .from('official_invitations')
      .select('id, invitation_number')
      .eq('id', id)
      .single();

    if (invitationError || !invitation) {
      return res.status(404).json({ 
        error: 'Invitation not found'
      });
    }

    // Delete QR codes associated with this invitation first
    // (CASCADE should handle this, but being explicit)
    const { error: qrDeleteError } = await dbClient
      .from('qr_tickets')
      .delete()
      .eq('invitation_id', id);

    if (qrDeleteError) {
      console.error('Error deleting QR tickets:', qrDeleteError);
      // Continue with invitation deletion anyway
    }

    // Delete invitation
    const { error: deleteError } = await dbClient
      .from('official_invitations')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    // Log action
    await logInvitationAction('deleted', id, req.admin.id, {
      invitation_number: invitation.invitation_number
    });

    res.json({
      success: true,
      message: 'Invitation deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting invitation:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
});

// GET /api/admin/aio-events-submissions - Get AIO Events submissions (admin only)
app.get('/api/admin/aio-events-submissions', requireAdminAuth, async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ 
      error: 'Supabase not configured',
      details: 'Please check SUPABASE_URL and SUPABASE_ANON_KEY environment variables'
    });
  }

  try {
    // Parse query parameters (all optional)
    const {
      status,        // Filter by status
      eventId,       // Filter by event_id
      search,        // Full-text search on name, email, phone
      startDate,     // ISO date string
      endDate,       // ISO date string
      limit = '50',  // Pagination limit (default 50, max 200)
      offset = '0',  // Pagination offset
      sortBy = 'submitted_at', // Sort by: submitted_at, created_at, total_price
      order = 'desc'  // Sort order: asc, desc
    } = req.query;

    // Validate and sanitize inputs
    const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);
    const sortOrder = order === 'asc' ? 'asc' : 'desc';
    
    // Validate date range
    let startDateObj = null;
    let endDateObj = null;
    if (startDate) {
      startDateObj = new Date(startDate);
      if (isNaN(startDateObj.getTime())) {
        return res.status(400).json({ error: 'Invalid startDate format. Use ISO 8601 format.' });
      }
    }
    if (endDate) {
      endDateObj = new Date(endDate);
      if (isNaN(endDateObj.getTime())) {
        return res.status(400).json({ error: 'Invalid endDate format. Use ISO 8601 format.' });
      }
    }
    
    // Ensure endDate is after startDate
    if (startDateObj && endDateObj && endDateObj < startDateObj) {
      return res.status(400).json({ error: 'endDate must be after startDate' });
    }

    // Use service role key if available for better access
    let dbClient = supabase;
    if (supabaseService) {
      dbClient = supabaseService;
    }

    // Build query
    let query = dbClient
      .from('aio_events_submissions')
      .select('*', { count: 'exact' });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (eventId) {
      query = query.eq('event_id', eventId);
    }
    if (startDateObj) {
      query = query.gte('submitted_at', startDateObj.toISOString());
    }
    if (endDateObj) {
      query = query.lte('submitted_at', endDateObj.toISOString());
    }
    if (search) {
      // Full-text search on name, email, phone
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    // Apply sorting
    const validSortFields = ['submitted_at', 'created_at', 'total_price', 'total_quantity'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'submitted_at';
    query = query.order(sortField, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offsetNum, offsetNum + limitNum - 1);

    // Execute query
    const { data: submissions, error: queryError, count } = await query;

    if (queryError) {
      console.error('Error querying aio_events_submissions:', queryError);
      return res.status(500).json({
        error: 'Database query error',
        details: queryError.message
      });
    }

    // Return results
    return res.json({
      success: true,
      submissions: submissions || [],
      pagination: {
        total: count || 0,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < (count || 0)
      },
      filters: {
        status: status || null,
        eventId: eventId || null,
        startDate: startDateObj?.toISOString() || null,
        endDate: endDateObj?.toISOString() || null,
        search: search || null
      }
    });
  } catch (error) {
    console.error('❌ /api/admin/aio-events-submissions: Error:', {
      error: error.message,
      stack: error.stack,
      adminId: req.admin?.id
    });
    return res.status(500).json({ 
      error: 'Server error',
      details: error.message || 'An unexpected error occurred while fetching submissions'
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
// Helper function to create official invitation email HTML
function createOfficialInvitationEmailHTML(data) {
  // Validate required data
  if (!data || !data.event || !data.qrCodes || !Array.isArray(data.qrCodes) || data.qrCodes.length === 0) {
    throw new Error('Invalid email data: missing required fields or empty QR codes array');
  }

  const formatDate = (dateString) => {
    try {
      if (!dateString) return 'TBD';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return dateString || 'TBD'; }
  };
  const formatTime = (dateString) => {
    try {
      if (!dateString) return '';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch { return ''; }
  };
  const eventDate = formatDate(data.event?.date);
  const eventTime = formatTime(data.event?.date);
  const qrCodesHtml = data.qrCodes.map((qr, index) => {
    if (data.qrCodes.length === 1) {
      return `<img src="${qr.qr_code_url}" alt="Invitation QR Code" style="max-width: 300px; height: auto; display: block; margin: 0 auto 20px; border-radius: 8px;" />`;
    } else {
      return `<div style="margin: 10px; padding: 20px; background: #FFFFFF; border: 2px solid #E21836; border-radius: 12px; display: inline-block;"><p style="margin: 0 0 15px 0; color: #E21836; font-size: 14px; font-weight: 600;">QR Code ${index + 1}</p><img src="${qr.qr_code_url}" alt="Invitation QR Code ${index + 1}" style="max-width: 250px; height: auto; display: block; margin: 0 auto; border-radius: 8px;" /></div>`;
    }
  }).join('');
  const qrCodeSectionTitle = data.qrCodes.length > 1 ? `Your QR Codes (${data.qrCodes.length})` : "Your QR Code";
  const qrCodeInstruction = data.qrCodes.length > 1 ? "Scan any of these QR codes at the entrance to access your assigned zone" : "Scan this QR code at the entrance to access your assigned zone";
  const zoneTableHtml = data.zoneName && data.zoneDescription ? `<table style="width: 100%; border-collapse: collapse; margin-top: 20px;"><thead><tr><th style="background: #1A1A1A; color: #FFFFFF; padding: 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 600;">Zone</th><th style="background: #1A1A1A; color: #FFFFFF; padding: 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 600;">Access Details</th></tr></thead><tbody><tr><td style="padding: 12px; border-bottom: 1px solid rgba(0, 0, 0, 0.1); font-size: 14px; color: #1A1A1A;">${data.zoneName}</td><td style="padding: 12px; border-bottom: 1px solid rgba(0, 0, 0, 0.1); font-size: 14px; color: #1A1A1A;">${data.zoneDescription}</td></tr></tbody></table><p style="margin-top: 20px; font-size: 14px; color: #666666; line-height: 1.7;">Access is valid only for the zone mentioned above.<br>Zone changes are not permitted on-site.</p>` : '';
  // Full HTML template - using the same structure as official-invitation-email-preview.html
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light dark"><title>Official Invitation – Andiamo Events</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;line-height:1.6;color:#1A1A1A;background:#FFFFFF}@media(prefers-color-scheme:dark){body{color:#FFFFFF;background:#1A1A1A}}a{color:#E21836!important;text-decoration:none}.email-wrapper{max-width:600px;margin:0 auto;background:#FFFFFF}@media(prefers-color-scheme:dark){.email-wrapper{background:#1A1A1A}}.content-card{background:#F5F5F5;margin:0 20px 30px;border-radius:12px;padding:50px 40px;border:1px solid rgba(0,0,0,0.1)}@media(prefers-color-scheme:dark){.content-card{background:#1F1F1F;border:1px solid rgba(42,42,42,0.5)}}.title-section{text-align:center;margin-bottom:40px;padding-bottom:30px;border-bottom:1px solid rgba(0,0,0,0.1)}.title{font-size:32px;font-weight:700;color:#1A1A1A;margin-bottom:12px}@media(prefers-color-scheme:dark){.title{color:#FFFFFF}}.subtitle{font-size:16px;color:#666666;font-weight:400}@media(prefers-color-scheme:dark){.subtitle{color:#B0B0B0}}.greeting{font-size:18px;color:#1A1A1A;margin-bottom:30px;line-height:1.7}@media(prefers-color-scheme:dark){.greeting{color:#FFFFFF}}.greeting strong{color:#E21836;font-weight:600}.message{font-size:16px;color:#666666;margin-bottom:25px;line-height:1.7}@media(prefers-color-scheme:dark){.message{color:#B0B0B0}}.info-block{background:#E8E8E8;border:1px solid rgba(0,0,0,0.15);border-radius:8px;padding:30px;margin:40px 0}@media(prefers-color-scheme:dark){.info-block{background:#252525;border:1px solid rgba(42,42,42,0.8)}}.info-row{margin-bottom:25px}.info-row:last-child{margin-bottom:0}.info-label{font-size:11px;color:#999999;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:10px;font-weight:600}@media(prefers-color-scheme:dark){.info-label{color:#6B6B6B}}.info-value{font-size:18px;color:#1A1A1A;font-weight:500;letter-spacing:0.5px}@media(prefers-color-scheme:dark){.info-value{color:#FFFFFF}}.event-details-block{background:#E8E8E8;border:1px solid rgba(0,0,0,0.15);border-radius:8px;padding:30px;margin:40px 0}@media(prefers-color-scheme:dark){.event-details-block{background:#252525;border:1px solid rgba(42,42,42,0.8)}}.event-details-title{font-size:18px;color:#E21836;font-weight:600;margin-bottom:20px}.event-detail-row{margin-bottom:15px}.event-detail-row:last-child{margin-bottom:0}.event-detail-label{font-size:11px;color:#999999;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:5px;font-weight:600}@media(prefers-color-scheme:dark){.event-detail-label{color:#6B6B6B}}.event-detail-value{font-size:16px;color:#1A1A1A;font-weight:500}@media(prefers-color-scheme:dark){.event-detail-value{color:#FFFFFF}}.qr-code-section{text-align:center;margin:40px 0;padding:30px;background:#FFFFFF;border:2px solid #E21836;border-radius:12px}@media(prefers-color-scheme:dark){.qr-code-section{background:#1F1F1F}}.qr-code-title{font-size:20px;color:#1A1A1A;font-weight:600;margin-bottom:15px}@media(prefers-color-scheme:dark){.qr-code-title{color:#FFFFFF}}.qr-code-instruction{font-size:15px;color:#666666;margin-bottom:25px;line-height:1.6}@media(prefers-color-scheme:dark){.qr-code-instruction{color:#B0B0B0}}.rules-section{background:#FFF9E6;border-left:3px solid #E21836;padding:20px 25px;margin:35px 0;border-radius:4px}@media(prefers-color-scheme:dark){.rules-section{background:#2A2419;border-left:3px solid #E21836}}.rules-title{font-size:16px;color:#E21836;font-weight:600;margin-bottom:15px}.rules-list{list-style:none;padding:0;margin:0}.rules-list li{font-size:14px;color:#666666;line-height:1.8;margin-bottom:10px;padding-left:25px;position:relative}@media(prefers-color-scheme:dark){.rules-list li{color:#B0B0B0}}.rules-list li:before{content:"⚠️";position:absolute;left:0}.rules-list li:last-child{margin-bottom:0}.arrival-note{font-size:14px;color:#666666;margin-top:15px;line-height:1.7}@media(prefers-color-scheme:dark){.arrival-note{color:#B0B0B0}}.support-section{background:#E8E8E8;border-left:3px solid rgba(226,24,54,0.3);padding:20px 25px;margin:35px 0;border-radius:4px}@media(prefers-color-scheme:dark){.support-section{background:#252525}}.support-text{font-size:14px;color:#666666;line-height:1.7;margin-bottom:10px}@media(prefers-color-scheme:dark){.support-text{color:#B0B0B0}}.support-contact{font-size:14px;color:#666666;line-height:1.8}@media(prefers-color-scheme:dark){.support-contact{color:#B0B0B0}}.support-email{color:#E21836!important;text-decoration:none;font-weight:500}.closing-section{text-align:center;margin:50px 0 40px;padding-top:40px;border-top:1px solid rgba(0,0,0,0.1)}@media(prefers-color-scheme:dark){.closing-section{border-top:1px solid rgba(255,255,255,0.1)}}.slogan{font-size:24px;font-style:italic;color:#E21836;font-weight:300;letter-spacing:1px;margin-bottom:30px}.signature{font-size:16px;color:#666666;line-height:1.7}@media(prefers-color-scheme:dark){.signature{color:#B0B0B0}}.footer{margin-top:50px;padding:40px 20px 30px;text-align:center;border-top:1px solid rgba(0,0,0,0.1)}@media(prefers-color-scheme:dark){.footer{border-top:1px solid rgba(255,255,255,0.05)}}.footer-text{font-size:12px;color:#999999;margin-bottom:20px;line-height:1.6}@media(prefers-color-scheme:dark){.footer-text{color:#6B6B6B}}.footer-links{margin:15px auto 0;text-align:center}.footer-link{color:#999999;text-decoration:none;font-size:13px;margin:0 8px}@media(prefers-color-scheme:dark){.footer-link{color:#6B6B6B}}.footer-link:hover{color:#E21836!important}</style></head><body><div class="email-wrapper"><div class="content-card"><div class="title-section"><h1 class="title">Official Invitation</h1><p class="subtitle">Andiamo Events</p></div><p class="greeting">Dear <strong>${data.guestName}</strong>,</p><p class="message">Mouayed Chakir has the pleasure to invite you to the <strong>${data.event.name}</strong>, proudly organized by Andiamo Events.</p><p class="message">We are pleased to confirm that your invitation has been successfully registered. This email serves as your official entry pass to the event.</p><p class="message">Please find your personal QR code${data.qrCodes.length > 1 ? 's' : ''} included below. ${data.qrCodes.length > 1 ? 'They' : 'It'} will be required for access control and validation at the venue.</p><p class="message">Kindly keep this invitation available on your phone or printed on the day of the event.</p><div class="event-details-block"><div class="event-details-title">Event Details</div><div class="event-detail-row"><div class="event-detail-label">Date</div><div class="event-detail-value">${eventDate}</div></div>${eventTime ? `<div class="event-detail-row"><div class="event-detail-label">Show Time</div><div class="event-detail-value">${eventTime}</div></div>` : ''}<div class="event-detail-row"><div class="event-detail-label">Venue</div><div class="event-detail-value">${data.event.venue}</div></div></div><div class="info-block"><div class="info-row"><div class="info-label">Invitation</div><div class="info-value">#${data.invitationNumber}</div></div><div class="info-row"><div class="info-label">Guest Name</div><div class="info-value">${data.guestName}</div></div><div class="info-row"><div class="info-label">Phone Number</div><div class="info-value">${data.guestPhone}</div></div></div>${zoneTableHtml ? `<div class="info-block"><div class="info-label" style="margin-bottom:15px;">Zone & Access Details</div>${zoneTableHtml}</div>` : ''}<div class="qr-code-section"><h3 class="qr-code-title">${qrCodeSectionTitle}</h3><p class="qr-code-instruction">${qrCodeInstruction}</p>${qrCodesHtml}</div><div class="rules-section"><div class="rules-title">Important Access Rules</div><ul class="rules-list"><li>Each QR code is valid for one (1) person only and for a single entry.</li><li>Reproduction, sharing, or duplication of the QR code is strictly prohibited.</li><li>Once scanned, the QR code becomes invalid.</li></ul><p class="arrival-note">Please arrive at least 1h30mn before the show time to ensure smooth check-in.</p></div><div class="support-section"><p class="support-text">For any assistance or additional information, please contact us at</p><p class="support-contact"><a href="mailto:contact@andiamoevents.com" class="support-email">contact@andiamoevents.com</a> or <strong style="color:#E21836!important">+216 28 070 128</strong></p></div><div class="closing-section"><p class="slogan">We Create Memories</p><p class="signature">Best regards,<br>Andiamo Events Team</p></div></div><div class="footer"><p class="footer-text">Developed by <span style="color:#E21836!important">Malek Ben Amor</span></p><div class="footer-links"><a href="https://www.instagram.com/malekbenamor.dev/" target="_blank" class="footer-link">Instagram</a><span style="color:#999999">•</span><a href="https://malekbenamor.dev/" target="_blank" class="footer-link">Website</a></div></div></div></body></html>`;
  return { from: '"Andiamo Events" <contact@andiamoevents.com>', to: data.guestEmail, subject: 'Official Invitation – Andiamo Events', html: html };
}

function requireAdminAuth(req, res, next) {
  try {
    const token = req.cookies?.adminToken;
    if (!token) {
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
// POST /api/send-order-confirmation-sms - Send SMS to Client
// ============================================
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

    // Prepare passes array for SMS template helper
    let passes = [];
    if (order.order_passes && order.order_passes.length > 0) {
      passes = order.order_passes.map(p => ({
        pass_type: p.pass_type,
        quantity: p.quantity || 1
      }));
    } else {
      if (order.notes) {
        try {
          const notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
          if (notesData.all_passes && Array.isArray(notesData.all_passes)) {
            passes = notesData.all_passes.map(p => ({
              pass_type: p.passName || p.pass_type || 'Standard',
              quantity: p.quantity || 1
            }));
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      if (passes.length === 0) {
        passes = [{
          pass_type: order.pass_type || 'Standard',
          quantity: order.quantity || 1
        }];
      }
    }

    // Build SMS message using centralized template helper
    let message;
    try {
      message = buildClientOrderConfirmationSMS({
        order,
        passes,
        ambassador: order.ambassadors
      });
      
      // Log SMS type and order ID for validation
      console.log('📱 SMS Type: Client Order Confirmation');
      console.log('📱 Order ID:', order.id);
      console.log('📱 Recipient:', order.user_phone ? `${order.user_phone.substring(0, 3)}***` : 'NOT SET');
    } catch (smsError) {
      console.error('❌ Error building SMS message:', smsError);
      return res.status(500).json({
        success: false,
        error: 'Failed to build SMS message',
        details: smsError.message
      });
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

    // Prepare passes array for SMS template helper
    let passes = [];
    if (order.order_passes && order.order_passes.length > 0) {
      passes = order.order_passes.map(p => ({
        pass_type: p.pass_type,
        quantity: p.quantity || 1
      }));
    } else {
      if (order.notes) {
        try {
          const notesData = typeof order.notes === 'string' ? JSON.parse(order.notes) : order.notes;
          if (notesData.all_passes && Array.isArray(notesData.all_passes)) {
            passes = notesData.all_passes.map(p => ({
              pass_type: p.passName || p.pass_type || 'Standard',
              quantity: p.quantity || 1
            }));
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      if (passes.length === 0) {
        passes = [{
          pass_type: order.pass_type || 'Standard',
          quantity: order.quantity || 1
        }];
      }
    }

    // Build SMS message using centralized template helper
    let message;
    try {
      message = buildAmbassadorNewOrderSMS({
        order,
        passes
      });
      
      // Log SMS type and order ID for validation
      console.log('📱 SMS Type: Ambassador New Order');
      console.log('📱 Order ID:', order.id);
      console.log('📱 Recipient:', order.ambassadors?.phone ? `${order.ambassadors.phone.substring(0, 3)}***` : 'NOT SET');
    } catch (smsError) {
      console.error('❌ Error building SMS message:', smsError);
      return res.status(500).json({
        success: false,
        error: 'Failed to build SMS message',
        details: smsError.message
      });
    }

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

// ============================================
// GET /api/admin/phone-numbers/sources - Get phone numbers from selected sources with filters
// ============================================
app.get('/api/admin/phone-numbers/sources', requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase not configured' });
    }

    const { sources, includeMetadata } = req.query;
    
    if (!sources) {
      return res.status(400).json({ success: false, error: 'Sources parameter is required' });
    }

    let sourcesConfig;
    try {
      sourcesConfig = typeof sources === 'string' ? JSON.parse(sources) : sources;
    } catch (e) {
      return res.status(400).json({ success: false, error: 'Invalid sources JSON format' });
    }

    const allPhoneNumbers = [];
    const sourceCounts = {};

    // Helper function to normalize phone number (8 digits, no prefix)
    const normalizePhone = (phone) => {
      if (!phone) return null;
      let cleaned = phone.replace(/\D/g, '');
      if (cleaned.startsWith('216')) cleaned = cleaned.substring(3);
      cleaned = cleaned.replace(/^0+/, '');
      if (cleaned.length === 8 && /^[2594]/.test(cleaned)) {
        return cleaned;
      }
      return null;
    };

    // Helper function to deduplicate
    const deduplicate = (numbers) => {
      const seen = new Map();
      const duplicates = [];
      
      numbers.forEach(num => {
        const normalized = normalizePhone(num.phone);
        if (!normalized) return;
        
        if (seen.has(normalized)) {
          const existing = seen.get(normalized);
          duplicates.push({
            phone: normalized,
            sources: [existing.source, num.source]
          });
        } else {
          seen.set(normalized, num);
        }
      });
      
      return {
        unique: Array.from(seen.values()),
        duplicates
      };
    };

    // 1. Ambassador Applications
    if (sourcesConfig.ambassador_applications?.enabled) {
      let query = supabase
        .from('ambassador_applications')
        .select('id, phone_number, city, ville, status, full_name');
      
      const filters = sourcesConfig.ambassador_applications.filters || {};
      
      if (filters.status && Array.isArray(filters.status) && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }
      if (filters.city) {
        query = query.eq('city', filters.city);
      }
      if (filters.ville) {
        query = query.eq('ville', filters.ville);
      }
      
      const { data, error } = await query.not('phone_number', 'is', null);
      
      if (!error && data) {
        const phones = data
          .filter(app => app.phone_number)
          .map(app => ({
            phone: normalizePhone(app.phone_number),
            source: 'ambassador_applications',
            sourceId: app.id,
            city: app.city || null,
            ville: app.ville || null,
            metadata: includeMetadata ? {
              status: app.status,
              full_name: app.full_name
            } : undefined
          }))
          .filter(p => p.phone);
        
        allPhoneNumbers.push(...phones);
        sourceCounts.ambassador_applications = phones.length;
      }
    }

    // 2. Orders (Clients)
    if (sourcesConfig.orders?.enabled) {
      let query = supabase
        .from('orders')
        .select('id, user_phone, city, ville, status, payment_method, source, user_name, order_number');
      
      const filters = sourcesConfig.orders.filters || {};
      
      // City filter is required for orders
      if (filters.city) {
        query = query.eq('city', filters.city);
      }
      if (filters.ville) {
        query = query.eq('ville', filters.ville);
      }
      if (filters.status && Array.isArray(filters.status) && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }
      if (filters.payment_method) {
        query = query.eq('payment_method', filters.payment_method);
      }
      if (filters.source) {
        query = query.eq('source', filters.source);
      }
      
      const { data, error } = await query.not('user_phone', 'is', null);
      
      if (!error && data) {
        const phones = data
          .filter(order => order.user_phone)
          .map(order => ({
            phone: normalizePhone(order.user_phone),
            source: 'orders',
            sourceId: order.id,
            city: order.city || null,
            ville: order.ville || null,
            metadata: includeMetadata ? {
              order_number: order.order_number,
              user_name: order.user_name,
              status: order.status,
              payment_method: order.payment_method,
              source: order.source
            } : undefined
          }))
          .filter(p => p.phone);
        
        allPhoneNumbers.push(...phones);
        sourceCounts.orders = phones.length;
      }
    }

    // 3. AIO Events Submissions
    if (sourcesConfig.aio_events_submissions?.enabled) {
      let query = supabase
        .from('aio_events_submissions')
        .select('id, phone, city, ville, status, full_name, event_id');
      
      const filters = sourcesConfig.aio_events_submissions.filters || {};
      
      if (filters.city) {
        query = query.eq('city', filters.city);
      }
      if (filters.ville) {
        query = query.eq('ville', filters.ville);
      }
      if (filters.status && Array.isArray(filters.status) && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }
      if (filters.event_id) {
        query = query.eq('event_id', filters.event_id);
      }
      
      const { data, error } = await query.not('phone', 'is', null);
      
      if (!error && data) {
        const phones = data
          .filter(sub => sub.phone)
          .map(sub => ({
            phone: normalizePhone(sub.phone),
            source: 'aio_events_submissions',
            sourceId: sub.id,
            city: sub.city || null,
            ville: sub.ville || null,
            metadata: includeMetadata ? {
              status: sub.status,
              full_name: sub.full_name,
              event_id: sub.event_id
            } : undefined
          }))
          .filter(p => p.phone);
        
        allPhoneNumbers.push(...phones);
        sourceCounts.aio_events_submissions = phones.length;
      }
    }

    // 4. Approved Ambassadors
    if (sourcesConfig.approved_ambassadors?.enabled) {
      let query = supabase
        .from('ambassadors')
        .select('id, phone, city, ville, full_name, status')
        .eq('status', 'approved');
      
      const filters = sourcesConfig.approved_ambassadors.filters || {};
      
      if (filters.city) {
        query = query.eq('city', filters.city);
      }
      if (filters.ville) {
        query = query.eq('ville', filters.ville);
      }
      
      const { data, error } = await query.not('phone', 'is', null);
      
      if (!error && data) {
        const phones = data
          .filter(amb => amb.phone)
          .map(amb => ({
            phone: normalizePhone(amb.phone),
            source: 'approved_ambassadors',
            sourceId: amb.id,
            city: amb.city || null,
            ville: amb.ville || null,
            metadata: includeMetadata ? {
              full_name: amb.full_name,
              status: amb.status
            } : undefined
          }))
          .filter(p => p.phone);
        
        allPhoneNumbers.push(...phones);
        sourceCounts.approved_ambassadors = phones.length;
      }
    }

    // 5. Phone Subscribers
    if (sourcesConfig.phone_subscribers?.enabled) {
      let query = supabase
        .from('phone_subscribers')
        .select('id, phone_number, city, subscribed_at');
      
      const filters = sourcesConfig.phone_subscribers.filters || {};
      
      if (filters.city) {
        query = query.eq('city', filters.city);
      }
      if (filters.dateFrom) {
        query = query.gte('subscribed_at', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('subscribed_at', filters.dateTo);
      }
      
      const { data, error } = await query;
      
      if (!error && data) {
        const phones = data
          .filter(sub => sub.phone_number)
          .map(sub => ({
            phone: normalizePhone(sub.phone_number),
            source: 'phone_subscribers',
            sourceId: sub.id,
            city: sub.city || null,
            ville: null,
            metadata: includeMetadata ? {
              subscribed_at: sub.subscribed_at
            } : undefined
          }))
          .filter(p => p.phone);
        
        allPhoneNumbers.push(...phones);
        sourceCounts.phone_subscribers = phones.length;
      }
    }

    // Deduplicate phone numbers
    const { unique, duplicates } = deduplicate(allPhoneNumbers);

    res.json({
      success: true,
      data: {
        phoneNumbers: unique,
        counts: {
          total: allPhoneNumbers.length,
          unique: unique.length,
          duplicates: duplicates.length,
          bySource: sourceCounts
        },
        duplicates
      }
    });

  } catch (error) {
    console.error('Error fetching phone numbers:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch phone numbers'
    });
  }
});

// ============================================
// GET /api/admin/phone-numbers/counts - Get quick counts per source
// ============================================
app.get('/api/admin/phone-numbers/counts', requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Supabase not configured' });
    }

    const { sources } = req.query;
    const requestedSources = sources ? (typeof sources === 'string' ? sources.split(',') : sources) : 
      ['ambassador_applications', 'orders', 'aio_events_submissions', 'approved_ambassadors', 'phone_subscribers'];

    const counts = {};

    // Ambassador Applications
    if (requestedSources.includes('ambassador_applications')) {
      const { count: total } = await supabase
        .from('ambassador_applications')
        .select('*', { count: 'exact', head: true });
      
      const { count: withPhone } = await supabase
        .from('ambassador_applications')
        .select('*', { count: 'exact', head: true })
        .not('phone_number', 'is', null);

      const { data: statusData } = await supabase
        .from('ambassador_applications')
        .select('status')
        .not('phone_number', 'is', null);

      const byStatus = {};
      if (statusData) {
        statusData.forEach(item => {
          byStatus[item.status] = (byStatus[item.status] || 0) + 1;
        });
      }

      counts.ambassador_applications = {
        total: total || 0,
        withPhone: withPhone || 0,
        byStatus
      };
    }

    // Orders
    if (requestedSources.includes('orders')) {
      const { count: total } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });
      
      const { count: withPhone } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .not('user_phone', 'is', null);

      const { data: cityData } = await supabase
        .from('orders')
        .select('city')
        .not('user_phone', 'is', null);

      const byCity = {};
      if (cityData) {
        cityData.forEach(item => {
          if (item.city) {
            byCity[item.city] = (byCity[item.city] || 0) + 1;
          }
        });
      }

      counts.orders = {
        total: total || 0,
        withPhone: withPhone || 0,
        byCity
      };
    }

    // AIO Events Submissions
    if (requestedSources.includes('aio_events_submissions')) {
      const { count: total } = await supabase
        .from('aio_events_submissions')
        .select('*', { count: 'exact', head: true });
      
      const { count: withPhone } = await supabase
        .from('aio_events_submissions')
        .select('*', { count: 'exact', head: true })
        .not('phone', 'is', null);

      counts.aio_events_submissions = {
        total: total || 0,
        withPhone: withPhone || 0
      };
    }

    // Approved Ambassadors
    if (requestedSources.includes('approved_ambassadors')) {
      const { count: total } = await supabase
        .from('ambassadors')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved');
      
      const { count: withPhone } = await supabase
        .from('ambassadors')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')
        .not('phone', 'is', null);

      counts.approved_ambassadors = {
        total: total || 0,
        withPhone: withPhone || 0
      };
    }

    // Phone Subscribers
    if (requestedSources.includes('phone_subscribers')) {
      const { count: total } = await supabase
        .from('phone_subscribers')
        .select('*', { count: 'exact', head: true });
      
      const { count: withPhone } = await supabase
        .from('phone_subscribers')
        .select('*', { count: 'exact', head: true })
        .not('phone_number', 'is', null);

      counts.phone_subscribers = {
        total: total || 0,
        withPhone: withPhone || 0
      };
    }

    res.json({
      success: true,
      data: counts
    });

  } catch (error) {
    console.error('Error fetching phone number counts:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch phone number counts'
    });
  }
});

// ============================================
// POST /api/admin/bulk-sms/send - Send bulk SMS to selected phone numbers
// ============================================
app.post('/api/admin/bulk-sms/send', requireAdminAuth, async (req, res) => {
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

    const { phoneNumbers, message, sources, filters, metadata } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return res.status(400).json({ success: false, error: 'Phone numbers array is required' });
    }

    // Get admin ID from JWT
    let adminId = null;
    try {
      const token = req.cookies?.admin_token || req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
        adminId = decoded.id || decoded.userId;
      }
    } catch (e) {
      // Ignore token errors
    }

    const results = [];
    const errors = [];
    const smsLogIds = [];

    // Process each phone number individually
    for (const phoneData of phoneNumbers) {
      // phoneData can be a string (phone number) or an object with phone, source, sourceId
      const phoneNumber = typeof phoneData === 'string' ? phoneData : phoneData.phone;
      const source = typeof phoneData === 'object' ? phoneData.source : null;
      const sourceId = typeof phoneData === 'object' ? phoneData.sourceId : null;
      
      const formattedNumber = formatPhoneNumber(phoneNumber);
      
      if (!formattedNumber) {
        const errorMsg = `Invalid phone number format: ${phoneNumber}`;
        errors.push({ phone: phoneNumber, error: errorMsg });
        
        const { data: logData } = await supabase.from('sms_logs').insert({
          phone_number: phoneNumber,
          message: message.trim(),
          status: 'failed',
          error_message: errorMsg,
          source: source || null,
          source_id: sourceId || null,
          campaign_name: metadata?.campaignName || null,
          admin_id: adminId || null
        }).select('id').single();
        
        if (logData) smsLogIds.push(logData.id);
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
          const { data: logData } = await supabase.from('sms_logs').insert({
            phone_number: phoneNumber,
            message: message.trim(),
            status: 'sent',
            api_response: JSON.stringify(responseData.data || responseData.raw),
            sent_at: new Date().toISOString(),
            source: source || null,
            source_id: sourceId || null,
            campaign_name: metadata?.campaignName || null,
            admin_id: adminId || null
          }).select('id').single();
          
          if (logData) smsLogIds.push(logData.id);
          
          results.push({ 
            phone: phoneNumber, 
            status: 'sent',
            source: source || null,
            sourceId: sourceId || null,
            sentAt: new Date().toISOString(),
            apiResponse: responseData.data || responseData.raw
          });
        } else {
          const errorMsg = responseData.data?.message || 
                          (responseData.data?.code ? `Error code ${responseData.data.code}` : 'SMS sending failed');
          
          const { data: logData } = await supabase.from('sms_logs').insert({
            phone_number: phoneNumber,
            message: message.trim(),
            status: 'failed',
            error_message: errorMsg,
            api_response: JSON.stringify(responseData.data || responseData.raw),
            source: source || null,
            source_id: sourceId || null,
            campaign_name: metadata?.campaignName || null,
            admin_id: adminId || null
          }).select('id').single();
          
          if (logData) smsLogIds.push(logData.id);
          
          errors.push({ 
            phone: phoneNumber, 
            status: 'failed',
            source: source || null,
            sourceId: sourceId || null,
            error: errorMsg,
            apiResponse: responseData.data || responseData.raw
          });
        }
      } catch (error) {
        const errorMsg = error.message || 'Unknown error';
        
        const { data: logData } = await supabase.from('sms_logs').insert({
          phone_number: phoneNumber,
          message: message.trim(),
          status: 'failed',
          error_message: errorMsg,
          api_response: null,
          source: source || null,
          source_id: sourceId || null,
          campaign_name: metadata?.campaignName || null,
          admin_id: adminId || null
        }).select('id').single();
        
        if (logData) smsLogIds.push(logData.id);
        
        errors.push({ 
          phone: phoneNumber, 
          status: 'failed',
          source: source || null,
          sourceId: sourceId || null,
          error: errorMsg
        });
      }

      // Small delay between requests to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    res.json({
      success: true,
      data: {
        total: phoneNumbers.length,
        sent: results.length,
        failed: errors.length,
        results: [...results, ...errors],
        smsLogIds
      }
    });

  } catch (error) {
    console.error('Error sending bulk SMS:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send bulk SMS'
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
// PHASE 3: ORDER CANCELLATION ENDPOINTS (with stock release)
// ============================================

// POST /api/ambassador/cancel-order - Cancel order by ambassador
app.post('/api/ambassador/cancel-order', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { orderId, ambassadorId, reason } = req.body;

    if (!orderId || !ambassadorId || !reason) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'orderId, ambassadorId, and reason are required'
      });
    }

    const dbClient = supabaseService || supabase;

    // Verify order exists and belongs to ambassador
    const { data: order, error: orderError } = await dbClient
      .from('orders')
      .select('id, ambassador_id, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.ambassador_id !== ambassadorId) {
      return res.status(403).json({ error: 'Order does not belong to this ambassador' });
    }

    if (order.status === 'CANCELLED_BY_AMBASSADOR' || order.status === 'COMPLETED' || order.status === 'PAID') {
      return res.status(400).json({
        error: 'Order cannot be cancelled',
        details: `Order status is ${order.status}`
      });
    }

    // Update order status
    const { error: updateError } = await dbClient
      .from('orders')
      .update({
        status: 'CANCELLED_BY_AMBASSADOR',
        cancelled_by: 'ambassador',
        cancellation_reason: reason.trim(),
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (updateError) {
      return res.status(500).json({
        error: 'Failed to cancel order',
        details: updateError.message
      });
    }

    // CRITICAL: Release stock
    try {
      await releaseOrderStock(orderId, `Cancelled by ambassador: ${reason.trim()}`);
    } catch (stockError) {
      console.error('❌ Error releasing stock on ambassador cancel:', stockError);
      // Log but don't fail - order is cancelled, stock release is important but non-blocking
    }

    // Log cancellation
    try {
      await dbClient.from('order_logs').insert({
        order_id: orderId,
        action: 'cancelled',
        performed_by: ambassadorId,
        performed_by_type: 'ambassador',
        details: { reason: reason.trim(), cancelled_by: 'ambassador' }
      });
    } catch (logError) {
      console.warn('Failed to log cancellation (non-fatal):', logError);
    }

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully'
    });

  } catch (error) {
    console.error('Error in /api/ambassador/cancel-order:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// GET /api/ambassador/orders - Get ambassador's orders (excludes REMOVED_BY_ADMIN)
app.get('/api/ambassador/orders', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { ambassadorId, status, limit = 100 } = req.query;

    if (!ambassadorId) {
      return res.status(400).json({
        error: 'Missing required field',
        details: 'ambassadorId is required'
      });
    }

    const dbClient = supabaseService || supabase;

    // Verify ambassador exists and is approved
    const { data: ambassador, error: ambassadorError } = await dbClient
      .from('ambassadors')
      .select('id, status')
      .eq('id', ambassadorId)
      .single();

    if (ambassadorError || !ambassador) {
      return res.status(404).json({ error: 'Ambassador not found' });
    }

    if (ambassador.status !== 'approved') {
      return res.status(403).json({ 
        error: 'Ambassador not approved',
        details: 'Only approved ambassadors can access orders'
      });
    }

    // Build query - exclude REMOVED_BY_ADMIN by default
    let query = dbClient
      .from('orders')
      .select('*, order_passes (*)')
      .eq('ambassador_id', ambassadorId)
      .neq('status', 'REMOVED_BY_ADMIN') // Exclude removed orders
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    // Apply status filter if provided
    if (status) {
      if (status === 'REMOVED_BY_ADMIN') {
        // If explicitly requesting removed orders, show only those
        query = dbClient
          .from('orders')
          .select('*, order_passes (*)')
          .eq('ambassador_id', ambassadorId)
          .eq('status', 'REMOVED_BY_ADMIN')
          .order('created_at', { ascending: false })
          .limit(parseInt(limit));
      } else {
        query = query.eq('status', status);
      }
    }

    // Check and auto-reject expired orders before fetching (on-demand checking)
    try {
      await dbClient.rpc('auto_reject_expired_pending_cash_orders');
    } catch (rejectError) {
      // Log but don't fail the request if auto-rejection fails
      console.warn('Warning: Failed to auto-reject expired orders:', rejectError);
    }

    const { data: orders, error: ordersError } = await query;

    if (ordersError) {
      console.error('Error fetching ambassador orders:', ordersError);
      return res.status(500).json({
        error: 'Failed to fetch orders',
        details: ordersError.message
      });
    }

    res.json({
      success: true,
      data: orders || [],
      count: orders?.length || 0
    });

  } catch (error) {
    console.error('Error in /api/ambassador/orders:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// GET /api/ambassador/performance - Get ambassador performance metrics (excludes REMOVED_BY_ADMIN)
app.get('/api/ambassador/performance', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { ambassadorId } = req.query;

    if (!ambassadorId) {
      return res.status(400).json({
        error: 'Missing required field',
        details: 'ambassadorId is required'
      });
    }

    const dbClient = supabaseService || supabase;

    // Verify ambassador exists and is approved
    const { data: ambassador, error: ambassadorError } = await dbClient
      .from('ambassadors')
      .select('id, status')
      .eq('id', ambassadorId)
      .single();

    if (ambassadorError || !ambassador) {
      return res.status(404).json({ error: 'Ambassador not found' });
    }

    if (ambassador.status !== 'approved') {
      return res.status(403).json({ 
        error: 'Ambassador not approved',
        details: 'Only approved ambassadors can access performance data'
      });
    }

    // Fetch all orders with order_passes (exclude REMOVED_BY_ADMIN)
    const { data: allOrders, error: ordersError } = await dbClient
      .from('orders')
      .select('*, order_passes (*)')
      .eq('ambassador_id', ambassadorId)
      .neq('status', 'REMOVED_BY_ADMIN'); // Exclude removed orders from performance

    if (ordersError) {
      console.error('Error fetching ambassador orders for performance:', ordersError);
      return res.status(500).json({
        error: 'Failed to fetch orders',
        details: ordersError.message
      });
    }

    const activeOrders = allOrders || [];

    // Calculate metrics
    const total = activeOrders.length;
    const paid = activeOrders.filter(o => o.status === 'PAID').length;
    const cancelled = activeOrders.filter(o => 
      o.status === 'CANCELLED' || 
      o.status === 'CANCELLED_BY_AMBASSADOR' || 
      o.status === 'CANCELLED_BY_ADMIN'
    ).length;
    const rejected = activeOrders.filter(o => o.status === 'REJECTED').length;
    const ignored = activeOrders.filter(o => 
      (o.status === 'PENDING') && 
      o.assigned_at &&
      new Date(o.assigned_at).getTime() < Date.now() - 15 * 60 * 1000 &&
      !o.accepted_at
    ).length;

    // Calculate revenue from PAID orders only
    const revenueOrders = activeOrders.filter(o => o.status === 'PAID');
    let totalRevenue = 0;
    let totalPassesSold = 0;

    revenueOrders.forEach(order => {
      if (order.order_passes && Array.isArray(order.order_passes)) {
        order.order_passes.forEach((pass) => {
          totalRevenue += parseFloat(pass.price || 0) * parseInt(pass.quantity || 0);
          totalPassesSold += parseInt(pass.quantity || 0);
        });
      } else {
        // Fallback to total_price if order_passes not available
        totalRevenue += parseFloat(order.total_price || 0);
        totalPassesSold += 1;
      }
    });

    // Calculate average response time
    const acceptedOrders = activeOrders.filter(o => o.accepted_at && o.assigned_at);
    let averageResponseTime = 0;
    if (acceptedOrders.length > 0) {
      const totalResponseTime = acceptedOrders.reduce((sum, order) => {
        const assigned = new Date(order.assigned_at);
        const accepted = new Date(order.accepted_at);
        return sum + (accepted.getTime() - assigned.getTime());
      }, 0);
      averageResponseTime = totalResponseTime / acceptedOrders.length / 1000 / 60; // Convert to minutes
    }

    res.json({
      success: true,
      data: {
        total,
        paid,
        cancelled,
        rejected,
        ignored,
        totalPassesSold,
        totalRevenue,
        averageResponseTime: Math.round(averageResponseTime * 10) / 10 // Round to 1 decimal
      }
    });

  } catch (error) {
    console.error('Error in /api/ambassador/performance:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// POST /api/admin/cancel-order - Cancel order by admin
app.post('/api/admin/cancel-order', requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { orderId, reason } = req.body;
    const adminId = req.admin?.id;

    if (!orderId || !reason) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'orderId and reason are required'
      });
    }

    const dbClient = supabaseService || supabase;

    // Verify order exists
    const { data: order, error: orderError } = await dbClient
      .from('orders')
      .select('id, status, payment_status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Determine cancellation status based on current status
    let cancelStatus;
    if (order.status === 'PAID' || order.payment_status === 'PAID') {
      cancelStatus = 'REFUNDED';  // Paid orders become REFUNDED
    } else {
      cancelStatus = 'CANCELLED_BY_AMBASSADOR';  // Pending orders become CANCELLED
    }

    // Update order status
    const updateData = {
      status: cancelStatus,
      payment_status: cancelStatus === 'REFUNDED' ? 'REFUNDED' : order.payment_status,
      cancelled_by: 'admin',
      cancellation_reason: reason.trim(),
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await dbClient
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (updateError) {
      return res.status(500).json({
        error: 'Failed to cancel order',
        details: updateError.message
      });
    }

    // CRITICAL: Release stock (for both CANCELLED and REFUNDED)
    try {
      await releaseOrderStock(orderId, `Cancelled/Refunded by admin: ${reason.trim()}`);
    } catch (stockError) {
      console.error('❌ Error releasing stock on admin cancel:', stockError);
      // Log but don't fail
    }

    // Log cancellation
    try {
      await dbClient.from('order_logs').insert({
        order_id: orderId,
        action: cancelStatus === 'REFUNDED' ? 'admin_refunded' : 'cancelled',
        performed_by: adminId,
        performed_by_type: 'admin',
        details: {
          reason: reason.trim(),
          cancelled_by: 'admin',
          previous_status: order.status,
          new_status: cancelStatus
        }
      });
    } catch (logError) {
      console.warn('Failed to log cancellation (non-fatal):', logError);
    }

    res.status(200).json({
      success: true,
      message: `Order ${cancelStatus === 'REFUNDED' ? 'refunded' : 'cancelled'} successfully`,
      newStatus: cancelStatus
    });

  } catch (error) {
    console.error('Error in /api/admin/cancel-order:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// POST /api/admin/reject-order - Reject COD order (admin reject pending order)
// POST /api/admin-remove-order - Admin-only endpoint to soft-delete orders (set status to REMOVED_BY_ADMIN)
app.post('/api/admin-remove-order', requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { orderId } = req.body;
    const adminId = req.admin?.id;
    const adminEmail = req.admin?.email;

    if (!orderId) {
      return res.status(400).json({
        error: 'Order ID is required',
        details: 'orderId must be provided'
      });
    }

    console.log('✅ ADMIN: Remove Order Request:', {
      orderId,
      adminId,
      adminEmail: adminEmail ? `${adminEmail.substring(0, 3)}***` : 'NOT SET'
    });

    const dbClient = supabaseService || supabase;

    // Step 1: Verify order exists and get current status
    const { data: order, error: orderError } = await dbClient
      .from('orders')
      .select('id, status, payment_method, payment_status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('❌ Order not found:', orderId);
      return res.status(404).json({
        error: 'Order not found',
        details: `No order found with id: ${orderId}`
      });
    }

    console.log('✅ Order status check:', {
      orderId: order.id,
      currentStatus: order.status,
      paymentMethod: order.payment_method
    });

    // Step 2: Validate order status (must NOT be PAID)
    if (order.status === 'PAID') {
      console.error('❌ Cannot remove PAID order:', order.status);

      // Log security event
      try {
        await dbClient.from('security_audit_logs').insert({
          event_type: 'invalid_order_removal',
          endpoint: '/api/admin-remove-order',
          user_id: adminId,
          ip_address: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown',
          user_agent: req.headers['user-agent'] || 'unknown',
          request_method: req.method,
          request_path: req.url,
          details: {
            reason: 'Cannot remove PAID orders',
            order_id: orderId,
            current_status: order.status,
            attempted_action: 'remove_order'
          },
          severity: 'medium'
        });
      } catch (logError) {
        console.error('Failed to log security event:', logError);
      }

      return res.status(400).json({
        error: 'Cannot remove paid order',
        details: 'PAID orders cannot be removed. Only non-PAID orders can be removed.'
      });
    }

    // Step 3: Check if order is already removed
    if (order.status === 'REMOVED_BY_ADMIN') {
      console.log('⚠️ Order already removed (idempotent call)');
      return res.status(200).json({
        success: true,
        message: 'Order already removed (idempotent call)',
        orderId: orderId,
        status: 'REMOVED_BY_ADMIN'
      });
    }

    // Step 4: Get order_passes to prepare for stock decrease (for future feature #2)
    const { data: orderPasses, error: passesError } = await dbClient
      .from('order_passes')
      .select('*')
      .eq('order_id', orderId);

    if (passesError) {
      console.error('⚠️ Error fetching order passes (non-critical):', passesError);
    }

    // Step 5: Update order status to REMOVED_BY_ADMIN (soft delete)
    const oldStatus = order.status;
    const { data: updatedOrder, error: updateError } = await dbClient
      .from('orders')
      .update({
        status: 'REMOVED_BY_ADMIN',
        removed_at: new Date().toISOString(),
        removed_by: adminId,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .eq('status', oldStatus) // Only update if status hasn't changed (idempotency)
      .select('id, status, removed_at, removed_by')
      .single();

    if (updateError || !updatedOrder) {
      // Check if order was already updated (idempotency check)
      const { data: checkOrder } = await dbClient
        .from('orders')
        .select('id, status')
        .eq('id', orderId)
        .single();

      if (checkOrder && checkOrder.status === 'REMOVED_BY_ADMIN') {
        console.log('⚠️ Order already removed (idempotent call)');
        return res.status(200).json({
          success: true,
          message: 'Order already removed (idempotent call)',
          orderId: orderId,
          status: 'REMOVED_BY_ADMIN'
        });
      }

      console.error('❌ Error updating order status:', updateError);
      return res.status(500).json({
        error: 'Failed to remove order',
        details: updateError?.message || 'Unknown error'
      });
    }

    console.log('✅ Order removed successfully:', {
      orderId: updatedOrder.id,
      oldStatus,
      newStatus: updatedOrder.status,
      removedAt: updatedOrder.removed_at,
      removedBy: updatedOrder.removed_by
    });

    // Step 6: Release stock (decrease sold_quantity)
    try {
      await releaseOrderStock(orderId, `Removed by admin: ${adminEmail || 'Unknown admin'}`);
      console.log('✅ Stock released successfully');
    } catch (stockError) {
      console.error('❌ Error releasing stock on admin remove:', stockError);
      // Log but don't fail - order is removed, stock release is important but non-blocking
    }

    // Step 7: Log to order_logs (audit trail)
    try {
      await dbClient.from('order_logs').insert({
        order_id: orderId,
        action: 'admin_remove',
        performed_by: adminId,
        performed_by_type: 'admin',
        details: {
          old_status: oldStatus,
          new_status: 'REMOVED_BY_ADMIN',
          admin_email: adminEmail,
          admin_action: true,
          removed_at: updatedOrder.removed_at
        }
      });
      console.log('✅ Audit log created');
    } catch (logError) {
      console.error('❌ Error creating audit log:', logError);
    }

    console.log('✅ ADMIN: Remove Order Completed');

    return res.status(200).json({
      success: true,
      message: 'Order removed successfully',
      orderId: orderId,
      oldStatus,
      newStatus: 'REMOVED_BY_ADMIN',
      removedAt: updatedOrder.removed_at,
      removedBy: updatedOrder.removed_by
    });

  } catch (error) {
    console.error('❌ ADMIN: Remove Order Error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    return res.status(500).json({
      error: 'Failed to remove order',
      details: error.message
    });
  }
});

app.post('/api/admin/reject-order', requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { orderId, reason } = req.body;
    const adminId = req.admin?.id;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const dbClient = supabaseService || supabase;

    // Verify order exists and is in valid status for rejection
    const { data: order, error: orderError } = await dbClient
      .from('orders')
      .select('id, status, payment_method')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status !== 'PENDING_ADMIN_APPROVAL' && order.status !== 'PENDING_CASH') {
      return res.status(400).json({
        error: 'Order cannot be rejected',
        details: `Order status must be PENDING_ADMIN_APPROVAL or PENDING_CASH, current: ${order.status}`
      });
    }

    // Update order status
    const updateData = {
      status: 'REJECTED',
      rejected_at: new Date().toISOString(),
      rejection_reason: reason || null,
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await dbClient
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (updateError) {
      return res.status(500).json({
        error: 'Failed to reject order',
        details: updateError.message
      });
    }

    // CRITICAL: Release stock
    try {
      await releaseOrderStock(orderId, `Rejected by admin: ${reason || 'No reason provided'}`);
    } catch (stockError) {
      console.error('❌ Error releasing stock on admin reject:', stockError);
    }

    // Log rejection
    try {
      await dbClient.from('order_logs').insert({
        order_id: orderId,
        action: 'rejected',
        performed_by: adminId,
        performed_by_type: 'admin',
        details: {
          old_status: order.status,
          new_status: 'REJECTED',
          rejection_reason: reason || null,
          admin_action: true
        }
      });
    } catch (logError) {
      console.warn('Failed to log rejection (non-fatal):', logError);
    }

    res.status(200).json({
      success: true,
      message: 'Order rejected successfully'
    });

  } catch (error) {
    console.error('Error in /api/admin/reject-order:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// ============================================
// PHASE 4: PUBLIC PASSES ENDPOINT (with stock info)
// ============================================

// GET /api/passes/:eventId - Get active passes for an event with stock information
app.get('/api/passes/:eventId', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { eventId } = req.params;

    if (!eventId) {
      return res.status(400).json({ error: 'Event ID is required' });
    }

    const dbClient = supabaseService || supabase;

    // Fetch only active passes with stock information
    const { data: passes, error: passesError } = await dbClient
      .from('event_passes')
      .select('id, name, price, description, is_primary, is_active, max_quantity, sold_quantity, release_version, allowed_payment_methods')
      .eq('event_id', eventId)
      .eq('is_active', true)  // Only active passes
      .order('is_primary', { ascending: false })
      .order('price', { ascending: true })
      .order('release_version', { ascending: false });

    if (passesError) {
      console.error('❌ Error fetching passes for event:', eventId, passesError);
      return res.status(500).json({
        error: 'Failed to fetch passes',
        details: passesError.message,
        code: passesError.code
      });
    }

    // Calculate stock information for each pass
    const passesWithStock = (passes || []).map(pass => {
      const isUnlimited = pass.max_quantity === null;
      const remainingQuantity = isUnlimited ? null : (pass.max_quantity - pass.sold_quantity);
      const isSoldOut = !isUnlimited && remainingQuantity <= 0;

      return {
        id: pass.id,
        name: pass.name,
        price: parseFloat(pass.price),
        description: pass.description || '',
        is_primary: pass.is_primary || false,
        is_active: pass.is_active,
        release_version: pass.release_version || 1,
        // Stock information
        max_quantity: pass.max_quantity,
        sold_quantity: pass.sold_quantity || 0,
        remaining_quantity: remainingQuantity,
        is_unlimited: isUnlimited,
        is_sold_out: isSoldOut,
        // Payment method restrictions
        allowed_payment_methods: pass.allowed_payment_methods || null
      };
    });

    res.status(200).json({
      success: true,
      passes: passesWithStock
    });

  } catch (error) {
    console.error('Error in /api/passes/:eventId:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// ============================================
// PHASE 4: ADMIN STOCK MANAGEMENT ENDPOINTS
// ============================================

// GET /api/admin/passes/:eventId - Get all passes (including inactive) with stock info
app.get('/api/admin/passes/:eventId', requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { eventId } = req.params;

    if (!eventId) {
      return res.status(400).json({ error: 'Event ID is required' });
    }

    const dbClient = supabaseService || supabase;

    // Fetch ALL passes (including inactive) with stock information
    const { data: passes, error: passesError } = await dbClient
      .from('event_passes')
      .select('id, name, price, description, is_primary, is_active, max_quantity, sold_quantity, release_version, allowed_payment_methods, created_at, updated_at')
      .eq('event_id', eventId)
      .order('release_version', { ascending: false })
      .order('is_primary', { ascending: false })
      .order('price', { ascending: true });

    if (passesError) {
      console.error('Error fetching passes:', passesError);
      return res.status(500).json({
        error: 'Failed to fetch passes',
        details: passesError.message
      });
    }

    // Calculate stock information for each pass
    const passesWithStock = (passes || []).map(pass => {
      const isUnlimited = pass.max_quantity === null;
      const remainingQuantity = isUnlimited ? null : (pass.max_quantity - pass.sold_quantity);

      return {
        id: pass.id,
        name: pass.name,
        price: parseFloat(pass.price),
        description: pass.description || '',
        is_primary: pass.is_primary || false,
        is_active: pass.is_active,
        release_version: pass.release_version || 1,
        // Stock information
        max_quantity: pass.max_quantity,
        sold_quantity: pass.sold_quantity || 0,
        remaining_quantity: remainingQuantity,
        is_unlimited: isUnlimited,
        // Payment method restrictions
        allowed_payment_methods: pass.allowed_payment_methods || null,
        created_at: pass.created_at,
        updated_at: pass.updated_at
      };
    });

    res.status(200).json({
      success: true,
      passes: passesWithStock
    });

  } catch (error) {
    console.error('Error in /api/admin/passes/:eventId:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// POST /api/admin/passes/:id/stock - Update pass stock (max_quantity)
app.post('/api/admin/passes/:id/stock', requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { id } = req.params;
    const { max_quantity } = req.body;
    const adminId = req.admin?.id;
    const adminEmail = req.admin?.email;

    if (max_quantity !== null && max_quantity !== undefined && (typeof max_quantity !== 'number' || max_quantity < 0)) {
      return res.status(400).json({
        error: 'Invalid max_quantity',
        details: 'max_quantity must be null (unlimited) or a non-negative integer'
      });
    }

    const dbClient = supabaseService || supabase;

    // Fetch current pass state (for audit log)
    const { data: currentPass, error: fetchError } = await dbClient
      .from('event_passes')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentPass) {
      return res.status(404).json({ error: 'Pass not found' });
    }

    // Validation: Cannot decrease max_quantity below sold_quantity
    const newMaxQuantity = max_quantity === null || max_quantity === undefined ? null : parseInt(max_quantity);
    if (newMaxQuantity !== null && newMaxQuantity < currentPass.sold_quantity) {
      return res.status(400).json({
        error: 'Invalid stock reduction',
        details: `Cannot set max_quantity (${newMaxQuantity}) below sold_quantity (${currentPass.sold_quantity})`
      });
    }

    // Update max_quantity
    const { data: updatedPass, error: updateError } = await dbClient
      .from('event_passes')
      .update({
        max_quantity: newMaxQuantity,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating pass stock:', updateError);
      return res.status(500).json({
        error: 'Failed to update pass stock',
        details: updateError.message
      });
    }

    // Log admin action to security_audit_logs
    try {
      await dbClient.from('security_audit_logs').insert({
        event_type: 'admin_stock_update',
        user_id: adminId,
        endpoint: '/api/admin/passes/:id/stock',
        ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
        user_agent: req.headers['user-agent'] || 'unknown',
        details: {
          pass_id: id,
          event_id: currentPass.event_id,
          action: 'UPDATE_STOCK',
          before: {
            max_quantity: currentPass.max_quantity,
            sold_quantity: currentPass.sold_quantity,
            is_active: currentPass.is_active,
            release_version: currentPass.release_version,
            name: currentPass.name,
            price: currentPass.price
          },
          after: {
            max_quantity: updatedPass.max_quantity,
            sold_quantity: updatedPass.sold_quantity,
            is_active: updatedPass.is_active,
            release_version: updatedPass.release_version,
            name: updatedPass.name,
            price: updatedPass.price
          },
          admin_email: adminEmail
        },
        severity: 'medium'
      });
    } catch (logError) {
      console.warn('Failed to log stock update (non-fatal):', logError);
    }

    res.status(200).json({
      success: true,
      pass: {
        ...updatedPass,
        remaining_quantity: updatedPass.max_quantity === null ? null : (updatedPass.max_quantity - updatedPass.sold_quantity),
        is_unlimited: updatedPass.max_quantity === null
      }
    });

  } catch (error) {
    console.error('Error in /api/admin/passes/:id/stock:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// PUT /api/admin/passes/:id/payment-methods - Update pass payment method restrictions
app.put('/api/admin/passes/:id/payment-methods', requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { id } = req.params;
    const { allowed_payment_methods } = req.body;
    const adminId = req.admin?.id;
    const adminEmail = req.admin?.email;

    if (!adminId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!id) {
      return res.status(400).json({ error: 'Pass ID is required' });
    }

    const dbClient = supabaseService || supabase;

    // Fetch current pass to verify it exists
    const { data: currentPass, error: fetchError } = await dbClient
      .from('event_passes')
      .select('id, name, event_id, allowed_payment_methods')
      .eq('id', id)
      .single();

    if (fetchError || !currentPass) {
      return res.status(404).json({
        error: 'Pass not found',
        details: fetchError?.message || 'Pass does not exist'
      });
    }

    // Validate allowed_payment_methods if provided
    // NULL = all methods allowed (backward compatible)
    // Empty array = normalize to NULL
    // Non-empty array = must contain only valid values
    let normalizedMethods = null;
    if (allowed_payment_methods !== undefined) {
      if (Array.isArray(allowed_payment_methods)) {
        if (allowed_payment_methods.length === 0) {
          normalizedMethods = null;
        } else {
          // Validate all values are valid payment methods
          const validMethods = ['online', 'external_app', 'ambassador_cash'];
          const invalidMethods = allowed_payment_methods.filter(m => !validMethods.includes(m));
          if (invalidMethods.length > 0) {
            return res.status(400).json({
              error: 'Invalid payment methods',
              details: `Invalid payment methods: ${invalidMethods.join(', ')}. Valid values: ${validMethods.join(', ')}`
            });
          }
          normalizedMethods = allowed_payment_methods;
        }
      } else if (allowed_payment_methods === null) {
        normalizedMethods = null;
      } else {
        return res.status(400).json({
          error: 'Invalid format',
          details: 'allowed_payment_methods must be an array or null'
        });
      }
    }

    // Update pass
    const { data: updatedPass, error: updateError } = await dbClient
      .from('event_passes')
      .update({
        allowed_payment_methods: normalizedMethods,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating pass payment methods:', updateError);
      return res.status(500).json({
        error: 'Failed to update pass payment methods',
        details: updateError.message
      });
    }

    // Log admin action
    try {
      await dbClient.from('security_audit_logs').insert({
        event_type: 'admin_pass_payment_methods_update',
        user_id: adminId,
        endpoint: '/api/admin/passes/:id/payment-methods',
        ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
        user_agent: req.headers['user-agent'] || 'unknown',
        details: {
          pass_id: id,
          event_id: currentPass.event_id,
          action: 'UPDATE_PAYMENT_METHODS',
          before: {
            allowed_payment_methods: currentPass.allowed_payment_methods
          },
          after: {
            allowed_payment_methods: updatedPass.allowed_payment_methods
          },
          admin_email: adminEmail || 'unknown'
        },
        severity: 'medium'
      });
    } catch (logError) {
      console.warn('Failed to log payment methods update (non-fatal):', logError);
    }

    res.status(200).json({
      success: true,
      pass: updatedPass
    });

  } catch (error) {
    console.error('Error in /api/admin/passes/:id/payment-methods:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// POST /api/admin/passes/:id/activate - Activate/deactivate pass
app.post('/api/admin/passes/:id/activate', requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { id } = req.params;
    const { is_active } = req.body;
    const adminId = req.admin?.id;
    const adminEmail = req.admin?.email;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        error: 'Invalid is_active',
        details: 'is_active must be a boolean'
      });
    }

    const dbClient = supabaseService || supabase;

    // Fetch current pass state (for audit log)
    const { data: currentPass, error: fetchError } = await dbClient
      .from('event_passes')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentPass) {
      return res.status(404).json({ error: 'Pass not found' });
    }

    // Update is_active
    const { data: updatedPass, error: updateError } = await dbClient
      .from('event_passes')
      .update({
        is_active: is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating pass activation:', updateError);
      return res.status(500).json({
        error: 'Failed to update pass activation',
        details: updateError.message
      });
    }

    // Log admin action
    try {
      await dbClient.from('security_audit_logs').insert({
        event_type: 'admin_pass_activation',
        user_id: adminId,
        endpoint: '/api/admin/passes/:id/activate',
        ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
        user_agent: req.headers['user-agent'] || 'unknown',
        details: {
          pass_id: id,
          event_id: currentPass.event_id,
          action: 'ACTIVATE_PASS',
          before: {
            max_quantity: currentPass.max_quantity,
            sold_quantity: currentPass.sold_quantity,
            is_active: currentPass.is_active,
            release_version: currentPass.release_version,
            name: currentPass.name,
            price: currentPass.price
          },
          after: {
            max_quantity: updatedPass.max_quantity,
            sold_quantity: updatedPass.sold_quantity,
            is_active: updatedPass.is_active,
            release_version: updatedPass.release_version,
            name: updatedPass.name,
            price: updatedPass.price
          },
          admin_email: adminEmail
        },
        severity: 'medium'
      });
    } catch (logError) {
      console.warn('Failed to log pass activation (non-fatal):', logError);
    }

    res.status(200).json({
      success: true,
      pass: updatedPass
    });

  } catch (error) {
    console.error('Error in /api/admin/passes/:id/activate:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
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

    // For Sousse: ignore ville filter, show all ambassadors in Sousse
    // For other cities: filter by ville if provided
    if (normalizedVille && normalizedCity !== 'Sousse') {
      query = query.eq('ville', normalizedVille);
    }
    
    // Remove alphabetical ordering - will randomize instead
    // query = query.order('full_name'); // REMOVED: Now using random order

    const { data: ambassadors, error } = await query;

    if (error) {
      console.error('❌ Error fetching active ambassadors:', error);
      return res.status(500).json({ error: error.message });
    }

    // Shuffle ambassadors array using Fisher-Yates algorithm for random display
    const shuffledAmbassadors = shuffleArray(ambassadors || []);

    // Fetch social_link from ambassador_applications for each ambassador
    const ambassadorsWithSocial = await Promise.all(
      shuffledAmbassadors.map(async (ambassador) => {
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
    // Exclude REMOVED_BY_ADMIN orders from sales calculations (they should not appear in reports)
    const { data: allOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, total_price, ambassador_id, created_at, status, ambassadors!inner(full_name)')
      .eq('payment_method', 'ambassador_cash')
      .neq('status', 'REMOVED_BY_ADMIN'); // Exclude removed orders

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

    const { status, ambassador_id, city, ville, date_from, date_to, limit = 50, offset = 0, include_removed } = req.query;

    let query = supabase
      .from('orders')
      .select('*, order_passes (*), ambassadors (id, full_name, phone, email)', { count: 'exact' })
      .eq('payment_method', 'ambassador_cash')
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    
    // Include expiration fields in the select (they're part of *)

    // Exclude REMOVED_BY_ADMIN orders by default (only show when explicitly filtering by that status)
    // If status is REMOVED_BY_ADMIN, show only removed orders
    // Otherwise, exclude removed orders from results
    if (status === 'REMOVED_BY_ADMIN') {
      query = query.eq('status', 'REMOVED_BY_ADMIN');
    } else {
      // Default: exclude removed orders from all queries
      query = query.neq('status', 'REMOVED_BY_ADMIN');
      if (status) {
        query = query.eq('status', status);
      }
    }
    if (ambassador_id) query = query.eq('ambassador_id', ambassador_id);
    if (city) query = query.eq('city', city);
    if (ville) query = query.eq('ville', ville);
    if (date_from) query = query.gte('created_at', date_from);
    if (date_to) query = query.lte('created_at', date_to);

    // Check and auto-reject expired orders before fetching (on-demand checking)
    const dbClient = supabaseService || supabase;
    try {
      await dbClient.rpc('auto_reject_expired_pending_cash_orders');
    } catch (rejectError) {
      // Log but don't fail the request if auto-rejection fails
      console.warn('Warning: Failed to auto-reject expired orders:', rejectError);
    }

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
// Order Expiration Management Endpoints
// ============================================

// GET/POST /api/auto-reject-expired-orders - Manual trigger for external cron services
app.get('/api/auto-reject-expired-orders', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const dbClient = supabaseService || supabase;
    const { data, error } = await dbClient.rpc('auto_reject_expired_pending_cash_orders');

    if (error) {
      console.error('Error auto-rejecting expired orders:', error);
      return res.status(500).json({
        error: 'Failed to auto-reject expired orders',
        details: error.message
      });
    }

    const result = data && data[0] ? data[0] : { rejected_count: 0, rejected_order_ids: [] };

    res.json({
      success: true,
      rejected_count: result.rejected_count || 0,
      rejected_order_ids: result.rejected_order_ids || [],
      message: `Auto-rejected ${result.rejected_count || 0} expired order(s)`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in auto-reject-expired-orders:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

app.post('/api/auto-reject-expired-orders', async (req, res) => {
  // Same handler as GET
  return app._router.handle({ ...req, method: 'GET' }, res);
});

// GET /api/admin/order-expiration-settings - Get global expiration settings
app.get('/api/admin/order-expiration-settings', requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const dbClient = supabaseService || supabase;
    const { data, error } = await dbClient
      .from('order_expiration_settings')
      .select('*')
      .eq('order_status', 'PENDING_CASH')
      .order('order_status');

    if (error) {
      console.error('Error fetching expiration settings:', error);
      return res.status(500).json({ error: error.message });
    }

    // Only return PENDING_CASH settings (filter out others if any)
    const filteredData = (data || []).filter(setting => setting.order_status === 'PENDING_CASH');

    res.json({
      success: true,
      data: filteredData
    });
  } catch (error) {
    console.error('Error in order-expiration-settings GET:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch expiration settings' });
  }
});

// POST /api/admin/order-expiration-settings - Update global expiration settings
app.post('/api/admin/order-expiration-settings', requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { settings } = req.body; // Array of { order_status, default_expiration_hours, is_active }

    if (!Array.isArray(settings)) {
      return res.status(400).json({ error: 'Settings must be an array' });
    }

    const dbClient = supabaseService || supabase;
    const adminId = req.admin?.id;

    // Get current settings per status in the loop below
    
    // Update each setting
    const results = await Promise.all(
      settings.map(async (setting) => {
        const { order_status, default_expiration_hours, is_active } = setting;

        if (!order_status || !default_expiration_hours || default_expiration_hours <= 0) {
          throw new Error(`Invalid setting for ${order_status}`);
        }
        
        // Only allow PENDING_CASH
        if (order_status !== 'PENDING_CASH') {
          throw new Error(`Only PENDING_CASH expiration is supported. Invalid status: ${order_status}`);
        }
        
        // Get current setting to detect if activation status changed
        const { data: currentSetting } = await dbClient
          .from('order_expiration_settings')
          .select('*')
          .eq('order_status', order_status)
          .single();
        
        const wasActive = currentSetting?.is_active;
        const isNowActive = is_active !== undefined ? is_active : true;

        const { data, error } = await dbClient
          .from('order_expiration_settings')
          .upsert({
            order_status,
            default_expiration_hours,
            is_active: isNowActive,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'order_status'
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        // If activation status changed from false to true, apply expiration to existing orders
        if (order_status === 'PENDING_CASH' && !wasActive && isNowActive) {
          try {
            const { data: applyResult, error: applyError } = await dbClient
              .rpc('apply_expiration_to_existing_pending_cash_orders');
            
            if (applyError) {
              console.error('Error applying expiration to existing orders:', applyError);
            } else {
              console.log(`Applied expiration to ${applyResult?.[0]?.updated_count || 0} existing PENDING_CASH orders`);
            }
          } catch (rpcError) {
            console.error('Error calling apply_expiration_to_existing_pending_cash_orders:', rpcError);
            // Don't fail the whole request if this fails
          }
        } else if (order_status === 'PENDING_CASH' && wasActive && !isNowActive) {
          // Deactivated: Clear expiration from all existing PENDING_CASH orders
          try {
            const { data: clearResult, error: clearError } = await dbClient
              .rpc('clear_expiration_from_existing_pending_cash_orders');
            
            if (clearError) {
              console.error('Error clearing expiration from existing orders:', clearError);
            } else {
              console.log(`Cleared expiration from ${clearResult?.[0]?.cleared_count || 0} existing PENDING_CASH orders`);
            }
          } catch (rpcError) {
            console.error('Error calling clear_expiration_from_existing_pending_cash_orders:', rpcError);
            // Don't fail the whole request if this fails
          }
        } else if (order_status === 'PENDING_CASH' && wasActive && isNowActive && currentSetting?.default_expiration_hours !== default_expiration_hours) {
          // Hours changed while active - update existing orders with new expiration
          try {
            const { data: applyResult, error: applyError } = await dbClient
              .rpc('apply_expiration_to_existing_pending_cash_orders');
            
            if (applyError) {
              console.error('Error updating expiration for existing orders:', applyError);
            } else {
              console.log(`Updated expiration for ${applyResult?.[0]?.updated_count || 0} existing PENDING_CASH orders`);
            }
          } catch (rpcError) {
            console.error('Error calling apply_expiration_to_existing_pending_cash_orders:', rpcError);
          }
        }

        return data;
      })
    );

    res.json({
      success: true,
      data: results,
      message: 'Expiration settings updated successfully'
    });
  } catch (error) {
    console.error('Error in order-expiration-settings POST:', error);
    res.status(500).json({ error: error.message || 'Failed to update expiration settings' });
  }
});

// POST /api/admin/set-order-expiration - Set expiration for specific order
app.post('/api/admin/set-order-expiration', requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { orderId, expiresAt, reason } = req.body;
    const adminId = req.admin?.id;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    if (!expiresAt) {
      return res.status(400).json({ error: 'Expiration date is required' });
    }

    // Validate expiresAt is a valid future date
    const expirationDate = new Date(expiresAt);
    if (isNaN(expirationDate.getTime())) {
      return res.status(400).json({ error: 'Invalid expiration date format' });
    }

    if (expirationDate <= new Date()) {
      return res.status(400).json({ error: 'Expiration date must be in the future' });
    }

    const dbClient = supabaseService || supabase;

    // Verify order exists
    const { data: order, error: orderError } = await dbClient
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update order with expiration
    const { data: updatedOrder, error: updateError } = await dbClient
      .from('orders')
      .update({
        expires_at: expirationDate.toISOString(),
        expiration_set_by: adminId,
        expiration_notes: reason || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select('id, expires_at, expiration_set_by, expiration_notes')
      .single();

    if (updateError) {
      console.error('Error updating order expiration:', updateError);
      return res.status(500).json({ error: updateError.message });
    }

    // Log to order_logs
    try {
      await dbClient.from('order_logs').insert({
        order_id: orderId,
        action: 'expiration_set',
        performed_by: adminId,
        performed_by_type: 'admin',
        details: {
          expires_at: expirationDate.toISOString(),
          reason: reason || null,
          admin_action: true
        }
      });
    } catch (logError) {
      console.error('Error logging expiration set:', logError);
      // Don't fail the request if logging fails
    }

    res.json({
      success: true,
      data: updatedOrder,
      message: 'Order expiration set successfully'
    });
  } catch (error) {
    console.error('Error in set-order-expiration:', error);
    res.status(500).json({ error: error.message || 'Failed to set order expiration' });
  }
});

// DELETE /api/admin/clear-order-expiration - Clear expiration for specific order
app.delete('/api/admin/clear-order-expiration', requireAdminAuth, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { orderId } = req.body;
    const adminId = req.admin?.id;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const dbClient = supabaseService || supabase;

    // Update order to clear expiration
    const { data: updatedOrder, error: updateError } = await dbClient
      .from('orders')
      .update({
        expires_at: null,
        expiration_set_by: null,
        expiration_notes: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select('id')
      .single();

    if (updateError) {
      console.error('Error clearing order expiration:', updateError);
      return res.status(500).json({ error: updateError.message });
    }

    // Log to order_logs
    try {
      await dbClient.from('order_logs').insert({
        order_id: orderId,
        action: 'expiration_cleared',
        performed_by: adminId,
        performed_by_type: 'admin',
        details: {
          admin_action: true
        }
      });
    } catch (logError) {
      console.error('Error logging expiration clear:', logError);
    }

    res.json({
      success: true,
      message: 'Order expiration cleared successfully'
    });
  } catch (error) {
    console.error('Error in clear-order-expiration:', error);
    res.status(500).json({ error: error.message || 'Failed to clear order expiration' });
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

    // Format event time from date
    let formattedEventTime = null;
    if (order.events?.date) {
      try {
        const eventDate = new Date(order.events.date);
        if (!isNaN(eventDate.getTime())) {
          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
          const dayName = days[eventDate.getDay()];
          const day = eventDate.getDate();
          const monthName = months[eventDate.getMonth()];
          const year = eventDate.getFullYear();
          const hours = eventDate.getHours().toString().padStart(2, '0');
          const minutes = eventDate.getMinutes().toString().padStart(2, '0');
          formattedEventTime = `${dayName} · ${day} ${monthName} ${year} · ${hours}:${minutes}`;
        }
      } catch (e) {
        console.error('Error formatting event date:', e);
      }
    }

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
      supportContactUrl: `${req.protocol}://${req.get('host')}/contact`,
      eventTime: formattedEventTime || null,
      venueName: order.events?.venue || null
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
              <h3>💬 Need Help?</h3>
              <p>If you have any questions about your order, need to verify your purchase, or require assistance, please don't hesitate to contact our support team.</p>
              <a href="${emailData.supportContactUrl}" class="support-link">Contact Support</a>
            </div>

            <p>Thank you for choosing Andiamo Events! We look forward to seeing you at the event.</p>
            <p><strong>Best regards,<br>The Andiamo Team</strong></p>
          </div>
          <div class="footer">
            <p>© 2024 Andiamo Events. All rights reserved.</p>
            <p>We Create Memories</p>
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
    // CRITICAL: Brevo SMTP restriction - The SMTP login (EMAIL_USER) must NEVER be used as the "from" address.
    // Emails must be sent from a verified sender domain. Use contact@andiamoevents.com instead.
    try {
      await transporter.sendMail({
        from: '"Andiamo Events" <contact@andiamoevents.com>',
        replyTo: '"Andiamo Events" <contact@andiamoevents.com>',
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

    // Format event time from date
    let formattedEventTime = null;
    if (order.events?.date) {
      try {
        const eventDate = new Date(order.events.date);
        if (!isNaN(eventDate.getTime())) {
          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
          const dayName = days[eventDate.getDay()];
          const day = eventDate.getDate();
          const monthName = months[eventDate.getMonth()];
          const year = eventDate.getFullYear();
          const hours = eventDate.getHours().toString().padStart(2, '0');
          const minutes = eventDate.getMinutes().toString().padStart(2, '0');
          formattedEventTime = `${dayName} · ${day} ${monthName} ${year} · ${hours}:${minutes}`;
        }
      } catch (e) {
        console.error('Error formatting event date:', e);
      }
    }

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
          <p>Your order ${order.order_number !== null && order.order_number !== undefined ? `#${order.order_number}` : orderId.substring(0, 8).toUpperCase()} has been confirmed. Total: ${order.total_price} TND</p>
          ${order.events?.name ? `<p><strong>Event:</strong> ${order.events.name}</p>` : ''}
          ${formattedEventTime ? `<p><strong>Event Time:</strong> ${formattedEventTime}</p>` : ''}
          ${order.events?.venue ? `<p><strong>Venue:</strong> ${order.events.venue}</p>` : ''}
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

    // CRITICAL: Brevo SMTP restriction - The SMTP login (EMAIL_USER) must NEVER be used as the "from" address.
    // Emails must be sent from a verified sender domain. Use contact@andiamoevents.com instead.
    try {
      await transporter.sendMail({
        from: '"Andiamo Events" <contact@andiamoevents.com>',
        replyTo: '"Andiamo Events" <contact@andiamoevents.com>',
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
          ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
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
 * Helper function to build ticket email HTML template
 * Reusable by both generateTicketsAndSendEmail and resend ticket email
 */
// Helper function to format event time
function formatEventTime(eventDate) {
  if (!eventDate) return null;
  try {
    const date = new Date(eventDate);
    if (isNaN(date.getTime())) return null;
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const monthName = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${dayName} · ${day} ${monthName} ${year} · ${hours}:${minutes}`;
  } catch (e) {
    return null;
  }
}

/**
 * Build order confirmation email HTML (simple version without tickets)
 * Reusable for both client and ambassador
 */
function buildOrderConfirmationEmailHtml(order, orderPasses, recipientType = 'client') {
  const orderNumber = order.order_number !== null && order.order_number !== undefined 
    ? `#${order.order_number}` 
    : order.id.substring(0, 8).toUpperCase();
  
  const eventTime = formatEventTime(order.events?.date) || 'TBA';
  const venue = order.events?.venue || 'Venue to be announced';
  
  // Determine title and subtitle based on recipient type
  const title = recipientType === 'client' ? 'Payment Processing' : 'New Order';
  const subtitle = recipientType === 'client' ? 'Payment Processing – Andiamo Events' : 'New Order - Andiamo Events';
  
  // Determine greeting message based on recipient type
  const greetingMessage = recipientType === 'client' 
    ? 'Thank you for your order with Andiamo Events!<br><br>One of our official Andiamo Events ambassadors, ' + (order.ambassadors?.full_name || 'your assigned ambassador') + ', will be contacting you shortly to complete the delivery process and assist you if needed.<br><br>Once the payment process is fully completed, you will receive a final confirmation email with all the necessary details.'
    : 'We\'re excited to confirm that a new order has been successfully processed!<br><br>Please contact the client as soon as possible to confirm availability, coordinate delivery, and provide assistance if needed.<br><br>Timely communication is essential to ensure a smooth experience for the client.<br><br>Thank you for your cooperation.';
  
  // Helper function to extract Instagram username from URL
  const getInstagramUsername = (url) => {
    if (!url) return null;
    // Handle both https://www.instagram.com/username and https://instagram.com/username
    const match = url.match(/instagram\.com\/([^\/\?]+)/);
    return match ? match[1] : null;
  };
  
  // Helper function to ensure Instagram URL is properly formatted
  const formatInstagramUrl = (url) => {
    if (!url) return 'https://www.instagram.com/andiamo.events/';
    // If it's already a full URL, return it
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // If it's just a username, add the full URL
    return `https://www.instagram.com/${url.replace('@', '')}/`;
  };
  
  // Get ambassador Instagram username and URL
  const ambassadorInstagramUrl = order.ambassadors?.social_link 
    ? formatInstagramUrl(order.ambassadors.social_link)
    : 'https://www.instagram.com/andiamo.events/';
  const ambassadorInstagramUsername = getInstagramUsername(ambassadorInstagramUrl) || 'andiamo.events';
  
  console.log(`📧 Ambassador Instagram - URL: ${ambassadorInstagramUrl}, Username: ${ambassadorInstagramUsername}`);
  
  // Build passes summary
  const passesSummaryHtml = orderPasses.map(p => `
    <tr>
      <td>${p.pass_type}</td>
      <td style="text-align: center;">${p.quantity}</td>
      <td style="text-align: right;">${parseFloat(p.price).toFixed(2)} TND</td>
    </tr>
  `).join('');
  
  const supportUrl = `${process.env.VITE_API_URL || process.env.API_URL || 'https://andiamoevents.com'}/contact`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light dark">
      <meta name="supported-color-schemes" content="light dark">
      <title>Order Confirmation - Andiamo Events</title>
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
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="content-card">
          <div class="title-section">
            <h1 class="title">${title}</h1>
            <p class="subtitle">${subtitle}</p>
          </div>
          
          <p class="greeting">Dear <strong>${recipientType === 'client' ? (order.user_name || 'Valued Customer') : (order.ambassadors?.full_name || 'Ambassador')}</strong>,</p>
          
          <p class="message">
            ${greetingMessage}
          </p>
          
          <div class="order-info-block">
            <div class="info-row">
              <div class="info-label">Order Number</div>
              <div class="info-value">${orderNumber}</div>
            </div>
            ${recipientType === 'client' ? `
            ${order.ambassadors ? `
            <div class="info-row">
              <div class="info-label">Delivered by</div>
              <div style="font-size: 18px; color: #E21836; font-weight: 600;">${order.ambassadors.full_name}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Ambassador Phone</div>
              <div style="font-size: 18px; color: #E21836; font-weight: 600;">${order.ambassadors.phone || 'N/A'}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Ambassador Instagram</div>
              <div style="font-size: 18px; color: #E21836; font-weight: 600;">
                <a href="${ambassadorInstagramUrl}" target="_blank" style="color: #E21836 !important; text-decoration: none;">@${ambassadorInstagramUsername}</a>
              </div>
            </div>
            ` : ''}
            ` : `
            <div class="info-row">
              <div class="info-label">Client Name</div>
              <div style="font-size: 18px; color: #E21836; font-weight: 600;">${order.user_name || 'N/A'}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Client Phone</div>
              <div style="font-size: 18px; color: #E21836; font-weight: 600;">${order.user_phone || 'N/A'}</div>
            </div>
            `}
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
                  <td colspan="2" style="text-align: right; padding-right: 20px;"><strong>${recipientType === 'client' ? 'Total Amount Paid:' : 'Total Amount:'}</strong></td>
                  <td style="text-align: right;"><strong>${parseFloat(order.total_price).toFixed(2)} TND</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="support-section">
            ${recipientType === 'client' ? `
            <p class="support-text">Need assistance? Contact us at 
              <a href="mailto:Contact@andiamoevents.com" style="color: #E21836 !important; text-decoration: none; font-weight: 500;">Contact@andiamoevents.com</a> or in our Instagram page 
              <a href="https://www.instagram.com/andiamo.events/" target="_blank" style="color: #E21836 !important; text-decoration: none; font-weight: 500;">@andiamo.events</a> or contact with 
              <a href="tel:28070128" style="color: #E21836 !important; text-decoration: none; font-weight: 500;">28070128</a>.
            </p>
            ` : `
            <p class="support-text">Need assistance? Contact us at <a href="mailto:Contact@andiamoevents.com" class="support-email">Contact@andiamoevents.com</a>.</p>
            `}
          </div>
          <div class="closing-section">
            <p class="slogan">We Create Memories</p>
            <p class="signature">Best regards,<br>The Andiamo Events Team</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send order confirmation email to a single recipient
 * Non-blocking, logs errors but doesn't throw
 */
async function sendOrderConfirmationEmailToRecipient(order, orderPasses, recipientEmail, recipientName, recipientType) {
  if (!recipientEmail) {
    console.log(`📧 Skipping ${recipientType} email - no email address`);
    return { success: false, skipped: true, reason: 'no_email' };
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.EMAIL_HOST) {
    console.log(`📧 Skipping ${recipientType} email - email service not configured`);
    return { success: false, skipped: true, reason: 'not_configured' };
  }

  // Create email log entry (before try block so it's accessible in catch)
  let emailLog = null;
  if (supabase) {
    try {
      const { data: logData } = await supabase
        .from('email_delivery_logs')
        .insert({
          order_id: order.id,
          email_type: 'order_confirmation',
          recipient_email: recipientEmail,
          recipient_name: recipientName || 'Recipient',
          subject: recipientType === 'client' ? 'Payment Processing – Andiamo Events' : 'New Order - Andiamo Events',
          status: 'pending'
        })
        .select()
        .single();
      emailLog = logData;
    } catch (logError) {
      console.warn(`⚠️ Failed to create email log for ${recipientType}:`, logError);
    }
  }

  try {
    const emailHtml = buildOrderConfirmationEmailHtml(order, orderPasses, recipientType);
    const subject = recipientType === 'client' ? 'Payment Processing – Andiamo Events' : 'New Order - Andiamo Events';

    // Send email
    // CRITICAL: Brevo SMTP restriction - The SMTP login (EMAIL_USER) must NEVER be used as the "from" address.
    // Emails must be sent from a verified sender domain. Use contact@andiamoevents.com instead.
    const emailTransporter = getEmailTransporter();
    await emailTransporter.sendMail({
      from: '"Andiamo Events" <contact@andiamoevents.com>',
      replyTo: '"Andiamo Events" <contact@andiamoevents.com>',
      to: recipientEmail,
      subject: subject,
      html: emailHtml
    });

    // Update email log
    if (emailLog && supabase) {
      try {
        await supabase
          .from('email_delivery_logs')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', emailLog.id);
      } catch (logError) {
        console.warn(`⚠️ Failed to update email log for ${recipientType}:`, logError);
      }
    }

    console.log(`✅ Order confirmation email sent to ${recipientType}: ${recipientEmail.substring(0, 3)}***`);
    return { success: true, recipientType, email: recipientEmail };
  } catch (emailError) {
    console.error(`❌ Failed to send order confirmation email to ${recipientType}:`, {
      email: recipientEmail.substring(0, 3) + '***',
      error: emailError.message
    });

    // Update email log with failure
    if (emailLog && supabase) {
      try {
        await supabase
          .from('email_delivery_logs')
          .update({
            status: 'failed',
            error_message: emailError.message
          })
          .eq('id', emailLog.id);
      } catch (logError) {
        // Ignore log update errors
      }
    }

    return { success: false, recipientType, email: recipientEmail, error: emailError.message };
  }
}

/**
 * Send order confirmation emails to both client and ambassador
 * Called during order creation, right after SMS
 */
async function sendOrderConfirmationEmails(orderId) {
  if (!supabase) {
    console.warn('📧 Cannot send order confirmation emails - Supabase not configured');
    return;
  }

  try {
    // Fetch order with all needed relations
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_passes (*),
        events (
          id,
          name,
          date,
          venue
        ),
        ambassadors (
          id,
          full_name,
          phone,
          email
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('❌ Failed to fetch order for email:', orderError);
      return;
    }

    // Fetch order passes if not included
    let orderPasses = order.order_passes || [];
    if (orderPasses.length === 0) {
      const { data: passes } = await supabase
        .from('order_passes')
        .select('*')
        .eq('order_id', orderId);
      orderPasses = passes || [];
    }

    // Fetch ambassador social_link from ambassador_applications
    if (order.ambassadors) {
      try {
        // Always fetch social_link from ambassador_applications to ensure we have the latest
        const { data: application } = await supabase
          .from('ambassador_applications')
          .select('social_link')
          .eq('phone_number', order.ambassadors.phone)
          .maybeSingle();
        
        if (application?.social_link) {
          order.ambassadors.social_link = application.social_link;
          console.log(`📧 Fetched ambassador Instagram: ${application.social_link}`);
        } else {
          console.log(`⚠️ No Instagram link found for ambassador ${order.ambassadors.phone}`);
        }
      } catch (err) {
        console.warn('⚠️ Failed to fetch ambassador social_link from applications:', err);
      }
    }

    // Send email to client
    if (order.user_email) {
      await sendOrderConfirmationEmailToRecipient(
        order,
        orderPasses,
        order.user_email,
        order.user_name,
        'client'
      );
    } else {
      console.log('📧 Skipping client email - no user_email');
    }

    // Send email to ambassador
    if (order.ambassadors?.email) {
      await sendOrderConfirmationEmailToRecipient(
        order,
        orderPasses,
        order.ambassadors.email,
        order.ambassadors.full_name,
        'ambassador'
      );
    } else {
      console.log('📧 Skipping ambassador email - no ambassador email address');
    }
  } catch (error) {
    console.error('❌ Error in sendOrderConfirmationEmails:', error);
    // Don't throw - this is non-blocking
  }
}

function buildTicketEmailHtml(order, tickets, passes, orderId) {
  const orderIdShort = orderId.substring(0, 8).toUpperCase();
  const supportUrl = `${process.env.VITE_API_URL || process.env.API_URL || 'https://andiamoevents.com'}/contact`;
  
  // Group tickets by pass type
  const ticketsByPassType = new Map();
  tickets.forEach(ticket => {
    const pass = passes.find(p => p.id === ticket.order_pass_id);
    if (pass) {
      const key = pass.pass_type;
      if (!ticketsByPassType.has(key)) {
        ticketsByPassType.set(key, []);
      }
      ticketsByPassType.get(key).push({ ...ticket, passType: key });
    }
  });

  // Build tickets HTML grouped by pass type
  const ticketsHtml = Array.from(ticketsByPassType.entries())
    .map(([passType, passTickets]) => {
      const ticketsList = passTickets
        .filter(ticket => ticket.qr_code_url)
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
          <h3 style="color: #E21836; margin-bottom: 15px; font-size: 18px; font-weight: 600;">${passType} Tickets (${passTickets.filter(t => t.qr_code_url).length})</h3>
          ${ticketsList}
        </div>
      `;
    })
    .join('');

  // Build passes summary
  const passesSummary = passes.map(p => ({
    passType: p.pass_type,
    quantity: p.quantity,
    price: parseFloat(p.price)
  }));

  // Build passes summary HTML
  const passesSummaryHtml = passesSummary.map(p => `
    <tr style="border-bottom: 1px solid rgba(0, 0, 0, 0.1);">
      <td style="padding: 12px 0; color: #1A1A1A; font-size: 15px;">${p.passType}</td>
      <td style="padding: 12px 0; color: #1A1A1A; font-size: 15px; text-align: center;">${p.quantity}</td>
      <td style="padding: 12px 0; color: #1A1A1A; font-size: 15px; text-align: right;">${p.price.toFixed(2)} TND</td>
    </tr>
  `).join('');

  // Return the full email HTML (using the same template as generateTicketsAndSendEmail)
  // This is the same template from lines 5687-6098 in the original function
  return `
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
              <div class="info-label">Order Number</div>
              <div class="info-value">${order.order_number !== null && order.order_number !== undefined ? `#${order.order_number}` : orderIdShort}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Event</div>
              <div style="font-size: 18px; color: #E21836; font-weight: 600;">${order.events?.name || 'Event'}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Event Time</div>
              <div style="font-size: 18px; color: #E21836; font-weight: 600;">${formatEventTime(order.events?.date) || 'TBA'}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Venue</div>
              <div style="font-size: 18px; color: #E21836; font-weight: 600;">${order.events?.venue || 'Venue to be announced'}</div>
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

          <div class="support-section">
            <p class="support-text">
              Need assistance? Contact us at <a href="mailto:Contact@andiamoevents.com" class="support-email">Contact@andiamoevents.com</a> or visit <a href="${supportUrl}" class="support-email">our support page</a>.
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
}

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

    // Check if order is in the correct status (COMPLETED for COD, PAID for online or ambassador_manual, or PAID for any source after admin skip)
    const isPaidStatus = 
      order.status === 'PAID' || // Accept PAID status for any source (admin skip sets all orders to PAID)
      (order.source === 'platform_cod' && (order.status === 'COMPLETED' || order.status === 'MANUAL_COMPLETED')) ||
      (order.source === 'platform_online' && order.status === 'PAID') ||
      (order.source === 'ambassador_manual' && order.status === 'PAID');

    console.log('🔍 Status Check:', {
      source: order.source,
      status: order.status,
      isPaidStatus: isPaidStatus,
      checks: {
        platform_cod_completed: order.source === 'platform_cod' && (order.status === 'COMPLETED' || order.status === 'MANUAL_COMPLETED'),
        platform_online_paid: order.source === 'platform_online' && order.status === 'PAID',
        ambassador_manual_paid: order.source === 'ambassador_manual' && order.status === 'PAID'
      }
    });

    if (!isPaidStatus) {
      console.error('❌ Order status validation failed:', {
        currentStatus: order.status,
        source: order.source,
        expectedStatuses: {
          platform_cod: 'COMPLETED or MANUAL_COMPLETED',
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
      // Check if email/SMS were previously sent by checking logs
      let previousEmailSent = false;
      let previousSmsSent = false;
      
      try {
        const { data: emailLogs } = await dbClient
          .from('email_delivery_logs')
          .select('status')
          .eq('order_id', orderId)
          .eq('status', 'sent')
          .limit(1);
        previousEmailSent = emailLogs && emailLogs.length > 0;
      } catch (logErr) {
        console.warn('⚠️ Could not check email delivery logs:', logErr);
      }
      
      try {
        const { data: smsLogs } = await dbClient
          .from('sms_logs')
          .select('status')
          .eq('status', 'sent')
          .limit(1);
        // Note: sms_logs doesn't have order_id, so we check by phone number
        if (order.user_phone) {
          const { data: smsLogsByPhone } = await dbClient
            .from('sms_logs')
            .select('status')
            .eq('phone_number', order.user_phone)
            .eq('status', 'sent')
            .order('sent_at', { ascending: false })
            .limit(1);
          previousSmsSent = smsLogsByPhone && smsLogsByPhone.length > 0;
        }
      } catch (logErr) {
        console.warn('⚠️ Could not check SMS logs:', logErr);
      }
      
      return { 
        success: true, 
        message: 'Tickets already generated', 
        ticketsCount: existingTickets.length,
        emailSent: previousEmailSent,
        smsSent: previousSmsSent
      };
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
          
          // Populate QR Ticket Registry (fails silently - must not block ticket generation)
          try {
            const pass = orderPasses.find(p => p.id === ticketData.order_pass_id);
            const ambassador = order.ambassadors || null;
            const event = order.events || null;
            
            const registryEntry = {
              secure_token: ticketData.secure_token,
              ticket_id: ticketData.id,
              order_id: order.id,
              source: order.source,
              payment_method: order.payment_method || 'online',
              ambassador_id: order.ambassador_id || null,
              ambassador_name: ambassador?.full_name || null,
              ambassador_phone: ambassador?.phone || null,
              buyer_name: order.user_name,
              buyer_phone: order.user_phone,
              buyer_email: order.user_email || null,
              buyer_city: order.city,
              buyer_ville: order.ville || null,
              event_id: order.event_id || null,
              event_name: event?.name || null,
              event_date: event?.date || null,
              event_venue: event?.venue || null,
              event_city: event?.city || null,
              order_pass_id: pass?.id || ticketData.order_pass_id,
              pass_type: pass?.pass_type || 'Standard',
              pass_price: pass?.price || 0,
              ticket_status: 'VALID',
              qr_code_url: ticketData.qr_code_url,
              generated_at: ticketData.generated_at || new Date().toISOString()
            };
            
            const { data: registryData, error: registryInsertError } = await dbClient.from('qr_tickets').insert(registryEntry);
            
            if (registryInsertError) {
              console.error(`❌ QR Registry Insert Error for ticket ${ticketData.secure_token}:`, {
                error: registryInsertError.message,
                code: registryInsertError.code,
                details: registryInsertError.details,
                hint: registryInsertError.hint,
                usingServiceRole: !!supabaseService,
                entry: registryEntry
              });
            } else {
              console.log(`✅ QR Registry populated for ticket ${ticketData.secure_token}`);
            }
          } catch (registryError) {
            // Fail silently - log error but don't block ticket generation
            console.error(`⚠️ Failed to populate QR registry for ticket ${ticketData.secure_token}:`, {
              error: registryError.message,
              stack: registryError.stack,
              usingServiceRole: !!supabaseService
            });
          }
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
                    <div class="info-label">Order Number</div>
                    <div class="info-value">${order.order_number !== null && order.order_number !== undefined ? `#${order.order_number}` : orderId.substring(0, 8).toUpperCase()}</div>
                  </div>
                  <div class="info-row">
                    <div class="info-label">Event</div>
                    <div style="font-size: 18px; color: #E21836; font-weight: 600;">${order.events?.name || 'Event'}</div>
                  </div>
                  <div class="info-row">
                    <div class="info-label">Event Time</div>
                    <div style="font-size: 18px; color: #E21836; font-weight: 600;">${formatEventTime(order.events?.date) || 'TBA'}</div>
                  </div>
                  <div class="info-row">
                    <div class="info-label">Venue</div>
                    <div style="font-size: 18px; color: #E21836; font-weight: 600;">${order.events?.venue || 'Venue to be announced'}</div>
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

                <div class="support-section">
                  <p class="support-text">
                    Need assistance? Contact us at <a href="mailto:Contact@andiamoevents.com" class="support-email">Contact@andiamoevents.com</a> or in our Instagram page <a href="https://www.instagram.com/andiamo.events/" target="_blank" class="support-email">@andiamo.events</a> or contact with <a href="tel:28070128" class="support-email">28070128</a>.
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
                  <a href="https://www.instagram.com/malekbenamor.dev/" target="_blank" class="footer-link">Instagram</a>
                  <span style="color: #999999;">•</span>
                  <a href="https://malekbenamor.dev/" target="_blank" class="footer-link">Website</a>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;

        // Send email
        // CRITICAL: Brevo SMTP restriction - The SMTP login (EMAIL_USER) must NEVER be used as the "from" address.
        // Emails must be sent from a verified sender domain. Use contact@andiamoevents.com instead.
        console.log('📤 Attempting to send email...');
        console.log('📤 Email Details:', {
          from: '"Andiamo Events" <contact@andiamoevents.com>',
          to: order.user_email,
          subject: 'Your Digital Tickets Are Ready - Andiamo Events',
          htmlLength: emailHtml.length
        });
        
        const emailResult = await transporter.sendMail({
          from: '"Andiamo Events" <contact@andiamoevents.com>',
          replyTo: '"Andiamo Events" <contact@andiamoevents.com>',
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
        
        // Build SMS message using centralized template helper
        let smsMessage;
        try {
          smsMessage = buildClientAdminApprovalSMS({
            order
          });
          
          // Log SMS type and order ID for validation
          console.log('📱 SMS Type: Client Admin Approval');
          console.log('📱 Order ID:', orderId);
          console.log('📱 Recipient:', order.user_phone ? `${order.user_phone.substring(0, 3)}***` : 'NOT SET');
        } catch (smsError) {
          console.error('❌ Error building SMS message:', smsError);
          throw new Error(`Failed to build SMS message: ${smsError.message}`);
        }

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
              ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
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
          ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
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
          ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
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
          ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
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
          ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
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
    // Accept PAID status for any source (admin can approve orders from any source)
    const isPaidStatus = 
      order.status === 'PAID' || // Accept PAID status for any source (admin approval sets all orders to PAID)
      (order.source === 'platform_cod' && (order.status === 'COMPLETED' || order.status === 'MANUAL_COMPLETED')) ||
      (order.source === 'platform_online' && order.status === 'PAID') ||
      (order.source === 'ambassador_manual' && order.status === 'PAID');

    if (!isPaidStatus && !isAdminRequest) {
      // Log security event - attempt to generate tickets for unpaid order
      try {
        // Use service role client for security audit logs (bypasses RLS)
      const securityLogClient = supabaseService || supabase;
      await securityLogClient.from('security_audit_logs').insert({
          event_type: 'unauthorized_ticket_generation',
          endpoint: '/api/generate-tickets-for-order',
          ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
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

// ============================================
// ADMIN: Skip Ambassador Confirmation
// ============================================
// POST /api/admin-skip-ambassador-confirmation - Admin-only endpoint to approve order without ambassador confirmation
// This bypasses the normal flow where ambassador must confirm cash before admin can approve
app.post('/api/admin-skip-ambassador-confirmation', requireAdminAuth, logSecurityRequest, async (req, res) => {
  console.log('\n🔐 ============================================');
  console.log('🔐 ADMIN: Skip Ambassador Confirmation');
  console.log('🔐 ============================================');
  
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { orderId, reason } = req.body;
    const adminId = req.admin?.id;
    const adminEmail = req.admin?.email;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    console.log('🔐 Request details:', {
      orderId,
      adminId,
      adminEmail: adminEmail ? `${adminEmail.substring(0, 3)}***` : 'NOT SET',
      reason: reason || 'Not provided'
    });

    // Fetch order with conditional update (idempotency)
    const dbClient = supabaseService || supabase;
    
    // Step 1: Verify order exists and is in valid status
    const { data: order, error: orderError } = await dbClient
      .from('orders')
      .select('id, status, source, payment_method, user_email, user_phone, total_price')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('❌ Order not found:', orderId);
      return res.status(404).json({ error: 'Order not found' });
    }

    console.log('🔐 Order status check:', {
      orderId: order.id,
      currentStatus: order.status,
      source: order.source,
      paymentMethod: order.payment_method
    });

    // Step 2: Validate order status (must be PENDING_CASH or PENDING_ADMIN_APPROVAL)
    const validStatuses = ['PENDING_CASH', 'PENDING_ADMIN_APPROVAL'];
    if (!validStatuses.includes(order.status)) {
      console.error('❌ Invalid order status for skip confirmation:', order.status);
      
      // Log security event
      try {
        const securityLogClient = supabaseService || supabase;
        await securityLogClient.from('security_audit_logs').insert({
          event_type: 'invalid_status_transition',
          endpoint: '/api/admin-skip-ambassador-confirmation',
          user_id: adminId,
          ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
          user_agent: req.headers['user-agent'] || 'unknown',
          request_method: req.method,
          request_path: req.path,
          details: {
            reason: 'Order status is not PENDING_CASH or PENDING_ADMIN_APPROVAL',
            order_id: orderId,
            current_status: order.status,
            attempted_action: 'skip_ambassador_confirmation'
          },
          severity: 'medium'
        });
      } catch (logError) {
        console.error('Failed to log security event:', logError);
      }
      
      return res.status(400).json({
        error: 'Invalid order status',
        details: `Order must be in PENDING_CASH or PENDING_ADMIN_APPROVAL status. Current status: ${order.status}`
      });
    }

    // Step 3: Update order status to PAID (conditional update for idempotency)
    const oldStatus = order.status;
    const { data: updatedOrder, error: updateError } = await dbClient
      .from('orders')
      .update({
        status: 'PAID',
        payment_status: 'PAID',
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .in('status', validStatuses) // Only update if still in valid status (idempotency)
      .select('id, status')
      .single();

    if (updateError || !updatedOrder) {
      // Check if order was already updated (idempotency check)
      const { data: checkOrder } = await dbClient
        .from('orders')
        .select('id, status')
        .eq('id', orderId)
        .single();

      if (checkOrder && checkOrder.status === 'PAID') {
        console.log('⚠️ Order already PAID (idempotent call)');
        
        // Check if tickets already exist
        const { data: existingTickets } = await dbClient
          .from('tickets')
          .select('id')
          .eq('order_id', orderId)
          .limit(1);

        // Log the duplicate attempt
        await dbClient.from('order_logs').insert({
          order_id: orderId,
          action: 'admin_skip_confirmation_duplicate',
          performed_by: adminId,
          performed_by_type: 'admin',
          details: {
            old_status: oldStatus,
            new_status: 'PAID',
            tickets_already_exist: existingTickets && existingTickets.length > 0,
            reason: reason || 'Not provided',
            admin_email: adminEmail
          }
        });

        return res.status(200).json({
          success: true,
          message: 'Order already approved (idempotent call)',
          orderId: orderId,
          status: 'PAID',
          ticketsExist: existingTickets && existingTickets.length > 0
        });
      }

      console.error('❌ Error updating order status:', updateError);
      return res.status(500).json({
        error: 'Failed to update order status',
        details: updateError?.message || 'Unknown error'
      });
    }

    console.log('✅ Order status updated:', {
      orderId: updatedOrder.id,
      oldStatus,
      newStatus: updatedOrder.status
    });

    // Step 4: Generate tickets and send email/SMS (idempotent function)
    let ticketResult = null;
    try {
      console.log('🔐 Calling generateTicketsAndSendEmail...');
      ticketResult = await generateTicketsAndSendEmail(orderId);
      console.log('✅ Tickets generated:', {
        success: ticketResult.success,
        ticketsCount: ticketResult.ticketsCount,
        emailSent: ticketResult.emailSent,
        smsSent: ticketResult.smsSent
      });
    } catch (ticketError) {
      console.error('❌ Error generating tickets:', ticketError);
      // Don't fail the request - order is already PAID, tickets can be generated later
      ticketResult = {
        success: false,
        error: ticketError.message
      };
    }

    // Step 5: Log to order_logs (audit trail)
    try {
      await dbClient.from('order_logs').insert({
        order_id: orderId,
        action: 'admin_skip_confirmation',
        performed_by: adminId,
        performed_by_type: 'admin',
        details: {
          old_status: oldStatus,
          new_status: 'PAID',
          skipped_ambassador_confirmation: true,
          tickets_generated: ticketResult?.success || false,
          tickets_count: ticketResult?.ticketsCount || 0,
          email_sent: ticketResult?.emailSent || false,
          sms_sent: ticketResult?.smsSent || false,
          reason: reason || 'Not provided',
          admin_email: adminEmail,
          admin_action: true
        }
      });
      console.log('✅ Audit log created');
    } catch (logError) {
      console.error('❌ Error creating audit log:', logError);
      // Don't fail the request if logging fails
    }

    console.log('🔐 ============================================');
    console.log('🔐 ADMIN: Skip Confirmation Completed');
    console.log('🔐 ============================================\n');

    res.status(200).json({
      success: true,
      message: 'Order approved successfully (ambassador confirmation skipped)',
      orderId: orderId,
      oldStatus,
      newStatus: 'PAID',
      ticketsGenerated: ticketResult?.success || false,
      ticketsCount: ticketResult?.ticketsCount || 0,
      emailSent: ticketResult?.emailSent || false,
      smsSent: ticketResult?.smsSent || false,
      ticketError: ticketResult?.error || null
    });

  } catch (error) {
    console.error('\n❌ ============================================');
    console.error('❌ ADMIN: Skip Confirmation Error');
    console.error('❌ ============================================');
    console.error('❌ Error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    console.error('❌ ============================================\n');

    res.status(500).json({
      error: 'Failed to skip ambassador confirmation',
      details: error.message
    });
  }
});

// ============================================
// ADMIN: Approve Order (After Ambassador Confirmation)
// ============================================
// POST /api/admin-approve-order - Admin-only endpoint to approve order after ambassador confirms cash
// This is the normal approval flow: PENDING_ADMIN_APPROVAL → PAID
app.post('/api/admin-approve-order', requireAdminAuth, logSecurityRequest, async (req, res) => {
  console.log('\n✅ ============================================');
  console.log('✅ ADMIN: Approve Order (After Ambassador Confirmation)');
  console.log('✅ ============================================');

  // Flag to ensure we only send one response
  let responseSent = false;
  const sendResponse = (status, data) => {
    if (!responseSent) {
      responseSent = true;
      res.status(status).json(data);
    }
  };

  try {
    if (!supabase) {
      return sendResponse(500, { error: 'Supabase not configured' });
    }

    const { orderId } = req.body;
    const adminId = req.admin?.id;
    const adminEmail = req.admin?.email;

    if (!orderId) {
      return sendResponse(400, { error: 'Order ID is required' });
    }

    console.log('✅ Request details:', {
      orderId,
      adminId,
      adminEmail: adminEmail ? `${adminEmail.substring(0, 3)}***` : 'NOT SET'
    });

    const dbClient = supabaseService || supabase;

    // Step 1: Verify order exists and is in valid status
    const { data: order, error: orderError } = await dbClient
      .from('orders')
      .select('id, status, source, payment_method, user_email, user_phone, total_price')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('❌ Order not found:', orderId);
      return sendResponse(404, { error: 'Order not found' });
    }

    console.log('✅ Order status check:', {
      orderId: order.id,
      currentStatus: order.status,
      source: order.source,
      paymentMethod: order.payment_method
    });

    // Step 2: Validate order status (must be PENDING_ADMIN_APPROVAL)
    if (order.status !== 'PENDING_ADMIN_APPROVAL') {
      console.error('❌ Invalid order status for approval:', order.status);

      // Log security event
      try {
        const securityLogClient = supabaseService || supabase;
        await securityLogClient.from('security_audit_logs').insert({
          event_type: 'invalid_status_transition',
          endpoint: '/api/admin-approve-order',
          user_id: adminId,
          ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
          user_agent: req.headers['user-agent'] || 'unknown',
          request_method: req.method,
          request_path: req.path,
          details: {
            reason: 'Order status is not PENDING_ADMIN_APPROVAL',
            order_id: orderId,
            current_status: order.status,
            attempted_action: 'approve_order'
          },
          severity: 'medium'
        });
      } catch (logError) {
        console.error('Failed to log security event:', logError);
      }

      return sendResponse(400, {
        error: 'Invalid order status',
        details: `Order must be in PENDING_ADMIN_APPROVAL status. Current status: ${order.status}`
      });
    }

    // Step 3: Update order status to PAID (conditional update for idempotency)
    const oldStatus = order.status;
    const { data: updatedOrder, error: updateError } = await dbClient
      .from('orders')
      .update({
        status: 'PAID',
        payment_status: 'PAID',
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .eq('status', 'PENDING_ADMIN_APPROVAL') // Only update if still in PENDING_ADMIN_APPROVAL (idempotency)
      .select('id, status')
      .single();

    if (updateError || !updatedOrder) {
      // Check if order was already updated (idempotency check)
      const { data: checkOrder } = await dbClient
        .from('orders')
        .select('id, status')
        .eq('id', orderId)
        .single();

      if (checkOrder && checkOrder.status === 'PAID') {
        console.log('⚠️ Order already PAID (idempotent call)');

        // Check if tickets already exist
        const { data: existingTickets } = await dbClient
          .from('tickets')
          .select('id')
          .eq('order_id', orderId)
          .limit(1);

        // Log the duplicate attempt
        await dbClient.from('order_logs').insert({
          order_id: orderId,
          action: 'admin_approve_duplicate',
          performed_by: adminId,
          performed_by_type: 'admin',
          details: {
            old_status: oldStatus,
            new_status: 'PAID',
            tickets_already_exist: existingTickets && existingTickets.length > 0,
            admin_email: adminEmail
          }
        });

        return sendResponse(200, {
          success: true,
          message: 'Order already approved (idempotent call)',
          orderId: orderId,
          status: 'PAID',
          ticketsExist: existingTickets && existingTickets.length > 0
        });
      }

      console.error('❌ Error updating order status:', updateError);
      return sendResponse(500, {
        error: 'Failed to update order status',
        details: updateError?.message || 'Unknown error'
      });
    }

    console.log('✅ Order status updated:', {
      orderId: updatedOrder.id,
      oldStatus,
      newStatus: updatedOrder.status
    });

    // Step 4: Generate tickets and send email/SMS (idempotent function)
    // Use timeout to prevent hanging (30 seconds max)
    let ticketResult = null;
    try {
      console.log('✅ Calling generateTicketsAndSendEmail...');
      
      // Add timeout wrapper to prevent hanging
      const ticketGenerationPromise = generateTicketsAndSendEmail(orderId);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Ticket generation timed out after 30 seconds'));
        }, 30000); // 30 second timeout
      });
      
      ticketResult = await Promise.race([ticketGenerationPromise, timeoutPromise]);
      
      console.log('✅ Tickets generated:', {
        success: ticketResult.success,
        ticketsCount: ticketResult.ticketsCount,
        emailSent: ticketResult.emailSent,
        smsSent: ticketResult.smsSent
      });
    } catch (ticketError) {
      console.error('❌ Error generating tickets:', ticketError);
      // Don't fail the request - order is already PAID, tickets can be generated later
      ticketResult = {
        success: false,
        error: ticketError.message || 'Unknown error during ticket generation'
      };
    }

    // Step 5: Log to order_logs (audit trail)
    try {
      await dbClient.from('order_logs').insert({
        order_id: orderId,
        action: 'admin_approve',
        performed_by: adminId,
        performed_by_type: 'admin',
        details: {
          old_status: oldStatus,
          new_status: 'PAID',
          tickets_generated: ticketResult?.success || false,
          tickets_count: ticketResult?.ticketsCount || 0,
          email_sent: ticketResult?.emailSent || false,
          sms_sent: ticketResult?.smsSent || false,
          admin_email: adminEmail,
          admin_action: true
        }
      });
      console.log('✅ Audit log created');
    } catch (logError) {
      console.error('❌ Error creating audit log:', logError);
      // Don't fail the request if logging fails
    }

    console.log('✅ ============================================');
    console.log('✅ ADMIN: Approve Order Completed');
    console.log('✅ ============================================\n');

    sendResponse(200, {
      success: true,
      message: 'Order approved successfully',
      orderId: orderId,
      oldStatus,
      newStatus: 'PAID',
      ticketsGenerated: ticketResult?.success || false,
      ticketsCount: ticketResult?.ticketsCount || 0,
      emailSent: ticketResult?.emailSent || false,
      smsSent: ticketResult?.smsSent || false,
      ticketError: ticketResult?.error || null
    });

  } catch (error) {
    console.error('\n❌ ============================================');
    console.error('❌ ADMIN: Approve Order Error');
    console.error('❌ ============================================');
    console.error('❌ Error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    console.error('❌ ============================================\n');

    // Ensure response is sent (check if already sent)
    sendResponse(500, {
      error: 'Failed to approve order',
      details: error.message
    });
  }
});

// ============================================
// ADMIN: Resend Ticket Email
// ============================================
// POST /api/admin-resend-ticket-email - Admin-only endpoint to resend ticket email without regenerating tickets
// Rate limited to prevent abuse (max 5 resends per hour per order)
const resendTicketEmailLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 resends per hour per order
  message: { error: 'Too many resend requests. Please try again later.' },
  keyGenerator: (req) => {
    // Use orderId for rate limiting (per order, not per IP)
    // orderId should always be present (required in request body)
    const orderId = req.body?.orderId;
    if (orderId) {
      return `resend-ticket-email:${orderId}`;
    }
    // Fallback to IP-based rate limiting (properly handles IPv6)
    // Use ipKeyGenerator helper for proper IPv6 subnet handling (/56 subnet for IPv6)
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    return `resend-ticket-email:ip:${ipKeyGenerator(ip, 56)}`;
  },
  validate: {
    // Disable validation since we're using ipKeyGenerator helper for IPv6 handling
    keyGeneratorIpFallback: false
  }
});

app.post('/api/admin-resend-ticket-email', requireAdminAuth, resendTicketEmailLimiter, logSecurityRequest, async (req, res) => {
  console.log('\n📧 ============================================');
  console.log('📧 ADMIN: Resend Ticket Email');
  console.log('📧 ============================================');
  
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const { orderId } = req.body;
    const adminId = req.admin?.id;
    const adminEmail = req.admin?.email;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    console.log('📧 Request details:', {
      orderId,
      adminId,
      adminEmail: adminEmail ? `${adminEmail.substring(0, 3)}***` : 'NOT SET'
    });

    const dbClient = supabaseService || supabase;

    // Step 1: Verify order exists and is PAID
    const { data: order, error: orderError } = await dbClient
      .from('orders')
      .select(`
        id, 
        status, 
        payment_status,
        source,
        user_email,
        user_name,
        total_price,
        order_number,
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
      console.error('❌ Order not found:', orderId);
      return res.status(404).json({ error: 'Order not found' });
    }

    console.log('📧 Order status check:', {
      orderId: order.id,
      status: order.status,
      paymentStatus: order.payment_status,
      hasUserEmail: !!order.user_email
    });

    // Step 2: Validate order is PAID
    if (order.status !== 'PAID' && order.payment_status !== 'PAID') {
      console.error('❌ Order not paid:', order.status, order.payment_status);
      
      // Log security event
      try {
        const securityLogClient = supabaseService || supabase;
        await securityLogClient.from('security_audit_logs').insert({
          event_type: 'invalid_resend_attempt',
          endpoint: '/api/admin-resend-ticket-email',
          user_id: adminId,
          ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
          user_agent: req.headers['user-agent'] || 'unknown',
          request_method: req.method,
          request_path: req.path,
          details: {
            reason: 'Order is not PAID',
            order_id: orderId,
            current_status: order.status,
            payment_status: order.payment_status
          },
          severity: 'medium'
        });
      } catch (logError) {
        console.error('Failed to log security event:', logError);
      }
      
      return res.status(400).json({
        error: 'Order must be PAID to resend tickets',
        details: `Current status: ${order.status}, Payment status: ${order.payment_status}`
      });
    }

    // Step 3: Validate customer has email
    if (!order.user_email) {
      return res.status(400).json({
        error: 'Customer email is required',
        details: 'Order does not have a customer email address'
      });
    }

    // Step 4: Verify tickets exist (must not regenerate)
    const { data: tickets, error: ticketsError } = await dbClient
      .from('tickets')
      .select('id, order_id, order_pass_id, qr_code_url, secure_token, status')
      .eq('order_id', orderId);

    if (ticketsError) {
      console.error('❌ Error fetching tickets:', ticketsError);
      return res.status(500).json({
        error: 'Failed to fetch tickets',
        details: ticketsError.message
      });
    }

    if (!tickets || tickets.length === 0) {
      return res.status(400).json({
        error: 'No tickets found for this order',
        details: 'Tickets must be generated before resending email. Use the skip confirmation endpoint first.'
      });
    }

    console.log('📧 Tickets found:', tickets.length);

    // Step 5: Fetch order passes for email template
    const { data: orderPasses, error: passesError } = await dbClient
      .from('order_passes')
      .select('*')
      .eq('order_id', orderId);

    if (passesError) {
      console.error('❌ Error fetching order passes:', passesError);
      return res.status(500).json({
        error: 'Failed to fetch order passes',
        details: passesError.message
      });
    }

    const passes = orderPasses && orderPasses.length > 0
      ? orderPasses
      : [{
          id: 'legacy',
          order_id: orderId,
          pass_type: order.pass_type || 'Standard',
          quantity: order.quantity || 1,
          price: order.total_price / (order.quantity || 1)
        }];

    // Step 6: Build email HTML using shared helper function (reuses exact same template)
    const emailHtml = buildTicketEmailHtml(order, tickets, passes, orderId);

    // Step 7: Send email
    let emailSent = false;
    let emailError = null;

    try {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error('Email service not configured');
      }

      // CRITICAL: Brevo SMTP restriction - The SMTP login (EMAIL_USER) must NEVER be used as the "from" address.
      // Emails must be sent from a verified sender domain. Use contact@andiamoevents.com instead.
      console.log('📤 Sending email to:', order.user_email);
      const emailResult = await transporter.sendMail({
        from: '"Andiamo Events" <contact@andiamoevents.com>',
        replyTo: '"Andiamo Events" <contact@andiamoevents.com>',
        to: order.user_email,
        subject: 'Your Digital Tickets Are Ready - Andiamo Events',
        html: emailHtml
      });

      console.log('✅ Email sent successfully:', {
        messageId: emailResult.messageId,
        to: order.user_email
      });

      emailSent = true;

      // Step 8: Log to email_delivery_logs
      await dbClient.from('email_delivery_logs').insert({
        order_id: orderId,
        email_type: 'ticket_resend',
        recipient_email: order.user_email,
        recipient_name: order.user_name,
        subject: 'Your Digital Tickets Are Ready - Andiamo Events',
        status: 'sent',
        sent_at: new Date().toISOString()
      });

    } catch (emailErrorCaught) {
      emailError = emailErrorCaught;
      console.error('❌ Error sending email:', emailErrorCaught);

      // Log email failure
      await dbClient.from('email_delivery_logs').insert({
        order_id: orderId,
        email_type: 'ticket_resend',
        recipient_email: order.user_email,
        recipient_name: order.user_name,
        subject: 'Your Digital Tickets Are Ready - Andiamo Events',
        status: 'failed',
        error_message: emailErrorCaught.message || 'Unknown error'
      });
    }

    // Step 9: Log to order_logs (audit trail)
    try {
      await dbClient.from('order_logs').insert({
        order_id: orderId,
        action: 'admin_resend_ticket_email',
        performed_by: adminId,
        performed_by_type: 'admin',
        details: {
          email_sent: emailSent,
          email_error: emailError?.message || null,
          tickets_count: tickets.length,
          admin_email: adminEmail,
          admin_action: true
        }
      });
      console.log('✅ Audit log created');
    } catch (logError) {
      console.error('❌ Error creating audit log:', logError);
    }

    console.log('📧 ============================================');
    console.log('📧 ADMIN: Resend Ticket Email Completed');
    console.log('📧 ============================================\n');

    if (!emailSent) {
      return res.status(500).json({
        error: 'Failed to send email',
        details: emailError?.message || 'Unknown error',
        orderId: orderId
      });
    }

    res.status(200).json({
      success: true,
      message: 'Ticket email resent successfully',
      orderId: orderId,
      emailSent: true,
      ticketsCount: tickets.length
    });

  } catch (error) {
    console.error('\n❌ ============================================');
    console.error('❌ ADMIN: Resend Ticket Email Error');
    console.error('❌ ============================================');
    console.error('❌ Error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    console.error('❌ ============================================\n');

    res.status(500).json({
      error: 'Failed to resend ticket email',
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

// ============================================
// STOCK SYSTEM - Shared Stock Release Function
// ============================================
// Single source of truth for stock release
// Idempotent - uses stock_released flag to prevent double-release
// Fisher-Yates shuffle algorithm for randomizing array order
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function releaseOrderStock(orderId, reason) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const dbClient = supabaseService || supabase;

  // Step 1: Atomically check and set stock_released flag
  // This prevents double-release from webhook retries, admin double-clicks, or race conditions
  const { data: orderUpdate, error: updateError } = await dbClient
    .from('orders')
    .update({ stock_released: true })
    .eq('id', orderId)
    .eq('stock_released', false)  // Only update if NOT already released
    .select('id, status')
    .single();

  // If update failed or no rows updated, stock was already released or order doesn't exist
  if (updateError || !orderUpdate) {
    if (updateError && updateError.code !== 'PGRST116') {
      console.error('Error updating stock_released flag:', updateError);
      throw new Error(`Failed to release stock: ${updateError.message}`);
    }
    // Order already has stock_released = true or doesn't exist
    // This is OK - idempotent operation
    return { released: false, message: 'Stock already released or order not found' };
  }

  // Step 2: Fetch order_passes (with or without pass_id)
  const { data: orderPasses, error: passesError } = await dbClient
    .from('order_passes')
    .select('pass_id, pass_type, quantity')
    .eq('order_id', orderId);

  if (passesError) {
    console.error('Error fetching order_passes:', passesError);
    throw new Error(`Failed to fetch order passes: ${passesError.message}`);
  }

  if (!orderPasses || orderPasses.length === 0) {
    // No passes found
    console.warn(`Order ${orderId} has no order_passes - cannot release stock`);
    return { released: false, message: 'No order_passes found' };
  }

  // Step 2b: Get event_id for fallback matching
  const { data: order, error: orderError } = await dbClient
    .from('orders')
    .select('event_id')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    console.error('Error fetching order:', orderError);
    throw new Error(`Failed to fetch order: ${orderError?.message || 'Order not found'}`);
  }

  // Step 3: Decrement sold_quantity for each pass
  // Use atomic UPDATE to prevent negative stock
  // Handles both pass_id and pass_type matching (fallback)
  let releasedCount = 0;
  for (const orderPass of orderPasses) {
    let passIdToUse = orderPass.pass_id;

    // If pass_id is NULL, try to find it by matching pass_type
    if (!passIdToUse && orderPass.pass_type && order.event_id) {
      const { data: matchedPass, error: matchError } = await dbClient
        .from('event_passes')
        .select('id')
        .eq('name', orderPass.pass_type)
        .eq('event_id', order.event_id)
        .limit(1)
        .single();

      if (!matchError && matchedPass) {
        passIdToUse = matchedPass.id;
        console.log(`Found pass_id ${passIdToUse} by matching pass_type "${orderPass.pass_type}"`);
      } else {
        console.warn(`Cannot find pass_id for pass_type "${orderPass.pass_type}" in event ${order.event_id} - skipping`);
        continue;
      }
    }

    if (!passIdToUse) {
      console.warn(`Order pass has no pass_id and cannot match by pass_type - skipping`);
      continue;
    }

    // Fetch current sold_quantity first
    const { data: currentPass, error: fetchError } = await dbClient
      .from('event_passes')
      .select('sold_quantity')
      .eq('id', passIdToUse)
      .single();

    if (fetchError || !currentPass) {
      console.error(`Error fetching pass ${passIdToUse} for stock release:`, fetchError);
      continue;
    }

    // Decrement stock atomically
    const newSoldQuantity = Math.max(0, currentPass.sold_quantity - orderPass.quantity);
    const { error: updateError } = await dbClient
      .from('event_passes')
      .update({ sold_quantity: newSoldQuantity })
      .eq('id', passIdToUse)
      .eq('sold_quantity', currentPass.sold_quantity);  // Ensure no one else updated it

    if (updateError) {
      console.error(`Error releasing stock for pass ${passIdToUse}:`, updateError);
      // Continue with other passes even if one fails
      continue;
    }

    releasedCount++;
  }

  // Step 4: Log stock release action
  try {
    await dbClient.from('order_logs').insert({
      order_id: orderId,
      action: 'stock_released',
      performed_by: null,
      performed_by_type: 'system',
      details: {
        reason: reason,
        passes_released: releasedCount,
        timestamp: new Date().toISOString()
      }
    });
  } catch (logError) {
    console.warn('Failed to log stock release (non-fatal):', logError);
  }

  return {
    released: true,
    passesReleased: releasedCount,
    message: `Stock released for ${releasedCount} pass(es)`
  };
}

// ============================================
// PHASE 1: SERVER-SIDE ORDER CREATION
// ============================================
// POST /api/orders/create
// Server-side order creation with atomic stock reservation
// REPLACES frontend direct Supabase inserts
app.post('/api/orders/create', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const {
      customerInfo,
      passes,
      paymentMethod,
      ambassadorId,
      eventId
    } = req.body;

    // Validate required fields
    if (!customerInfo || !passes || !paymentMethod) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'customerInfo, passes, and paymentMethod are required'
      });
    }

    if (!Array.isArray(passes) || passes.length === 0) {
      return res.status(400).json({
        error: 'Invalid passes',
        details: 'passes must be a non-empty array'
      });
    }

    // Validate customer info
    if (!customerInfo.full_name || !customerInfo.phone || !customerInfo.email || !customerInfo.city) {
      return res.status(400).json({
        error: 'Missing customer information',
        details: 'full_name, phone, email, and city are required'
      });
    }

    // Validate payment method
    const validPaymentMethods = ['online', 'external_app', 'ambassador_cash'];
    if (!validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({
        error: 'Invalid payment method',
        details: `Payment method must be one of: ${validPaymentMethods.join(', ')}`
      });
    }

    // Validate ambassador for ambassador_cash
    if (paymentMethod === 'ambassador_cash' && !ambassadorId) {
      return res.status(400).json({
        error: 'Ambassador ID required',
        details: 'ambassadorId is required for ambassador_cash payment method'
      });
    }

    const dbClient = supabaseService || supabase;

    // STEP 1: Validate all passes exist and are active
    const passIds = passes.map(p => p.passId);
    const { data: eventPasses, error: passesError } = await dbClient
      .from('event_passes')
      .select('id, name, price, is_active, max_quantity, sold_quantity, allowed_payment_methods')
      .in('id', passIds);

    if (passesError) {
      console.error('Error fetching passes:', passesError);
      return res.status(500).json({
        error: 'Failed to validate passes',
        details: passesError.message
      });
    }

    if (!eventPasses || eventPasses.length !== passIds.length) {
      return res.status(400).json({
        error: 'Invalid passes',
        details: 'One or more passes not found'
      });
    }

    // Create pass lookup map
    const passMap = new Map();
    eventPasses.forEach(p => passMap.set(p.id, p));

    // STEP 2: Validate each pass and check stock availability
    const validatedPasses = [];
    for (const pass of passes) {
      const eventPass = passMap.get(pass.passId);
      
      if (!eventPass) {
        return res.status(400).json({
          error: 'Invalid pass',
          details: `Pass ${pass.passId} not found`
        });
      }

      // Check if pass is active
      if (!eventPass.is_active) {
        return res.status(400).json({
          error: 'Pass not available',
          details: `Pass "${eventPass.name}" is no longer available for purchase`
        });
      }

      // Validate payment method compatibility (BACKEND ENFORCEMENT - MANDATORY)
      // If allowed_payment_methods is NULL, allow all methods (backward compatible)
      if (eventPass.allowed_payment_methods && eventPass.allowed_payment_methods.length > 0) {
        if (!eventPass.allowed_payment_methods.includes(paymentMethod)) {
          return res.status(400).json({
            error: 'Payment method not allowed',
            details: `Pass "${eventPass.name}" is only available with the following payment methods: ${eventPass.allowed_payment_methods.join(', ')}. Selected method: ${paymentMethod}`
          });
        }
      }

      // Validate price (server is authority for pricing)
      if (parseFloat(eventPass.price) !== parseFloat(pass.price)) {
        console.warn(`Price mismatch for pass ${pass.passId}: client=${pass.price}, server=${eventPass.price}`);
        // Use server price
        pass.price = parseFloat(eventPass.price);
      }

      // Check stock availability
      if (eventPass.max_quantity !== null) {
        const remaining = eventPass.max_quantity - eventPass.sold_quantity;
        if (remaining < pass.quantity) {
          return res.status(400).json({
            error: 'Insufficient stock',
            details: `Only ${remaining} ${eventPass.name} pass(es) available, requested ${pass.quantity}`
          });
        }
      }

      validatedPasses.push({
        ...pass,
        eventPass: eventPass
      });
    }

    // STEP 3: Atomically reserve stock for ALL passes (all-or-nothing)
    // Use sequential atomic UPDATEs - if ANY fails, we rollback by not creating order
    const stockReservations = [];
    for (const validatedPass of validatedPasses) {
      const { id, max_quantity, sold_quantity } = validatedPass.eventPass;

      // If unlimited stock, skip reservation
      if (max_quantity === null) {
        stockReservations.push({ passId: id, reserved: true, unlimited: true });
        continue;
      }

      // Atomic stock reservation
      // First re-fetch current stock to check availability (prevents stale reads)
      const { data: currentPass, error: fetchError } = await dbClient
        .from('event_passes')
        .select('sold_quantity, max_quantity, is_active')
        .eq('id', id)
        .single();

      if (fetchError || !currentPass) {
        // Rollback already reserved stock
        for (const reservation of stockReservations) {
          if (!reservation.unlimited && reservation.reserved) {
            const prevPass = validatedPasses.find(p => p.passId === reservation.passId);
            if (prevPass) {
              // Fetch current sold_quantity and decrement
              const { data: currentStock } = await dbClient
                .from('event_passes')
                .select('sold_quantity')
                .eq('id', reservation.passId)
                .single();
              if (currentStock) {
                await dbClient
                  .from('event_passes')
                  .update({ sold_quantity: Math.max(0, currentStock.sold_quantity - prevPass.quantity) })
                  .eq('id', reservation.passId);
              }
            }
          }
        }
        return res.status(400).json({
          error: 'Pass not found',
          details: `Pass with ID ${id} not found`
        });
      }

      // Check stock availability with current values
      if (!currentPass.is_active) {
        // Rollback
        for (const reservation of stockReservations) {
          if (!reservation.unlimited && reservation.reserved) {
            const prevPass = validatedPasses.find(p => p.passId === reservation.passId);
            if (prevPass) {
              const { data: currentStock } = await dbClient
                .from('event_passes')
                .select('sold_quantity')
                .eq('id', reservation.passId)
                .single();
              if (currentStock) {
                await dbClient
                  .from('event_passes')
                  .update({ sold_quantity: Math.max(0, currentStock.sold_quantity - prevPass.quantity) })
                  .eq('id', reservation.passId);
              }
            }
          }
        }
        return res.status(400).json({
          error: 'Pass not available',
          details: `Pass "${validatedPass.eventPass.name}" is no longer active`
        });
      }

      if (currentPass.max_quantity !== null) {
        const newSoldQuantity = currentPass.sold_quantity + validatedPass.quantity;
        if (newSoldQuantity > currentPass.max_quantity) {
          // Rollback
          for (const reservation of stockReservations) {
            if (!reservation.unlimited && reservation.reserved) {
              const prevPass = validatedPasses.find(p => p.passId === reservation.passId);
              if (prevPass) {
                const { data: currentStock } = await dbClient
                  .from('event_passes')
                  .select('sold_quantity')
                  .eq('id', reservation.passId)
                  .single();
                if (currentStock) {
                  await dbClient
                    .from('event_passes')
                    .update({ sold_quantity: Math.max(0, currentStock.sold_quantity - prevPass.quantity) })
                    .eq('id', reservation.passId);
                }
              }
            }
          }
          const remaining = currentPass.max_quantity - currentPass.sold_quantity;
          return res.status(400).json({
            error: 'Insufficient stock',
            details: `Only ${remaining} ${validatedPass.eventPass.name} pass(es) available, requested ${validatedPass.quantity}`
          });
        }
      }

      // Atomic UPDATE - only succeeds if conditions still met
      const { data: updatedPass, error: reserveError } = await dbClient
        .from('event_passes')
        .update({
          sold_quantity: currentPass.sold_quantity + validatedPass.quantity
        })
        .eq('id', id)
        .eq('is_active', true)
        .eq('sold_quantity', currentPass.sold_quantity)  // Ensure no one else updated it
        .select('id, sold_quantity')
        .single();

      if (reserveError || !updatedPass) {
        // Stock reservation failed - need to release already reserved stock
        console.error(`Stock reservation failed for pass ${id}:`, reserveError);
        
        // Release any already reserved stock
        for (const reservation of stockReservations) {
          if (!reservation.unlimited && reservation.reserved) {
            const pass = validatedPasses.find(p => p.passId === reservation.passId);
            if (pass) {
              const { data: currentStock } = await dbClient
                .from('event_passes')
                .select('sold_quantity')
                .eq('id', reservation.passId)
                .single();
              if (currentStock) {
                await dbClient
                  .from('event_passes')
                  .update({ sold_quantity: Math.max(0, currentStock.sold_quantity - pass.quantity) })
                  .eq('id', reservation.passId);
              }
            }
          }
        }

        return res.status(400).json({
          error: 'Stock reservation failed',
          details: `Insufficient stock for "${validatedPass.eventPass.name}" or pass is no longer active`
        });
      }

      stockReservations.push({ passId: id, reserved: true, unlimited: false });
    }

    // STEP 4: Calculate totals (server-side authority)
    const totalQuantity = validatedPasses.reduce((sum, p) => sum + p.quantity, 0);
    const totalPrice = validatedPasses.reduce((sum, p) => sum + (parseFloat(p.price) * p.quantity), 0);

    // STEP 5: Determine initial status
    let initialStatus;
    switch (paymentMethod) {
      case 'online':
      case 'external_app':
        initialStatus = 'PENDING_ONLINE';
        break;
      case 'ambassador_cash':
        initialStatus = 'PENDING_CASH';
        break;
      default:
        // Rollback stock reservations
        for (const reservation of stockReservations) {
          if (!reservation.unlimited) {
            const pass = validatedPasses.find(p => p.passId === reservation.passId);
            if (pass) {
              const { data: currentStock } = await dbClient
                .from('event_passes')
                .select('sold_quantity')
                .eq('id', reservation.passId)
                .single();
              if (currentStock) {
                await dbClient
                  .from('event_passes')
                  .update({ sold_quantity: Math.max(0, currentStock.sold_quantity - pass.quantity) })
                  .eq('id', reservation.passId);
              }
            }
          }
        }
        return res.status(400).json({
          error: 'Invalid payment method',
          details: `Unknown payment method: ${paymentMethod}`
        });
    }

    // STEP 6: Create order
    const orderData = {
      source: paymentMethod === 'ambassador_cash' ? 'platform_cod' : 'platform_online',
      user_name: customerInfo.full_name.trim(),
      user_phone: customerInfo.phone.trim(),
      user_email: customerInfo.email.trim() || null,
      city: customerInfo.city.trim(),
      ville: customerInfo.ville?.trim() || null,
      event_id: eventId || null,
      ambassador_id: ambassadorId || null,
      quantity: totalQuantity,
      total_price: totalPrice,
      payment_method: paymentMethod,
      status: initialStatus,
      stock_released: false,  // Stock is reserved, not released
      assigned_at: ambassadorId ? new Date().toISOString() : null,
      notes: JSON.stringify({
        all_passes: validatedPasses.map(p => ({
          passId: p.passId,
          passName: p.passName,
          quantity: p.quantity,
          price: p.price
        })),
        total_order_price: totalPrice,
        pass_count: validatedPasses.length
      })
    };

    const { data: order, error: orderError } = await dbClient
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      // Rollback stock reservations
      console.error('Order creation failed, rolling back stock:', orderError);
      for (const reservation of stockReservations) {
        if (!reservation.unlimited) {
          const pass = validatedPasses.find(p => p.passId === reservation.passId);
          if (pass) {
            const { data: currentStock } = await dbClient
              .from('event_passes')
              .select('sold_quantity')
              .eq('id', reservation.passId)
              .single();
            if (currentStock) {
              await dbClient
                .from('event_passes')
                .update({ sold_quantity: Math.max(0, currentStock.sold_quantity - pass.quantity) })
                .eq('id', reservation.passId);
            }
          }
        }
      }
      return res.status(500).json({
        error: 'Failed to create order',
        details: orderError.message
      });
    }

    // STEP 7: Create order_passes WITH pass_id (REQUIRED)
    const orderPassesData = validatedPasses.map(pass => ({
      order_id: order.id,
      pass_id: pass.passId,  // REQUIRED for stock release
      pass_type: pass.passName,  // Historical display
      quantity: pass.quantity,
      price: parseFloat(pass.price)
    }));

    const { error: passesInsertError } = await dbClient
      .from('order_passes')
      .insert(orderPassesData);

    if (passesInsertError) {
        // Rollback: delete order and release stock
        console.error('Order passes creation failed, rolling back:', passesInsertError);
        await dbClient.from('orders').delete().eq('id', order.id);
        for (const reservation of stockReservations) {
          if (!reservation.unlimited) {
            const pass = validatedPasses.find(p => p.passId === reservation.passId);
            if (pass) {
              const { data: currentStock } = await dbClient
                .from('event_passes')
                .select('sold_quantity')
                .eq('id', reservation.passId)
                .single();
              if (currentStock) {
                await dbClient
                  .from('event_passes')
                  .update({ sold_quantity: Math.max(0, currentStock.sold_quantity - pass.quantity) })
                  .eq('id', reservation.passId);
              }
            }
          }
        }
      return res.status(500).json({
        error: 'Failed to create order passes',
        details: passesInsertError.message
      });
    }

    // STEP 8: Send SMS notifications for COD orders (non-blocking)
    if (paymentMethod === 'ambassador_cash' && ambassadorId) {
      // Fire and forget - don't block response
      setImmediate(async () => {
        try {
          const apiBase = process.env.API_URL || 'http://localhost:8082';
          await fetch(`${apiBase}/api/send-order-confirmation-sms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: order.id })
          });
          await fetch(`${apiBase}/api/send-ambassador-order-sms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: order.id })
          });
          
          // Send order confirmation emails to both client and ambassador (same time as SMS)
          await sendOrderConfirmationEmails(order.id);
        } catch (smsError) {
          console.error('Failed to send SMS notifications (non-fatal):', smsError);
        }
      });
    }

    // STEP 9: Return created order with order_passes
    const { data: createdOrder, error: fetchError } = await dbClient
      .from('orders')
      .select(`
        *,
        order_passes (*)
      `)
      .eq('id', order.id)
      .single();

    if (fetchError) {
      console.warn('Failed to fetch created order with relations:', fetchError);
      // Return order without relations
      return res.status(201).json({
        success: true,
        order: order
      });
    }

    res.status(201).json({
      success: true,
      order: createdOrder
    });

  } catch (error) {
    console.error('Error in /api/orders/create:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// ============================================
// AIO EVENTS SUBMISSIONS
// ============================================
// POST /api/aio-events/save-submission
// Saves user data when they click "Online Payment By AIO Events"
// Does NOT create orders, send emails, or send SMS - just saves data for lead generation
app.post('/api/aio-events/save-submission', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const {
      customerInfo,
      eventInfo,
      selectedPasses,
      totalPrice,
      totalQuantity,
      language
    } = req.body;

    // Validate required fields
    if (!customerInfo) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'customerInfo is required'
      });
    }

    // Validate customer info
    if (!customerInfo.full_name || !customerInfo.phone || !customerInfo.email || !customerInfo.city) {
      return res.status(400).json({
        error: 'Missing customer information',
        details: 'full_name, phone, email, and city are required'
      });
    }

    // Validate selected passes (allow empty array)
    if (!Array.isArray(selectedPasses)) {
      return res.status(400).json({
        error: 'Invalid passes',
        details: 'selectedPasses must be an array'
      });
    }

    // Validate totals
    if (typeof totalPrice !== 'number' || totalPrice < 0) {
      return res.status(400).json({
        error: 'Invalid total price',
        details: 'totalPrice must be a non-negative number'
      });
    }

    if (typeof totalQuantity !== 'number' || totalQuantity < 0) {
      return res.status(400).json({
        error: 'Invalid total quantity',
        details: 'totalQuantity must be a non-negative number'
      });
    }

    const dbClient = supabaseService || supabase;

    // Extract IP address and user agent
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || null;
    const userAgent = req.headers['user-agent'] || null;

    // Prepare submission data
    const submissionData = {
      // Customer Information
      full_name: customerInfo.full_name.trim(),
      email: customerInfo.email.trim().toLowerCase(),
      phone: customerInfo.phone.trim(),
      city: customerInfo.city.trim(),
      ville: customerInfo.ville ? customerInfo.ville.trim() : null,
      
      // Event Information
      event_id: eventInfo?.id || null,
      event_name: eventInfo?.name || null,
      event_date: eventInfo?.date || null,
      event_venue: eventInfo?.venue || null,
      event_city: eventInfo?.city || null,
      
      // Selected Passes (as JSONB)
      selected_passes: selectedPasses,
      
      // Totals
      total_price: totalPrice,
      total_quantity: totalQuantity,
      
      // Metadata
      language: language || 'en',
      user_agent: userAgent,
      ip_address: ipAddress,
      status: 'submitted'
    };

    // Insert submission into database
    const { data: submission, error: insertError } = await dbClient
      .from('aio_events_submissions')
      .insert(submissionData)
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting AIO events submission:', insertError);
      return res.status(500).json({
        error: 'Failed to save submission',
        details: insertError.message
      });
    }

    // Return success response
    res.status(201).json({
      success: true,
      submission: {
        id: submission.id,
        submitted_at: submission.submitted_at
      }
    });

  } catch (error) {
    console.error('Error in /api/aio-events/save-submission:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
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
      '/api/send-email': 'Send email (admin auth required)',
      '/api/orders/create': 'Create order (server-side with stock validation)'
    }
  });
});

// Admin POS (Point de Vente) — forward to api/admin-pos.js for local dev (vercel.json rewrites handle this on Vercel)
let adminPosHandler = null;
async function handleAdminPos(req, res, next) {
  try {
    if (!adminPosHandler) adminPosHandler = (await import('./api/admin-pos.js')).default;
    req.url = req.originalUrl || req.url;
    await adminPosHandler(req, res);
  } catch (e) {
    console.error('[/api/admin/pos-*]', e);
    next(e);
  }
}
app.use('/api/admin/pos-outlets', (req, res, next) => handleAdminPos(req, res, next));
app.use('/api/admin/pos-users', (req, res, next) => handleAdminPos(req, res, next));
app.use('/api/admin/pos-stock', (req, res, next) => handleAdminPos(req, res, next));
app.use('/api/admin/pos-orders', (req, res, next) => handleAdminPos(req, res, next));
app.use('/api/admin/pos-audit-log', (req, res, next) => handleAdminPos(req, res, next));
app.use('/api/admin/pos-events', (req, res, next) => handleAdminPos(req, res, next));
app.get('/api/admin/pos-statistics', (req, res, next) => handleAdminPos(req, res, next));

// POS (Point de Vente) — /api/pos/:outletSlug/login | logout | verify | events | passes/:eventId | orders/create
let posHandler = null;
async function handlePos(req, res, next) {
  try {
    if (!posHandler) posHandler = (await import('./api/pos.js')).default;
    req.url = req.originalUrl || req.url;
    await posHandler(req, res);
  } catch (e) {
    console.error('[/api/pos]', e);
    next(e);
  }
}
app.use('/api/pos', (req, res, next) => handlePos(req, res, next));

// ClicToPay payment gateway (local dev - forwards to api/*.js handlers)
async function handleClicToPayGenerate(req, res, next) {
  try {
    const handler = (await import('./api/clictopay-generate-payment.js')).default;
    await handler(req, res);
  } catch (e) {
    console.error('[/api/clictopay-generate-payment]', e);
    next(e);
  }
}
app.post('/api/clictopay-generate-payment', (req, res, next) => handleClicToPayGenerate(req, res, next));
app.get('/api/clictopay-generate-payment', (req, res) => {
  res.status(405).json({ error: 'Method not allowed', details: 'Use POST to generate payment' });
});

async function handleClicToPayConfirm(req, res, next) {
  try {
    const miscHandler = (await import('./api/misc.js')).default;
    req.url = req.originalUrl || req.url;
    await miscHandler(req, res);
  } catch (e) {
    console.error('[/api/clictopay-confirm-payment]', e);
    next(e);
  }
}
app.all('/api/clictopay-confirm-payment', (req, res, next) => handleClicToPayConfirm(req, res, next));

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
  if (process.env.SENTRY_DSN) Sentry.captureException(error);
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // Exit in production for uncaught exceptions
  process.exit(1);
});

// Sentry error handler (before other error handlers)
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

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

