import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {

  // Enable CORS - for credentials, we must use a specific origin, not '*'
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', method: req.method });
  }

  try {
    const { email, password, recaptchaToken } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Verify reCAPTCHA
    if (!recaptchaToken) {
      return res.status(400).json({ error: 'reCAPTCHA verification required' });
    }

    const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || '6LeEYhgsAAAAADTmLFws26HY-xbGWH1T8PPCnvia';
    
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
          details: 'Please complete the reCAPTCHA verification and try again.'
        });
      }
    } catch (recaptchaError) {
      console.error('reCAPTCHA verification error:', recaptchaError);
      // Don't block login if reCAPTCHA service is unavailable, but log it
      console.warn('reCAPTCHA verification service unavailable, proceeding with login');
    }

    // Check if environment variables are set
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'Missing Supabase environment variables. Please check Vercel settings.'
      });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Fetch admin by email
    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !admin) {
      // Don't reveal if admin exists or not for security
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Validate that admin has a password
    if (!admin.password) {
      console.error('Admin record has no password field');
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'Admin account is not properly configured. Please contact administrator.'
      });
    }

    // Check if password looks like a bcrypt hash (basic validation)
    // Bcrypt hashes are 60 characters and start with $2a$, $2b$, or $2y$
    const looksLikeBcrypt = admin.password && 
                            admin.password.length === 60 && 
                            (admin.password.startsWith('$2a$') || 
                             admin.password.startsWith('$2b$') || 
                             admin.password.startsWith('$2y$'));
    
    if (!looksLikeBcrypt) {
      console.error('Admin password does not appear to be a valid bcrypt hash.');
      console.error('Password info:', {
        length: admin.password?.length,
        startsWith: admin.password?.substring(0, 4),
        preview: admin.password?.substring(0, 20) + '...'
      });
      // Don't block login - let bcrypt.compare handle it, but log the warning
      console.warn('Attempting password comparison anyway - bcrypt will handle validation.');
    }

    // Compare password
    let isMatch;
    try {
      isMatch = await bcrypt.compare(password, admin.password);
    } catch (bcryptError) {
      console.error('Bcrypt comparison error:', bcryptError);
      return res.status(500).json({ 
        error: 'Server error',
        details: 'Password verification failed. Please contact administrator.'
      });
    }
    
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT (2 hours for session cookie)
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.warn('WARNING: JWT_SECRET is not set! Using fallback secret. This is insecure in production.');
      // Only block in actual production deployments, not local development
      const isActualProduction = process.env.VERCEL_ENV === 'production' && 
                                  process.env.NODE_ENV === 'production' &&
                                  !process.env.VERCEL_URL?.includes('localhost');
      if (isActualProduction) {
        return res.status(500).json({ 
          error: 'Server configuration error',
          details: 'JWT_SECRET environment variable is required in production.'
        });
      }
    }
    
    let token;
    try {
      token = jwt.sign(
        { id: admin.id, email: admin.email, role: admin.role },
        jwtSecret || 'fallback-secret-dev-only',
        { expiresIn: '2h' }
      );
    } catch (jwtError) {
      console.error('JWT signing error:', jwtError);
      return res.status(500).json({ 
        error: 'Server error',
        details: 'Failed to generate authentication token.'
      });
    }

    // Set cookie (session cookie - expires when browser closes)
    const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
    const cookieOptions = [
      `adminToken=${token}`,
      'HttpOnly',
      'Path=/',
      'SameSite=Lax',
      isProduction ? 'Secure' : '',
    ].filter(Boolean).join('; ');
    
    res.setHeader('Set-Cookie', cookieOptions);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    console.error('Error stack:', error.stack);
    // Provide more detailed error information for debugging
    const errorDetails = {
      message: error.message,
      name: error.name,
      // Only include stack in development
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
    };
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      ...(process.env.NODE_ENV !== 'production' && { debug: errorDetails })
    });
  }
} 