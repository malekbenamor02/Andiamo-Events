/**
 * Shared CORS utility for Vercel serverless functions
 * Provides consistent CORS handling across all API routes
 */

// CORS configuration - allow all origins in development, specific origins in production
const isDevelopment = process.env.NODE_ENV !== 'production';

// Default production origins (can be overridden via ALLOWED_ORIGINS env var)
const defaultProductionOrigins = [
  'https://www.andiamoevents.com',
  'https://andiamoevents.com'
];

function getAllowedOrigins() {
  if (isDevelopment) {
    return ['http://localhost:8080', 'http://localhost:3000', 'http://localhost:5173', 'http://192.168.1.*', 'http://10.0.*', 'http://127.0.0.1:3000'];
  }
  
  return process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : defaultProductionOrigins;
}

/**
 * Determines if an origin is allowed
 * @param {string} origin - The origin to check
 * @returns {boolean} - True if origin is allowed
 */
function isOriginAllowed(origin) {
  if (isDevelopment) {
    return true; // Allow all in development
  }
  
  if (!origin) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    return true;
  }
  
  const allowedOrigins = getAllowedOrigins();
  
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
    return true;
  }
  
  // On Vercel, allow same-origin requests
  const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_URL;
  if (isVercel && origin && (origin.includes(process.env.VERCEL_URL || '') || origin.includes(process.env.VERCEL_BRANCH_URL || ''))) {
    return true;
  }
  
  return false;
}

/**
 * Gets the allowed origin for a request
 * @param {object} req - Request object
 * @returns {string|null} - Allowed origin or null if not allowed or no origin header
 */
function getCorsOrigin(req) {
  // Only process CORS if there's an Origin header (CORS is only for cross-origin requests)
  const origin = req.headers?.origin;
  
  // No Origin header means same-origin request - don't set CORS headers
  if (!origin) {
    return null;
  }
  
  if (isDevelopment) {
    return origin;
  }
  
  if (isOriginAllowed(origin)) {
    return origin;
  }
  
  return null;
}

/**
 * Sets CORS headers on a response
 * @param {object} res - Response object
 * @param {object} req - Request object
 * @param {object} options - Optional configuration (credentials: boolean to enable credentials)
 * @returns {boolean} - True if headers were set, false if origin not allowed or no origin
 */
function setCORSHeaders(res, req, options = {}) {
  const origin = getCorsOrigin(req);
  
  // No origin or origin not allowed - don't set CORS headers
  if (origin === null) {
    return false;
  }
  
  // Set CORS headers only for cross-origin requests with valid origin
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', options.methods || 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', options.headers || 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
  
  // Only set credentials if explicitly requested (and origin is not '*')
  if (options.credentials !== false && origin !== '*') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  return true;
}

/**
 * Handles OPTIONS preflight requests
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {object} options - Optional configuration
 * @returns {boolean} - True if preflight was handled
 */
function handlePreflight(req, res, options = {}) {
  if (req.method === 'OPTIONS') {
    if (setCORSHeaders(res, req, options)) {
      res.status(200).end();
      return true;
    } else {
      res.status(403).json({ error: 'CORS policy: Origin not allowed' });
      return true;
    }
  }
  return false;
}

export {
  getCorsOrigin,
  setCORSHeaders,
  handlePreflight,
  isOriginAllowed,
  getAllowedOrigins
};
