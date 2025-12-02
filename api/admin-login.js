// Clean, minimal admin login endpoint for Vercel
// No Express, no serverless-http - just a simple handler

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Parse request body
    let body = '';
    for await (const chunk of req) {
      body += chunk.toString();
    }
    
    const { email, password, recaptchaToken } = JSON.parse(body);
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    // Check environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      console.error('Missing environment variables:', {
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY
      });
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'Supabase not configured. Please check SUPABASE_URL and SUPABASE_ANON_KEY environment variables.'
      });
    }
    
    // Initialize Supabase
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    // Find admin
    const { data: admin, error: dbError } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();
    
    if (dbError || !admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Verify password
    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(password, admin.password);
    
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT
    const jwt = require('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-dev-only';
    
    if (!jwtSecret || jwtSecret === 'fallback-secret-dev-only') {
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({ 
          error: 'Server configuration error',
          details: 'JWT_SECRET is required in production'
        });
      }
    }
    
    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      jwtSecret,
      { expiresIn: '1h' }
    );
    
    // Set cookie
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieParts = [
      `adminToken=${token}`,
      'HttpOnly',
      'Path=/',
      `Max-Age=${3600}`,
      isProduction ? 'Secure' : '',
      'SameSite=Lax'
    ].filter(Boolean);
    
    if (isProduction && process.env.COOKIE_DOMAIN) {
      cookieParts.push(`Domain=${process.env.COOKIE_DOMAIN}`);
    }
    
    res.setHeader('Set-Cookie', cookieParts.join('; '));
    res.setHeader('Content-Type', 'application/json');
    
    return res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('Admin login error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    return res.status(500).json({ 
      error: 'Server error',
      details: error.message,
      type: error.name
    });
  }
};

