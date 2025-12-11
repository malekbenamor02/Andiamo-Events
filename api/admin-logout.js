// Admin logout endpoint for Vercel
// Clears the JWT token cookie and requires re-authentication

export default async (req, res) => {
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
    // Clear the adminToken cookie with the same settings as login
    // This ensures the cookie is properly removed
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieParts = [
      'adminToken=',
      'HttpOnly',
      'Path=/',
      'Max-Age=0', // Set to 0 to expire immediately
      'Expires=Thu, 01 Jan 1970 00:00:00 GMT', // Expire in the past
      isProduction ? 'Secure' : '',
      'SameSite=Lax'
    ].filter(Boolean);
    
    if (isProduction && process.env.COOKIE_DOMAIN) {
      cookieParts.push(`Domain=${process.env.COOKIE_DOMAIN}`);
    }
    
    res.setHeader('Set-Cookie', cookieParts.join('; '));
    res.setHeader('Content-Type', 'application/json');
    
    return res.status(200).json({ 
      success: true,
      message: 'Logged out successfully. Please re-enter your credentials to continue.'
    });
    
  } catch (error) {
    console.error('Admin logout error:', error);
    return res.status(500).json({ 
      error: 'Server error',
      details: error.message
    });
  }
};

