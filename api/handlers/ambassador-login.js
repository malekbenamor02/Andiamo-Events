// Ambassador login endpoint for Vercel
// Using ES module syntax because package.json has "type": "module"

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
    // Parse request body
    let bodyData;
    if (req.body) {
      bodyData = req.body;
    } else {
      let body = '';
      for await (const chunk of req) {
        body += chunk.toString();
      }
      bodyData = JSON.parse(body);
    }
    
    const { phone, password, recaptchaToken } = bodyData;

    // Validate input
    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone number and password are required' });
    }

    // Check environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return res.status(500).json({ 
        error: 'Supabase not configured',
        details: 'Please check environment variables: SUPABASE_URL and SUPABASE_ANON_KEY must be set'
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
            return res.status(400).json({ error: 'reCAPTCHA verification failed' });
          }
        } catch (recaptchaError) {
          console.error('reCAPTCHA verification error:', recaptchaError);
          return res.status(500).json({ error: 'reCAPTCHA verification service unavailable' });
        }
      }
    }

    // Initialize Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

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
    const bcrypt = await import('bcryptjs');
    const isPasswordValid = await bcrypt.default.compare(password, ambassador.password);
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

    // Success - return ambassador data
    return res.status(200).json({ 
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
    console.error('Ambassador login error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
};

