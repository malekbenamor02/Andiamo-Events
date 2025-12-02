// Verify admin endpoint for Vercel
// Checks if the admin is authenticated via JWT cookie

export default async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Get token from cookie
    const cookies = req.headers.cookie || '';
    const cookieMatch = cookies.match(/adminToken=([^;]+)/);
    const token = cookieMatch ? cookieMatch[1] : null;
    
    if (!token) {
      return res.status(401).json({ 
        valid: false, 
        error: 'No token provided' 
      });
    }
    
    // Verify JWT
    const jwt = await import('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-dev-only';
    
    let decoded;
    try {
      decoded = jwt.default.verify(token, jwtSecret);
    } catch (jwtError) {
      // Token is invalid or expired
      return res.status(401).json({ 
        valid: false, 
        error: 'Invalid or expired token',
        reason: jwtError.message
      });
    }
    
    // Check environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return res.status(500).json({ 
        valid: false, 
        error: 'Supabase not configured' 
      });
    }
    
    // Initialize Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    // Verify admin exists in database
    const { data: admin, error: dbError } = await supabase
      .from('admins')
      .select('id, email, name, role, is_active')
      .eq('id', decoded.id)
      .eq('email', decoded.email)
      .eq('is_active', true)
      .single();
    
    if (dbError || !admin) {
      return res.status(401).json({ 
        valid: false, 
        error: 'Invalid admin' 
      });
    }
    
    // Calculate session expiration
    const tokenExpiration = decoded.exp ? decoded.exp * 1000 : null;
    const timeRemaining = tokenExpiration 
      ? Math.max(0, Math.floor((tokenExpiration - Date.now()) / 1000)) 
      : 0;
    
    // Return admin info with session expiration
    return res.status(200).json({ 
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
    console.error('Verify admin error:', error);
    return res.status(500).json({ 
      valid: false, 
      error: 'Server error',
      details: error.message
    });
  }
};

