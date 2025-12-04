/**
 * Main server entry point
 * Express app setup and configuration
 */

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { initializeSupabase } = require('./utils/supabase.cjs');
const { initializeEmail } = require('./utils/email.cjs');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler.cjs');

// Load environment variables
try {
  require('dotenv').config();
} catch (e) {
  console.log('dotenv not available (this is OK on Vercel)');
}

// Initialize services
initializeSupabase();
initializeEmail();

const app = express();

// CORS configuration
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'])
  : ['http://localhost:8080', 'http://localhost:3000', 'http://192.168.1.*', 'http://10.0.*', 'http://127.0.0.1:3000', /^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
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
      callback(null, true);
    } else {
      const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_URL;
      if (isVercel && origin && (origin.includes(process.env.VERCEL_URL || '') || origin.includes(process.env.VERCEL_BRANCH_URL || ''))) {
        return callback(null, true);
      }
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
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

// Request logging middleware (development only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    if (req.body && Object.keys(req.body).length > 0) {
      console.log('Request body:', JSON.stringify(req.body, null, 2));
    }
    next();
  });
}

// Body parsing middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Vercel serverless function path handling
app.use((req, res, next) => {
  if ((process.env.VERCEL === '1' || process.env.VERCEL_URL) && !req.path.startsWith('/api')) {
    req.url = '/api' + req.url;
    req.path = '/api' + req.path;
  }
  next();
});

// API versioning - mount v1 routes
const v1Router = express.Router();

// Import and mount route modules
const authRoutes = require('./routes/auth.cjs');
const emailRoutes = require('./routes/email.cjs');
const smsRoutes = require('./routes/sms.cjs');

v1Router.use('/auth', authRoutes);
v1Router.use('/email', emailRoutes);
v1Router.use('/sms', smsRoutes);

// Mount v1 router under /api/v1
app.use('/api/v1', v1Router);

// Legacy routes (backward compatibility) - proxy to v1 routes
const legacyAuthRoutes = require('./routes/legacyAuth.cjs');
app.use('/api', legacyAuthRoutes);

// Health check endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API is working',
    vercel: process.env.VERCEL === '1',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Start server (only if not in Vercel serverless environment)
if (require.main === module) {
  const PORT = process.env.PORT || 8082;
  app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
  });
}

// Export for Vercel serverless functions
module.exports = app;

