// Minimal admin-login endpoint - no Express, just raw handler
// This is the most basic version to debug FUNCTION_INVOCATION_FAILED

console.log('🔵 [MINIMAL-LOGIN] Module loading...');

module.exports = async (req, res) => {
  console.log('🔵 [MINIMAL-LOGIN] Handler called');
  console.log('🔵 [MINIMAL-LOGIN] Request method:', req.method);
  console.log('🔵 [MINIMAL-LOGIN] Request path:', req.url);
  
  try {
    // Only handle POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Parse body manually (no body-parser)
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        const { email, password, recaptchaToken } = JSON.parse(body);
        
        console.log('🔵 [MINIMAL-LOGIN] Email:', email);
        console.log('🔵 [MINIMAL-LOGIN] Has password:', !!password);
        
        // Check environment variables
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
          console.error('❌ [MINIMAL-LOGIN] Supabase not configured');
          return res.status(500).json({ 
            error: 'Supabase not configured',
            hasUrl: !!process.env.SUPABASE_URL,
            hasKey: !!process.env.SUPABASE_ANON_KEY
          });
        }
        
        console.log('🔵 [MINIMAL-LOGIN] Loading Supabase client...');
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        
        console.log('🔵 [MINIMAL-LOGIN] Querying database...');
        const { data: admin, error } = await supabase
          .from('admins')
          .select('*')
          .eq('email', email.toLowerCase().trim())
          .single();
          
        if (error) {
          console.error('❌ [MINIMAL-LOGIN] Supabase error:', error);
          return res.status(401).json({ 
            error: 'Invalid credentials', 
            details: error.message 
          });
        }
        
        if (!admin) {
          console.error('❌ [MINIMAL-LOGIN] Admin not found');
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        console.log('🔵 [MINIMAL-LOGIN] Admin found, verifying password...');
        const bcrypt = require('bcryptjs');
        const isMatch = await bcrypt.compare(password, admin.password);
        
        if (!isMatch) {
          console.error('❌ [MINIMAL-LOGIN] Password mismatch');
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        console.log('🔵 [MINIMAL-LOGIN] Password verified, generating token...');
        const jwt = require('jsonwebtoken');
        const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-dev-only';
        const token = jwt.sign(
          { id: admin.id, email: admin.email, role: admin.role },
          jwtSecret,
          { expiresIn: '1h' }
        );
        
        // Set cookie manually
        const cookieOptions = [
          `adminToken=${token}`,
          'HttpOnly',
          'Path=/',
          `Max-Age=${60 * 60}`,
          process.env.NODE_ENV === 'production' ? 'Secure' : '',
          'SameSite=Lax'
        ].filter(Boolean).join('; ');
        
        res.setHeader('Set-Cookie', cookieOptions);
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({ success: true });
        console.log('✅ [MINIMAL-LOGIN] Login successful');
        
      } catch (parseError) {
        console.error('❌ [MINIMAL-LOGIN] Error parsing request:', parseError);
        res.status(400).json({ error: 'Invalid request', details: parseError.message });
      }
    });
    
  } catch (error) {
    console.error('❌ [MINIMAL-LOGIN] Handler error:', error);
    console.error('❌ [MINIMAL-LOGIN] Stack:', error.stack);
    res.status(500).json({ 
      error: 'Server error', 
      details: error.message 
    });
  }
};

console.log('✅ [MINIMAL-LOGIN] Module loaded');
