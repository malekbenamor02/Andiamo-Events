// Unified non-critical API endpoints for Vercel
// Merges: admin-logout, admin-update-application, ambassador-login, ambassador-application, ambassadors/active, phone-subscribe, send-email
// This reduces function count from 7 to 1

// Inlined verifyAdminAuth function (for admin-update-application and send-email)
async function verifyAdminAuth(req) {
  try {
    const cookies = req.headers.cookie || '';
    const cookieMatch = cookies.match(/adminToken=([^;]+)/);
    const token = cookieMatch ? cookieMatch[1] : null;
    
    if (!token) {
      return {
        valid: false,
        error: 'No authentication token provided',
        statusCode: 401
      };
    }
    
    const jwt = await import('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-dev-only';
    
    const isProduction = process.env.NODE_ENV === 'production' || 
                         process.env.VERCEL === '1' || 
                         !!process.env.VERCEL_URL;
    
    if (!jwtSecret || jwtSecret === 'fallback-secret-dev-only') {
      if (isProduction) {
        return {
          valid: false,
          error: 'Server configuration error: JWT_SECRET not set',
          statusCode: 500
        };
      }
    }
    
    let decoded;
    try {
      decoded = jwt.default.verify(token, jwtSecret);
    } catch (jwtError) {
      return {
        valid: false,
        error: 'Invalid or expired token',
        reason: jwtError.name === 'TokenExpiredError' 
          ? 'Token expired - session ended' 
          : jwtError.message,
        statusCode: 401
      };
    }
    
    if (!decoded.id || !decoded.email || !decoded.role) {
      return {
        valid: false,
        error: 'Invalid token payload',
        statusCode: 401
      };
    }
    
    if (decoded.role !== 'admin' && decoded.role !== 'super_admin') {
      return {
        valid: false,
        error: 'Invalid admin role',
        statusCode: 403
      };
    }
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return {
        valid: false,
        error: 'Supabase not configured',
        statusCode: 500
      };
    }
    
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    const { data: admin, error: dbError } = await supabase
      .from('admins')
      .select('id, email, name, role, is_active')
      .eq('id', decoded.id)
      .eq('email', decoded.email)
      .eq('is_active', true)
      .single();
    
    if (dbError || !admin) {
      return {
        valid: false,
        error: 'Admin not found or inactive',
        statusCode: 401
      };
    }
    
    if (admin.role !== decoded.role) {
      return {
        valid: false,
        error: 'Admin role mismatch',
        statusCode: 401
      };
    }
    
    const tokenExpiration = decoded.exp ? decoded.exp * 1000 : null;
    const timeRemaining = tokenExpiration 
      ? Math.max(0, Math.floor((tokenExpiration - Date.now()) / 1000)) 
      : 0;
    
    return {
      valid: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role
      },
      sessionExpiresAt: tokenExpiration,
      sessionTimeRemaining: timeRemaining
    };
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    return {
      valid: false,
      error: 'Authentication error',
      details: error.message,
      statusCode: 500
    };
  }
}

// Helper to parse request body
async function parseBody(req) {
  if (req.body) {
    return req.body;
  } else {
    let body = '';
    for await (const chunk of req) {
      body += chunk.toString();
    }
    return JSON.parse(body);
  }
}

// Helper to set CORS headers
function setCORSHeaders(res, req) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async (req, res) => {
  // Get path from URL, handling both /api/... and /... formats (Vercel may strip /api prefix)
  let path = req.url.split('?')[0]; // Remove query string
  // Normalize path: if it doesn't start with /api but matches known API routes, add /api prefix
  // This handles Vercel rewrites where /api might be stripped
  if (!path.startsWith('/api/') && (
    path.startsWith('/admin/') || 
    path.startsWith('/ambassador') || 
    path.startsWith('/phone') || 
    path.startsWith('/send-email')
  )) {
    path = '/api' + path;
  }
  const method = req.method;
  
  // Set CORS headers
  setCORSHeaders(res, req);
  
  // Handle preflight
  if (method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Route based on path and method
  try {
    // ============================================
    // /api/admin-logout
    // ============================================
    if (path === '/api/admin-logout' && method === 'POST') {
      try {
        const isProduction = process.env.NODE_ENV === 'production' || 
                             process.env.VERCEL === '1' || 
                             !!process.env.VERCEL_URL;
        const cookieParts = [
          'adminToken=',
          'HttpOnly',
          'Path=/',
          'Max-Age=0',
          'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
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
    }
    
    // ============================================
    // /api/admin-update-application
    // ============================================
    if (path === '/api/admin-update-application' && method === 'POST') {
      try {
        const authResult = await verifyAdminAuth(req);
        
        if (!authResult.valid) {
          return res.status(authResult.statusCode || 401).json({
            error: authResult.error,
            reason: authResult.reason || 'Authentication failed',
            valid: false
          });
        }
        
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
        
        const bodyData = await parseBody(req);
        const { applicationId, status, reapply_delay_date } = bodyData;
        
        if (!applicationId || !status) {
          return res.status(400).json({ 
            error: 'Missing required fields',
            details: 'applicationId and status are required'
          });
        }
        
        if (!['approved', 'rejected'].includes(status)) {
          return res.status(400).json({ 
            error: 'Invalid status',
            details: 'status must be "approved" or "rejected"'
          });
        }
        
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_ANON_KEY
        );
        
        const updateData = { status };
        if (reapply_delay_date) {
          updateData.reapply_delay_date = reapply_delay_date;
        }
        
        let result = await supabase
          .from('ambassador_applications')
          .update({ 
            ...updateData,
            updated_at: new Date().toISOString()
          })
          .eq('id', applicationId)
          .select();
        
        if (result.error && result.error.message?.includes('updated_at')) {
          result = await supabase
            .from('ambassador_applications')
            .update(updateData)
            .eq('id', applicationId)
            .select();
        }
        
        if (result.error) {
          console.error('Error updating application:', result.error);
          return res.status(500).json({ 
            error: 'Failed to update application',
            details: result.error.message,
            code: result.error.code
          });
        }
        
        if (!result.data || result.data.length === 0) {
          return res.status(404).json({ 
            error: 'Application not found',
            details: `No application found with id: ${applicationId}`
          });
        }
        
        return res.status(200).json({ 
          success: true, 
          data: result.data[0],
          message: `Application ${status} successfully`
        });
      } catch (error) {
        console.error('Admin update application error:', error);
        return res.status(500).json({ 
          error: 'Internal server error',
          details: error.message,
          type: error.name
        });
      }
    }
    
    // ============================================
    // /api/ambassador-login
    // ============================================
    if (path === '/api/ambassador-login' && method === 'POST') {
      try {
        const bodyData = await parseBody(req);
        const { phone, password, recaptchaToken } = bodyData;

        if (!phone || !password) {
          return res.status(400).json({ error: 'Phone number and password are required' });
        }

        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
          return res.status(500).json({ 
            error: 'Supabase not configured',
            details: 'Please check environment variables: SUPABASE_URL and SUPABASE_ANON_KEY must be set'
          });
        }

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

        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_ANON_KEY
        );

        const { data: ambassador, error } = await supabase
          .from('ambassadors')
          .select('*')
          .eq('phone', phone)
          .single();

        if (error || !ambassador) {
          return res.status(401).json({ error: 'Invalid phone number or password' });
        }

        const bcrypt = await import('bcryptjs');
        const isPasswordValid = await bcrypt.default.compare(password, ambassador.password);
        if (!isPasswordValid) {
          return res.status(401).json({ error: 'Invalid phone number or password' });
        }

        if (ambassador.status === 'pending') {
          return res.status(403).json({ error: 'Your application is under review' });
        }

        if (ambassador.status === 'rejected') {
          return res.status(403).json({ error: 'Your application was not approved' });
        }

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
    }
    
    // ============================================
    // /api/ambassador-application
    // ============================================
    if (path === '/api/ambassador-application' && method === 'POST') {
      try {
        const bodyData = await parseBody(req);
        const { fullName, age, phoneNumber, email, city, ville, socialLink, motivation } = bodyData;

        if (!fullName || !age || !phoneNumber || !city) {
          return res.status(400).json({ error: 'Full name, age, phone number, and city are required' });
        }

        if (!motivation || !motivation.trim()) {
          return res.status(400).json({ error: 'Motivation is required' });
        }

        const phoneRegex = /^[2459][0-9]{7}$/;
        if (!phoneRegex.test(phoneNumber)) {
          return res.status(400).json({ error: 'Phone number must be 8 digits starting with 2, 4, 5, or 9' });
        }

        if (socialLink && !socialLink.trim().startsWith('https://www.instagram.com/') && !socialLink.trim().startsWith('https://instagram.com/')) {
          return res.status(400).json({ error: 'Instagram link must start with https://www.instagram.com/ or https://instagram.com/' });
        }

        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
          return res.status(500).json({ 
            error: 'Supabase not configured',
            details: 'Please check environment variables: SUPABASE_URL and SUPABASE_ANON_KEY must be set'
          });
        }

        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_ANON_KEY
        );

        const sanitizedFullName = fullName.trim();
        const sanitizedEmail = email ? email.trim() : null;
        const sanitizedCity = city ? city.trim() : '';
        
        let sanitizedVille = null;
        if (ville !== undefined && ville !== null && String(ville).trim() !== '') {
          sanitizedVille = String(ville).trim();
        }
        const sanitizedSocialLink = socialLink ? socialLink.trim() : null;
        const sanitizedMotivation = motivation.trim();

        const { data: existingAmbByPhone } = await supabase
          .from('ambassadors')
          .select('id')
          .eq('phone', phoneNumber)
          .maybeSingle();

        if (existingAmbByPhone) {
          return res.status(400).json({ error: 'This phone number is already registered as an approved ambassador' });
        }

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

        let villeValue = null;
        
        if (sanitizedCity === 'Sousse') {
          if (!sanitizedVille || sanitizedVille.trim() === '') {
            return res.status(400).json({ error: 'Ville (neighborhood) is required for Sousse' });
          }
          villeValue = sanitizedVille.trim();
        }
        
        if (sanitizedCity === 'Tunis') {
          if (!sanitizedVille || sanitizedVille.trim() === '') {
            return res.status(400).json({ error: 'Ville (neighborhood) is required for Tunis' });
          }
          villeValue = sanitizedVille.trim();
        }

        const insertData = {
          full_name: sanitizedFullName,
          age: parseInt(age),
          phone_number: phoneNumber,
          email: sanitizedEmail,
          city: sanitizedCity,
          ville: villeValue,
          social_link: sanitizedSocialLink,
          motivation: sanitizedMotivation,
          status: 'pending'
        };

        const { data: application, error: insertError } = await supabase
          .from('ambassador_applications')
          .insert(insertData)
          .select()
          .single();

        if (insertError) {
          if (insertError.code === '23505' || insertError.message?.includes('unique constraint') || insertError.message?.includes('duplicate key')) {
            return res.status(400).json({ error: 'An application with this phone number or email already exists. Please contact support if you believe this is an error.' });
          }
          console.error('Error inserting application:', insertError);
          return res.status(500).json({ error: 'Failed to submit application', details: insertError.message });
        }
        
        return res.status(200).json({ 
          success: true, 
          message: 'Application submitted successfully',
          applicationId: application.id
        });
      } catch (error) {
        console.error('Error in ambassador application:', error);
        return res.status(500).json({ 
          error: 'Internal server error', 
          details: error.message 
        });
      }
    }
    
    // ============================================
    // /api/ambassadors/active
    // ============================================
    if (path === '/api/ambassadors/active' && method === 'GET') {
      try {
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
          return res.status(500).json({ error: 'Supabase not configured' });
        }

        const { city, ville } = req.query;

        if (!city) {
          return res.status(400).json({ error: 'City parameter is required' });
        }

        const normalizedCity = String(city).trim();
        const normalizedVille = ville && String(ville).trim() !== '' ? String(ville).trim() : null;

        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_ANON_KEY
        );

        let dbClient = supabase;
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          dbClient = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
          );
        }
        
        let query = dbClient
          .from('ambassadors')
          .select('id, full_name, phone, email, city, ville, status, commission_rate')
          .eq('status', 'approved')
          .eq('city', normalizedCity);

        // For Sousse: ignore ville filter, show all ambassadors in Sousse
        // For other cities: filter by ville if provided
        if (normalizedVille && normalizedCity !== 'Sousse') {
          query = query.eq('ville', normalizedVille);
        }
        
        query = query.order('full_name');

        const { data: ambassadors, error } = await query;

        if (error) {
          console.error('❌ Error fetching active ambassadors:', error);
          return res.status(500).json({ error: error.message });
        }

        const ambassadorsWithSocial = await Promise.all(
          (ambassadors || []).map(async (ambassador) => {
            const { data: application } = await dbClient
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

        return res.json({ success: true, data: ambassadorsWithSocial || [] });
      } catch (error) {
        console.error('❌ Error in ambassadors/active endpoint:', error);
        return res.status(500).json({ error: error.message || 'Failed to fetch active ambassadors' });
      }
    }
    
    // ============================================
    // /api/phone-subscribe
    // ============================================
    if (path === '/api/phone-subscribe' && method === 'POST') {
      try {
        const bodyData = await parseBody(req);
        const { phone_number, language } = bodyData;

        if (!phone_number) {
          return res.status(400).json({ error: 'Phone number is required' });
        }

        const phoneRegex = /^[2594][0-9]{7}$/;
        if (!phoneRegex.test(phone_number)) {
          return res.status(400).json({ error: 'Invalid phone number format' });
        }

        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
          return res.status(500).json({ 
            error: 'Supabase not configured',
            details: 'Please check environment variables: SUPABASE_URL and SUPABASE_ANON_KEY must be set'
          });
        }

        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_ANON_KEY
        );

        const { data: existingSubscriber, error: checkError } = await supabase
          .from('phone_subscribers')
          .select('id')
          .eq('phone_number', phone_number)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('Error checking for duplicate phone number:', checkError);
          return res.status(500).json({ error: 'Failed to check phone number' });
        }

        if (existingSubscriber) {
          return res.status(400).json({ error: 'Phone number already exists' });
        }

        const { data: subscriber, error: insertError } = await supabase
          .from('phone_subscribers')
          .insert({
            phone_number: phone_number,
            language: language || 'en'
          })
          .select()
          .single();

        if (insertError) {
          if (insertError.code === '23505' || insertError.message?.includes('unique constraint') || insertError.message?.includes('duplicate key')) {
            return res.status(400).json({ error: 'Phone number already exists' });
          }
          console.error('Error inserting phone subscriber:', insertError);
          return res.status(500).json({ error: 'Failed to subscribe', details: insertError.message });
        }

        return res.status(200).json({ 
          success: true, 
          message: 'Phone number subscribed successfully',
          subscriber: {
            id: subscriber.id,
            phone_number: subscriber.phone_number
          }
        });
      } catch (error) {
        console.error('Error in phone subscription:', error);
        return res.status(500).json({ 
          error: 'Internal server error', 
          details: error.message 
        });
      }
    }
    
    // ============================================
    // /api/send-email
    // ============================================
    if (path === '/api/send-email' && method === 'POST') {
      try {
        const authResult = await verifyAdminAuth(req);
        
        if (!authResult.valid) {
          res.clearCookie('adminToken', { path: '/' });
          return res.status(authResult.statusCode || 401).json({
            error: authResult.error,
            reason: authResult.reason || 'Authentication required',
            valid: false
          });
        }
        
        const bodyData = await parseBody(req);
        const { to, subject, html, from } = bodyData;
        
        if (!to || !subject || !html) {
          return res.status(400).json({ 
            error: 'Missing required fields', 
            details: 'to, subject, and html are required' 
          });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(to)) {
          return res.status(400).json({ 
            error: 'Invalid email address', 
            details: `The email address "${to}" is not valid. Please verify the email address and try again.` 
          });
        }
        
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
          console.error('Email configuration missing: EMAIL_USER or EMAIL_PASS not set');
          return res.status(500).json({ 
            error: 'Email service not configured', 
            details: 'Email server configuration is missing. Please contact the administrator.' 
          });
        }
        
        const nodemailer = await import('nodemailer');
        
        const transporter = nodemailer.default.createTransport({
          host: process.env.EMAIL_HOST,
          port: parseInt(process.env.EMAIL_PORT || '587'),
          secure: false,
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });
        
        // CRITICAL: Brevo SMTP restriction - The SMTP login (EMAIL_USER) must NEVER be used as the "from" address.
        // Emails must be sent from a verified sender domain. Use contact@andiamoevents.com instead.
        // Always enforce the correct sender address, ignoring any "from" field in the request.
        await transporter.sendMail({
          from: '"Andiamo Events" <contact@andiamoevents.com>',
          replyTo: '"Andiamo Events" <contact@andiamoevents.com>',
          to,
          subject,
          html,
        });
        
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json({ success: true });
      } catch (error) {
        console.error('Email sending failed:', error);
        
        let errorMessage = 'Failed to send email';
        let errorDetails = error.message || 'Unknown error occurred';
        
        if (error.code === 'EAUTH' || error.responseCode === 535) {
          errorMessage = 'Email authentication failed';
          errorDetails = 'The email server credentials are invalid. Please contact the administrator.';
        } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
          errorMessage = 'Email server connection failed';
          errorDetails = 'Unable to connect to the email server. Please try again later.';
        } else if (error.responseCode === 550 || error.message?.includes('550')) {
          errorMessage = 'Email address rejected';
          errorDetails = `The email address "${req.body?.to || 'unknown'}" was rejected by the email server. Please verify the email address and try again.`;
        } else if (error.responseCode === 553 || error.message?.includes('553')) {
          errorMessage = 'Invalid email address';
          errorDetails = `The email address "${req.body?.to || 'unknown'}" is invalid. Please verify the email address and try again.`;
        }
        
        return res.status(500).json({ 
          error: errorMessage, 
          details: errorDetails 
        });
      }
    }
    
    // ============================================
    // /api/admin/passes/:eventId (GET)
    // ============================================
    if (path.startsWith('/api/admin/passes/') && method === 'GET') {
      try {
        const authResult = await verifyAdminAuth(req);
        
        if (!authResult.valid) {
          return res.status(authResult.statusCode || 401).json({
            error: authResult.error,
            reason: authResult.reason || 'Authentication failed',
            valid: false
          });
        }
        
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
          return res.status(500).json({ error: 'Supabase not configured' });
        }
        
        // Extract eventId from path: /api/admin/passes/[eventId]
        const pathParts = path.split('/');
        const eventId = pathParts[pathParts.length - 1];
        
        if (!eventId) {
          return res.status(400).json({ error: 'Event ID is required' });
        }
        
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_ANON_KEY
        );
        
        let dbClient = supabase;
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          dbClient = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
          );
        }
        
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
        
        return res.status(200).json({
          success: true,
          passes: passesWithStock
        });
      } catch (error) {
        console.error('Error in /api/admin/passes/:eventId:', error);
        return res.status(500).json({
          error: 'Internal server error',
          details: error.message
        });
      }
    }
    
    // ============================================
    // /api/admin/passes/:id/stock (POST)
    // ============================================
    if (path.includes('/api/admin/passes/') && path.endsWith('/stock') && method === 'POST') {
      try {
        const authResult = await verifyAdminAuth(req);
        
        if (!authResult.valid) {
          return res.status(authResult.statusCode || 401).json({
            error: authResult.error,
            reason: authResult.reason || 'Authentication failed',
            valid: false
          });
        }
        
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
          return res.status(500).json({ error: 'Supabase not configured' });
        }
        
        // Extract pass ID from path: /api/admin/passes/[id]/stock
        const pathParts = path.split('/');
        const passId = pathParts[pathParts.length - 2]; // Second to last part
        
        if (!passId) {
          return res.status(400).json({ error: 'Pass ID is required' });
        }
        
        const bodyData = await parseBody(req);
        const { max_quantity } = bodyData;
        const adminId = authResult.admin?.id;
        const adminEmail = authResult.admin?.email;
        
        if (max_quantity !== null && max_quantity !== undefined && (typeof max_quantity !== 'number' || max_quantity < 0)) {
          return res.status(400).json({
            error: 'Invalid max_quantity',
            details: 'max_quantity must be null (unlimited) or a non-negative integer'
          });
        }
        
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_ANON_KEY
        );
        
        let dbClient = supabase;
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          dbClient = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
          );
        }
        
        // Fetch current pass state
        const { data: currentPass, error: fetchError } = await dbClient
          .from('event_passes')
          .select('*')
          .eq('id', passId)
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
          .eq('id', passId)
          .select()
          .single();
        
        if (updateError) {
          console.error('Error updating pass stock:', updateError);
          return res.status(500).json({
            error: 'Failed to update pass stock',
            details: updateError.message
          });
        }
        
        // Log admin action
        try {
          await dbClient.from('security_audit_logs').insert({
            event_type: 'admin_stock_update',
            user_id: adminId,
            endpoint: '/api/admin/passes/:id/stock',
            ip_address: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown',
            user_agent: req.headers['user-agent'] || 'unknown',
            details: {
              pass_id: passId,
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
        
        return res.status(200).json({
          success: true,
          pass: {
            ...updatedPass,
            remaining_quantity: updatedPass.max_quantity === null ? null : (updatedPass.max_quantity - updatedPass.sold_quantity),
            is_unlimited: updatedPass.max_quantity === null
          }
        });
      } catch (error) {
        console.error('Error in /api/admin/passes/:id/stock:', error);
        return res.status(500).json({
          error: 'Internal server error',
          details: error.message
        });
      }
    }
    
    // ============================================
    // /api/admin/passes/:id/payment-methods (PUT)
    // ============================================
    if (path.includes('/api/admin/passes/') && path.endsWith('/payment-methods') && method === 'PUT') {
      try {
        const authResult = await verifyAdminAuth(req);
        
        if (!authResult.valid) {
          return res.status(authResult.statusCode || 401).json({
            error: authResult.error,
            reason: authResult.reason || 'Authentication failed',
            valid: false
          });
        }
        
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
          return res.status(500).json({ error: 'Supabase not configured' });
        }
        
        // Extract pass ID from path: /api/admin/passes/[id]/payment-methods
        const pathParts = path.split('/');
        const passId = pathParts[pathParts.length - 2]; // Second to last part
        
        if (!passId) {
          return res.status(400).json({ error: 'Pass ID is required' });
        }
        
        const bodyData = await parseBody(req);
        const { allowed_payment_methods } = bodyData;
        const adminId = authResult.admin?.id;
        const adminEmail = authResult.admin?.email;
        
        if (!adminId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_ANON_KEY
        );
        
        let dbClient = supabase;
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          dbClient = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
          );
        }
        
        // Fetch current pass to verify it exists
        const { data: currentPass, error: fetchError } = await dbClient
          .from('event_passes')
          .select('id, name, event_id, allowed_payment_methods')
          .eq('id', passId)
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
          .eq('id', passId)
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
            ip_address: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown',
            user_agent: req.headers['user-agent'] || 'unknown',
            details: {
              pass_id: passId,
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
        
        return res.status(200).json({
          success: true,
          pass: updatedPass
        });
      } catch (error) {
        console.error('Error in /api/admin/passes/:id/payment-methods:', error);
        return res.status(500).json({
          error: 'Internal server error',
          details: error.message
        });
      }
    }
    
    // ============================================
    // /api/admin/passes/:id/activate (POST)
    // ============================================
    if (path.includes('/api/admin/passes/') && path.endsWith('/activate') && method === 'POST') {
      try {
        const authResult = await verifyAdminAuth(req);
        
        if (!authResult.valid) {
          return res.status(authResult.statusCode || 401).json({
            error: authResult.error,
            reason: authResult.reason || 'Authentication failed',
            valid: false
          });
        }
        
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
          return res.status(500).json({ error: 'Supabase not configured' });
        }
        
        // Extract pass ID from path: /api/admin/passes/[id]/activate
        const pathParts = path.split('/');
        const passId = pathParts[pathParts.length - 2]; // Second to last part
        
        if (!passId) {
          return res.status(400).json({ error: 'Pass ID is required' });
        }
        
        const bodyData = await parseBody(req);
        const { is_active } = bodyData;
        const adminId = authResult.admin?.id;
        const adminEmail = authResult.admin?.email;
        
        if (typeof is_active !== 'boolean') {
          return res.status(400).json({
            error: 'Invalid is_active',
            details: 'is_active must be a boolean'
          });
        }
        
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_ANON_KEY
        );
        
        let dbClient = supabase;
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          dbClient = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
          );
        }
        
        // Fetch current pass state
        const { data: currentPass, error: fetchError } = await dbClient
          .from('event_passes')
          .select('*')
          .eq('id', passId)
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
          .eq('id', passId)
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
            ip_address: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown',
            user_agent: req.headers['user-agent'] || 'unknown',
            details: {
              pass_id: passId,
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
        
        return res.status(200).json({
          success: true,
          pass: updatedPass
        });
      } catch (error) {
        console.error('Error in /api/admin/passes/:id/activate:', error);
        return res.status(500).json({
          error: 'Internal server error',
          details: error.message
        });
      }
    }
    
    // ============================================
    // /api/admin-skip-ambassador-confirmation (POST)
    // ============================================
    if (path === '/api/admin-skip-ambassador-confirmation' && method === 'POST') {
      try {
        const authResult = await verifyAdminAuth(req);
        
        if (!authResult.valid) {
          return res.status(authResult.statusCode || 401).json({
            error: authResult.error,
            reason: authResult.reason || 'Authentication failed',
            valid: false
          });
        }
        
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
          return res.status(500).json({ error: 'Supabase not configured' });
        }
        
        const bodyData = await parseBody(req);
        const { orderId, reason } = bodyData;
        const adminId = authResult.admin?.id;
        const adminEmail = authResult.admin?.email;
        
        if (!orderId) {
          return res.status(400).json({ error: 'Order ID is required' });
        }
        
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_ANON_KEY
        );
        
        let supabaseService = null;
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          supabaseService = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
          );
        }
        
        const dbClient = supabaseService || supabase;
        
        // Step 1: Verify order exists and is in valid status
        const { data: order, error: orderError } = await dbClient
          .from('orders')
          .select('id, status, source, payment_method, user_email, user_phone, total_price')
          .eq('id', orderId)
          .single();
        
        if (orderError || !order) {
          return res.status(404).json({ error: 'Order not found' });
        }
        
        // Step 2: Validate order status (must be PENDING_CASH or PENDING_ADMIN_APPROVAL)
        const validStatuses = ['PENDING_CASH', 'PENDING_ADMIN_APPROVAL'];
        if (!validStatuses.includes(order.status)) {
          // Log security event
          try {
            await dbClient.from('security_audit_logs').insert({
              event_type: 'invalid_status_transition',
              endpoint: '/api/admin-skip-ambassador-confirmation',
              user_id: adminId,
              ip_address: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown',
              user_agent: req.headers['user-agent'] || 'unknown',
              request_method: req.method,
              request_path: req.url,
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
        
        // Step 3: Update order status to PAID
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
          .in('status', validStatuses)
          .select('id, status')
          .single();
        
        if (updateError || !updatedOrder) {
          // Check if order was already updated (idempotency)
          const { data: checkOrder } = await dbClient
            .from('orders')
            .select('id, status')
            .eq('id', orderId)
            .single();
          
          if (checkOrder && checkOrder.status === 'PAID') {
            const { data: existingTickets } = await dbClient
              .from('tickets')
              .select('id')
              .eq('order_id', orderId)
              .limit(1);
            
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
          
          return res.status(500).json({
            error: 'Failed to update order status',
            details: updateError?.message || 'Unknown error'
          });
        }
        
        // Step 4: Generate tickets and send email/SMS (same logic as admin-approve-order)
        let ticketResult = {
          success: false,
          message: 'Ticket generation not started',
          ticketsCount: 0,
          emailSent: false,
          smsSent: false,
          error: null
        };
        
        try {
          console.log('🚀 Starting ticket generation and email/SMS sending...');
          
          // Fetch full order data with relations
          const { data: fullOrderData, error: fullOrderError } = await dbClient
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
          
          if (fullOrderError || !fullOrderData) {
            throw new Error(`Failed to fetch order data: ${fullOrderError?.message || 'Unknown error'}`);
          }
          
          const fullOrder = fullOrderData;
          
          // Check if tickets already exist
          const { data: existingTickets } = await dbClient
            .from('tickets')
            .select('id')
            .eq('order_id', orderId)
            .limit(1);
          
          if (existingTickets && existingTickets.length > 0) {
            console.log('⚠️ Tickets already exist, skipping generation');
            ticketResult = {
              success: true,
              message: 'Tickets already generated',
              ticketsCount: existingTickets.length,
              emailSent: true,
              smsSent: true
            };
          } else {
            // Fetch order passes
            const { data: orderPasses, error: passesError } = await dbClient
              .from('order_passes')
              .select('*')
              .eq('order_id', orderId);
            
            if (passesError) {
              throw new Error(`Failed to fetch order passes: ${passesError.message}`);
            }
            
            if (!orderPasses || orderPasses.length === 0) {
              throw new Error('No passes found for this order');
            }
            
            // Import required modules
            const { v4: uuidv4 } = await import('uuid');
            const QRCode = await import('qrcode');
            
            // Generate order access token
            const orderAccessToken = uuidv4();
            
            // Calculate expiration date
            let urlExpiresAt = null;
            if (fullOrder.events?.date) {
              const eventDate = new Date(fullOrder.events.date);
              eventDate.setDate(eventDate.getDate() + 1);
              urlExpiresAt = eventDate.toISOString();
            } else {
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
            
            // Generate tickets with QR codes
            const tickets = [];
            const storageClient = supabaseService || supabase;
            
            for (const pass of orderPasses) {
              for (let i = 0; i < pass.quantity; i++) {
                const secureToken = uuidv4();
                
                // Generate QR code
                const qrCodeBuffer = await QRCode.default.toBuffer(secureToken, {
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
                  console.error(`❌ Error uploading QR code:`, uploadError);
                  continue;
                }
                
                // Get public URL
                const { data: urlData } = storageClient.storage
                  .from('tickets')
                  .getPublicUrl(fileName);
                
                // Create ticket entry
                const { data: ticketData, error: ticketError } = await dbClient
                  .from('tickets')
                  .insert({
                    order_id: orderId,
                    order_pass_id: pass.id,
                    secure_token: secureToken,
                    qr_code_url: urlData?.publicUrl || null,
                    status: 'GENERATED',
                    generated_at: new Date().toISOString()
                  })
                  .select()
                  .single();
                
                if (ticketError) {
                  console.error(`❌ Error creating ticket:`, ticketError);
                  continue;
                }
                
                if (ticketData) {
                  tickets.push(ticketData);
                  
                  // Populate QR Ticket Registry (fails silently - must not block ticket generation)
                  try {
                    const pass = orderPasses.find(p => p.id === ticketData.order_pass_id);
                    const ambassador = fullOrder.ambassadors || null;
                    const event = fullOrder.events || null;
                    
                    const registryEntry = {
                      secure_token: ticketData.secure_token,
                      ticket_id: ticketData.id,
                      order_id: fullOrder.id,
                      source: fullOrder.source,
                      payment_method: fullOrder.payment_method || 'online',
                      ambassador_id: fullOrder.ambassador_id || null,
                      ambassador_name: ambassador?.full_name || null,
                      ambassador_phone: ambassador?.phone || null,
                      buyer_name: fullOrder.user_name,
                      buyer_phone: fullOrder.user_phone,
                      buyer_email: fullOrder.user_email || null,
                      buyer_city: fullOrder.city,
                      buyer_ville: fullOrder.ville || null,
                      event_id: fullOrder.event_id || null,
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
            
            console.log(`✅ Generated ${tickets.length} tickets`);
            ticketResult.ticketsCount = tickets.length;
            
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
            
            // Build tickets HTML for email
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
            
            const passesSummaryHtml = passesSummary.map(p => `
              <tr style="border-bottom: 1px solid rgba(0, 0, 0, 0.1);">
                <td style="padding: 12px 0; color: #1A1A1A; font-size: 15px;">${p.passType}</td>
                <td style="padding: 12px 0; color: #1A1A1A; font-size: 15px; text-align: center;">${p.quantity}</td>
                <td style="padding: 12px 0; color: #1A1A1A; font-size: 15px; text-align: right;">${p.price.toFixed(2)} TND</td>
              </tr>
            `).join('');
            
            // Send email with QR codes
            if (fullOrder.user_email && process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_HOST) {
              try {
                const nodemailer = await import('nodemailer');
                const transporter = nodemailer.default.createTransport({
                  host: process.env.EMAIL_HOST,
                  port: parseInt(process.env.EMAIL_PORT || '587'),
                  secure: false,
                  auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                  },
                });
                
                const emailHtml = `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Your Digital Tickets - Andiamo Events</title>
                    <style>
                      * { margin: 0; padding: 0; box-sizing: border-box; }
                      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1A1A1A; background: #FFFFFF; }
                      .email-wrapper { max-width: 600px; margin: 0 auto; background: #FFFFFF; }
                      .content-card { background: #F5F5F5; margin: 0 20px 30px; border-radius: 12px; padding: 50px 40px; border: 1px solid rgba(0, 0, 0, 0.1); }
                      .title-section { text-align: center; margin-bottom: 40px; padding-bottom: 30px; border-bottom: 1px solid rgba(0, 0, 0, 0.1); }
                      .title { font-size: 32px; font-weight: 700; color: #1A1A1A; margin-bottom: 12px; }
                      .subtitle { font-size: 16px; color: #666666; }
                      .greeting { font-size: 18px; color: #1A1A1A; margin-bottom: 30px; }
                      .greeting strong { color: #E21836; font-weight: 600; }
                      .message { font-size: 16px; color: #666666; margin-bottom: 25px; }
                      .order-info-block { background: #E8E8E8; border: 1px solid rgba(0, 0, 0, 0.15); border-radius: 8px; padding: 30px; margin: 40px 0; }
                      .info-row { margin-bottom: 20px; }
                      .info-label { font-size: 11px; color: #999999; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 10px; font-weight: 600; }
                      .info-value { font-family: 'Courier New', monospace; font-size: 18px; color: #1A1A1A; font-weight: 500; }
                      .passes-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                      .passes-table th { text-align: left; padding: 12px 0; color: #E21836; font-weight: 600; font-size: 14px; border-bottom: 2px solid rgba(226, 24, 54, 0.3); }
                      .passes-table td { padding: 12px 0; color: #1A1A1A; font-size: 15px; }
                      .total-row { border-top: 2px solid rgba(226, 24, 54, 0.3); }
                      .total-row td { font-weight: 700; font-size: 18px; color: #E21836; padding-top: 15px; }
                      .tickets-section { background: #E8E8E8; border: 1px solid rgba(0, 0, 0, 0.15); border-radius: 8px; padding: 30px; margin: 40px 0; }
                      .support-section { background: #E8E8E8; border-left: 3px solid rgba(226, 24, 54, 0.3); padding: 20px 25px; margin: 35px 0; border-radius: 4px; }
                      .support-text { font-size: 14px; color: #666666; line-height: 1.7; }
                      .support-email { color: #E21836 !important; text-decoration: none; font-weight: 500; }
                      .closing-section { text-align: center; margin: 50px 0 40px; padding-top: 40px; border-top: 1px solid rgba(0, 0, 0, 0.1); }
                      .slogan { font-size: 24px; font-style: italic; color: #E21836; font-weight: 300; margin-bottom: 30px; }
                      .signature { font-size: 16px; color: #666666; line-height: 1.7; }
                    </style>
                  </head>
                  <body>
                    <div class="email-wrapper">
                      <div class="content-card">
                        <div class="title-section">
                          <h1 class="title">Your Tickets Are Ready</h1>
                          <p class="subtitle">Order Confirmation - Andiamo Events</p>
                        </div>
                        <p class="greeting">Dear <strong>${fullOrder.user_name || 'Valued Customer'}</strong>,</p>
                        <p class="message">We're excited to confirm that your order has been successfully processed! Your digital tickets with unique QR codes are ready and attached below.</p>
                        <div class="order-info-block">
                          <div class="info-row">
                            <div class="info-label">Order Number</div>
                            <div class="info-value">${fullOrder.order_number !== null && fullOrder.order_number !== undefined ? `#${fullOrder.order_number}` : orderId.substring(0, 8).toUpperCase()}</div>
                          </div>
                          <div class="info-row">
                            <div class="info-label">Event</div>
                            <div style="font-size: 18px; color: #E21836; font-weight: 600;">${fullOrder.events?.name || 'Event'}</div>
                          </div>
                          <div class="info-row">
                            <div class="info-label">Event Time</div>
                            <div style="font-size: 18px; color: #E21836; font-weight: 600;">${fullOrder.events?.date ? (() => {
                              try {
                                const date = new Date(fullOrder.events.date);
                                if (!isNaN(date.getTime())) {
                                  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                                  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                                  const dayName = days[date.getDay()];
                                  const day = date.getDate();
                                  const monthName = months[date.getMonth()];
                                  const year = date.getFullYear();
                                  const hours = date.getHours().toString().padStart(2, '0');
                                  const minutes = date.getMinutes().toString().padStart(2, '0');
                                  return `${dayName} · ${day} ${monthName} ${year} · ${hours}:${minutes}`;
                                }
                              } catch (e) {}
                              return 'TBA';
                            })() : 'TBA'}</div>
                          </div>
                          <div class="info-row">
                            <div class="info-label">Venue</div>
                            <div style="font-size: 18px; color: #E21836; font-weight: 600;">${fullOrder.events?.venue || 'Venue to be announced'}</div>
                          </div>
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
                                <td style="text-align: right;"><strong>${fullOrder.total_price.toFixed(2)} TND</strong></td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div class="tickets-section">
                          <h3 style="color: #E21836; margin-bottom: 20px; font-size: 18px; font-weight: 600;">Your Digital Tickets</h3>
                          <p class="message" style="margin-bottom: 25px;">Please present these QR codes at the event entrance. Each ticket has a unique QR code for verification.</p>
                          ${ticketsHtml}
                        </div>
                        <div class="support-section">
                          <p class="support-text">Need assistance? Contact us at <a href="mailto:support@andiamoevents.com" class="support-email">support@andiamoevents.com</a>.</p>
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
                
                // CRITICAL: Brevo SMTP restriction - The SMTP login (EMAIL_USER) must NEVER be used as the "from" address.
                // Emails must be sent from a verified sender domain. Use contact@andiamoevents.com instead.
                await transporter.sendMail({
                  from: '"Andiamo Events" <contact@andiamoevents.com>',
                  replyTo: '"Andiamo Events" <contact@andiamoevents.com>',
                  to: fullOrder.user_email,
                  subject: 'Your Digital Tickets Are Ready - Andiamo Events',
                  html: emailHtml
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
                  recipient_email: fullOrder.user_email,
                  recipient_name: fullOrder.user_name,
                  subject: 'Your Digital Tickets Are Ready - Andiamo Events',
                  status: 'sent',
                  sent_at: new Date().toISOString()
                });
                
                ticketResult.emailSent = true;
                console.log('✅ Email sent successfully');
              } catch (emailError) {
                console.error('❌ Error sending email:', emailError);
                ticketResult.error = `Email failed: ${emailError.message}`;
              }
            } else {
              console.warn('⚠️ Email not sent - missing email address or email configuration');
            }
            
            // Send SMS
            if (fullOrder.user_phone && process.env.WINSMS_API_KEY) {
              try {
                // Format phone number
                let cleaned = fullOrder.user_phone.replace(/\D/g, '');
                if (cleaned.startsWith('216')) {
                  cleaned = cleaned.substring(3);
                }
                cleaned = cleaned.replace(/^0+/, '');
                
                if (cleaned.length === 8 && /^[2594]/.test(cleaned)) {
                  const formattedPhone = '+216' + cleaned;
                  
                  // Build SMS message
                  const orderNumber = fullOrder.order_number != null ? fullOrder.order_number.toString() : '';
                  const totalPrice = parseFloat(fullOrder.total_price).toFixed(0);
                  const smsMessage = `Paiement confirmé #${orderNumber}
Total: ${totalPrice} DT
Billets envoyés par email (Check SPAM).
We Create Memories`;
                  
                  // Send SMS via WinSMS API
                  const querystring = await import('querystring');
                  const https = await import('https');
                  
                  const queryParams = querystring.default.stringify({
                    action: 'send-sms',
                    api_key: process.env.WINSMS_API_KEY,
                    to: formattedPhone,
                    sms: smsMessage.trim(),
                    from: 'Andiamo',
                    response: 'json'
                  });
                  
                  const url = `https://www.winsmspro.com/sms/sms/api?${queryParams}`;
                  
                  const smsResponse = await new Promise((resolve, reject) => {
                    https.default.get(url, (res) => {
                      let data = '';
                      res.on('data', (chunk) => { data += chunk; });
                      res.on('end', () => {
                        try {
                          resolve({ status: res.statusCode, data: JSON.parse(data) });
                        } catch (e) {
                          resolve({ status: res.statusCode, data: data });
                        }
                      });
                    }).on('error', reject);
                  });
                  
                  const isSuccess = smsResponse.status === 200 &&
                    smsResponse.data &&
                    (smsResponse.data.code === 'ok' || smsResponse.data.code === '200');
                  
                  if (isSuccess) {
                    ticketResult.smsSent = true;
                    await dbClient.from('sms_logs').insert({
                      phone_number: fullOrder.user_phone,
                      message: smsMessage.trim(),
                      status: 'sent',
                      api_response: JSON.stringify(smsResponse.data),
                      sent_at: new Date().toISOString()
                    });
                    console.log('✅ SMS sent successfully');
                  } else {
                    throw new Error('SMS API returned error');
                  }
                } else {
                  console.warn('⚠️ Invalid phone number format:', fullOrder.user_phone);
                }
              } catch (smsError) {
                console.error('❌ Error sending SMS:', smsError);
                if (!ticketResult.error) {
                  ticketResult.error = `SMS failed: ${smsError.message}`;
                } else {
                  ticketResult.error += `; SMS failed: ${smsError.message}`;
                }
              }
            } else {
              console.warn('⚠️ SMS not sent - missing phone number or SMS configuration');
            }
            
            ticketResult.success = true;
            ticketResult.message = 'Tickets generated successfully';
          }
        } catch (ticketError) {
          console.error('❌ Error generating tickets:', ticketError);
          ticketResult.error = ticketError.message;
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
        }
        
        return res.status(200).json({
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
        console.error('❌ Error in /api/admin-skip-ambassador-confirmation:', error);
        return res.status(500).json({
          error: 'Failed to skip ambassador confirmation',
          details: error.message
        });
      }
    }
    
    // ============================================
    // /api/admin/update-order-email (POST)
    // ============================================
    if (path === '/api/admin/update-order-email' && method === 'POST') {
      try {
        const authResult = await verifyAdminAuth(req);
        
        if (!authResult.valid) {
          return res.status(authResult.statusCode || 401).json({
            error: authResult.error,
            reason: authResult.reason || 'Authentication failed',
            valid: false
          });
        }
        
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
          return res.status(500).json({ error: 'Supabase not configured' });
        }
        
        const bodyData = await parseBody(req);
        const { orderId, newEmail } = bodyData;
        const adminId = authResult.admin?.id;
        const adminEmail = authResult.admin?.email;
        
        if (!orderId) {
          return res.status(400).json({ error: 'Order ID is required' });
        }
        
        if (!newEmail || typeof newEmail !== 'string') {
          return res.status(400).json({ error: 'Valid email address is required' });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail.trim())) {
          return res.status(400).json({ error: 'Invalid email format' });
        }
        
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_ANON_KEY
        );
        
        let supabaseService = null;
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          supabaseService = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
          );
        }
        
        const dbClient = supabaseService || supabase;
        
        // Step 1: Verify order exists and get current email
        const { data: order, error: orderError } = await dbClient
          .from('orders')
          .select('id, user_email')
          .eq('id', orderId)
          .single();
        
        if (orderError || !order) {
          return res.status(404).json({ error: 'Order not found' });
        }
        
        const oldEmail = order.user_email || null;
        const trimmedNewEmail = newEmail.trim();
        
        // Step 2: Check if email is actually changing
        if (oldEmail === trimmedNewEmail) {
          return res.status(200).json({
            success: true,
            message: 'Email unchanged',
            orderId: orderId,
            email: trimmedNewEmail
          });
        }
        
        // Step 3: Update only user_email field
        const { data: updatedOrder, error: updateError } = await dbClient
          .from('orders')
          .update({
            user_email: trimmedNewEmail,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId)
          .select('id, user_email')
          .single();
        
        if (updateError || !updatedOrder) {
          console.error('Error updating order email:', updateError);
          return res.status(500).json({
            error: 'Failed to update order email',
            details: updateError?.message || 'Unknown error'
          });
        }
        
        // Step 4: Log to order_logs (audit trail)
        try {
          await dbClient.from('order_logs').insert({
            order_id: orderId,
            action: 'admin_update_email',
            performed_by: adminId,
            performed_by_type: 'admin',
            details: {
              old_email: oldEmail,
              new_email: trimmedNewEmail,
              admin_id: adminId,
              admin_email: adminEmail,
              timestamp: new Date().toISOString()
            }
          });
        } catch (logError) {
          console.error('Error creating audit log:', logError);
          // Don't fail the request if logging fails, but log the error
        }
        
        return res.status(200).json({
          success: true,
          message: 'Order email updated successfully',
          orderId: orderId,
          oldEmail: oldEmail,
          newEmail: trimmedNewEmail
        });
      } catch (error) {
        console.error('Error in /api/admin/update-order-email:', error);
        return res.status(500).json({
          error: 'Internal server error',
          details: error.message
        });
      }
    }
    
    // ============================================
    // /api/admin-resend-ticket-email (POST)
    // ============================================
    if (path === '/api/admin-resend-ticket-email' && method === 'POST') {
      try {
        const authResult = await verifyAdminAuth(req);
        
        if (!authResult.valid) {
          return res.status(authResult.statusCode || 401).json({
            error: authResult.error,
            reason: authResult.reason || 'Authentication failed',
            valid: false
          });
        }
        
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
          return res.status(500).json({ error: 'Supabase not configured' });
        }
        
        const bodyData = await parseBody(req);
        const { orderId } = bodyData;
        const adminId = authResult.admin?.id;
        const adminEmail = authResult.admin?.email;
        
        if (!orderId) {
          return res.status(400).json({ error: 'Order ID is required' });
        }
        
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_ANON_KEY
        );
        
        let supabaseService = null;
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          supabaseService = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
          );
        }
        
        const dbClient = supabaseService || supabase;
        
        // Step 1: Verify order exists and is PAID
        const { data: order, error: orderError } = await dbClient
          .from('orders')
          .select(`
            id, 
            order_number,
            status, 
            payment_status,
            source,
            user_email,
            user_name,
            total_price,
            pass_type,
            quantity,
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
        
        // Step 2: Validate order is PAID
        if (order.status !== 'PAID' && order.payment_status !== 'PAID') {
          // Log security event
          try {
            await dbClient.from('security_audit_logs').insert({
              event_type: 'invalid_resend_attempt',
              endpoint: '/api/admin-resend-ticket-email',
              user_id: adminId,
              ip_address: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown',
              user_agent: req.headers['user-agent'] || 'unknown',
              request_method: req.method,
              request_path: req.url,
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
        
        // Step 6: Build email HTML (reuse same template as ticket generation)
        // Group tickets by pass type
        const ticketsByPassType = new Map();
        tickets.forEach(ticket => {
          const pass = passes.find(p => p.id === ticket.order_pass_id || (p.id === 'legacy' && !ticket.order_pass_id));
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
        
        const passesSummaryHtml = passesSummary.map(p => `
          <tr style="border-bottom: 1px solid rgba(0, 0, 0, 0.1);">
            <td style="padding: 12px 0; color: #1A1A1A; font-size: 15px;">${p.passType}</td>
            <td style="padding: 12px 0; color: #1A1A1A; font-size: 15px; text-align: center;">${p.quantity}</td>
            <td style="padding: 12px 0; color: #1A1A1A; font-size: 15px; text-align: right;">${p.price.toFixed(2)} TND</td>
          </tr>
        `).join('');
        
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Your Digital Tickets - Andiamo Events</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1A1A1A; background: #FFFFFF; }
              .email-wrapper { max-width: 600px; margin: 0 auto; background: #FFFFFF; }
              .content-card { background: #F5F5F5; margin: 0 20px 30px; border-radius: 12px; padding: 50px 40px; border: 1px solid rgba(0, 0, 0, 0.1); }
              .title-section { text-align: center; margin-bottom: 40px; padding-bottom: 30px; border-bottom: 1px solid rgba(0, 0, 0, 0.1); }
              .title { font-size: 32px; font-weight: 700; color: #1A1A1A; margin-bottom: 12px; }
              .subtitle { font-size: 16px; color: #666666; }
              .greeting { font-size: 18px; color: #1A1A1A; margin-bottom: 30px; }
              .greeting strong { color: #E21836; font-weight: 600; }
              .message { font-size: 16px; color: #666666; margin-bottom: 25px; }
              .order-info-block { background: #E8E8E8; border: 1px solid rgba(0, 0, 0, 0.15); border-radius: 8px; padding: 30px; margin: 40px 0; }
              .info-row { margin-bottom: 20px; }
              .info-label { font-size: 11px; color: #999999; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 10px; font-weight: 600; }
              .info-value { font-family: 'Courier New', monospace; font-size: 18px; color: #1A1A1A; font-weight: 500; }
              .passes-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              .passes-table th { text-align: left; padding: 12px 0; color: #E21836; font-weight: 600; font-size: 14px; border-bottom: 2px solid rgba(226, 24, 54, 0.3); }
              .passes-table td { padding: 12px 0; color: #1A1A1A; font-size: 15px; }
              .total-row { border-top: 2px solid rgba(226, 24, 54, 0.3); }
              .total-row td { font-weight: 700; font-size: 18px; color: #E21836; padding-top: 15px; }
              .tickets-section { background: #E8E8E8; border: 1px solid rgba(0, 0, 0, 0.15); border-radius: 8px; padding: 30px; margin: 40px 0; }
              .support-section { background: #E8E8E8; border-left: 3px solid rgba(226, 24, 54, 0.3); padding: 20px 25px; margin: 35px 0; border-radius: 4px; }
              .support-text { font-size: 14px; color: #666666; line-height: 1.7; }
              .support-email { color: #E21836 !important; text-decoration: none; font-weight: 500; }
              .closing-section { text-align: center; margin: 50px 0 40px; padding-top: 40px; border-top: 1px solid rgba(0, 0, 0, 0.1); }
              .slogan { font-size: 24px; font-style: italic; color: #E21836; font-weight: 300; margin-bottom: 30px; }
              .signature { font-size: 16px; color: #666666; line-height: 1.7; }
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
                <p class="message">We're excited to confirm that your order has been successfully processed! Your digital tickets with unique QR codes are ready and attached below.</p>
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
                    <div style="font-size: 18px; color: #E21836; font-weight: 600;">${order.events?.date ? (() => {
                      try {
                        const date = new Date(order.events.date);
                        if (!isNaN(date.getTime())) {
                          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                          const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                          const dayName = days[date.getDay()];
                          const day = date.getDate();
                          const monthName = months[date.getMonth()];
                          const year = date.getFullYear();
                          const hours = date.getHours().toString().padStart(2, '0');
                          const minutes = date.getMinutes().toString().padStart(2, '0');
                          return `${dayName} · ${day} ${monthName} ${year} · ${hours}:${minutes}`;
                        }
                      } catch (e) {}
                      return 'TBA';
                    })() : 'TBA'}</div>
                  </div>
                  <div class="info-row">
                    <div class="info-label">Venue</div>
                    <div style="font-size: 18px; color: #E21836; font-weight: 600;">${order.events?.venue || 'Venue to be announced'}</div>
                  </div>
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
                  <p class="message" style="margin-bottom: 25px;">Please present these QR codes at the event entrance. Each ticket has a unique QR code for verification.</p>
                  ${ticketsHtml}
                </div>
                <div class="support-section">
                  <p class="support-text">Need assistance? Contact us at <a href="mailto:support@andiamoevents.com" class="support-email">support@andiamoevents.com</a>.</p>
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
        
        // Step 7: Send email
        let emailSent = false;
        let emailError = null;
        
        if (order.user_email && process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_HOST) {
          try {
            const nodemailer = await import('nodemailer');
            const transporter = nodemailer.default.createTransport({
              host: process.env.EMAIL_HOST,
              port: parseInt(process.env.EMAIL_PORT || '587'),
              secure: false,
              auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
              },
            });
            
            // CRITICAL: Brevo SMTP restriction - The SMTP login (EMAIL_USER) must NEVER be used as the "from" address.
            // Emails must be sent from a verified sender domain. Use contact@andiamoevents.com instead.
            await transporter.sendMail({
              from: '"Andiamo Events" <contact@andiamoevents.com>',
              replyTo: '"Andiamo Events" <contact@andiamoevents.com>',
              to: order.user_email,
              subject: 'Your Digital Tickets Are Ready - Andiamo Events',
              html: emailHtml
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
            
            console.log('✅ Email sent successfully');
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
        } else {
          return res.status(400).json({
            error: 'Email service not configured or customer email missing',
            details: !order.user_email ? 'Customer email is required' : 'Email service not configured'
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
        } catch (logError) {
          console.error('❌ Error creating audit log:', logError);
        }
        
        if (!emailSent) {
          return res.status(500).json({
            error: 'Failed to send email',
            details: emailError?.message || 'Unknown error',
            orderId: orderId
          });
        }
        
        return res.status(200).json({
          success: true,
          message: 'Ticket email resent successfully',
          orderId: orderId,
          emailSent: true,
          ticketsCount: tickets.length
        });
      } catch (error) {
        console.error('Error in /api/admin-resend-ticket-email:', error);
        return res.status(500).json({
          error: 'Failed to resend ticket email',
          details: error.message
        });
      }
    }
    
    // ============================================
    // /api/admin/ambassador-sales/orders (GET)
    // ============================================
    if (path === '/api/admin/ambassador-sales/orders' && method === 'GET') {
      try {
        const authResult = await verifyAdminAuth(req);
        
        if (!authResult.valid) {
          return res.status(authResult.statusCode || 401).json({
            error: authResult.error,
            reason: authResult.reason || 'Authentication failed',
            valid: false
          });
        }
        
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
          return res.status(500).json({ 
            error: 'Server configuration error',
            details: 'Supabase not configured. Please check SUPABASE_URL and SUPABASE_ANON_KEY environment variables.'
          });
        }
        
        const { createClient } = await import('@supabase/supabase-js');
        
        // Use service role key if available (for RLS bypass)
        let supabase;
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
          );
        } else {
          supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
          );
        }
        
        // Parse query parameters from req.url
        const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
        const searchParams = new URLSearchParams(queryString);
        const status = searchParams.get('status');
        const ambassador_id = searchParams.get('ambassador_id');
        const city = searchParams.get('city');
        const ville = searchParams.get('ville');
        const date_from = searchParams.get('date_from');
        const date_to = searchParams.get('date_to');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const include_removed = searchParams.get('include_removed');
        
        let query = supabase
          .from('orders')
          .select('*, order_passes (*), ambassadors (id, full_name, phone, email)', { count: 'exact' })
          .eq('payment_method', 'ambassador_cash')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        
        // Exclude REMOVED_BY_ADMIN orders by default (only show when explicitly filtering by that status)
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
        
        const { data, error, count } = await query;
        
        if (error) {
          console.error('Error fetching ambassador orders:', error);
          return res.status(500).json({ error: error.message });
        }
        
        return res.status(200).json({
          success: true,
          data: data || [],
          count: count || 0
        });
        
      } catch (error) {
        console.error('Error in ambassador-sales/orders endpoint:', error);
        return res.status(500).json({ 
          error: error.message || 'Failed to fetch ambassador orders' 
        });
      }
    }

    // /api/admin-remove-order (POST)
    // ============================================
    if (path === '/api/admin-remove-order' && method === 'POST') {
      try {
        const authResult = await verifyAdminAuth(req);
        
        if (!authResult.valid) {
          return res.status(authResult.statusCode || 401).json({
            error: authResult.error,
            reason: authResult.reason || 'Authentication failed',
            valid: false
          });
        }
        
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
          return res.status(500).json({ 
            error: 'Server configuration error',
            details: 'Supabase not configured. Please check SUPABASE_URL and SUPABASE_ANON_KEY environment variables.'
          });
        }
        
        const bodyData = await parseBody(req);
        const { orderId } = bodyData;
        const adminId = authResult.admin?.id;
        const adminEmail = authResult.admin?.email;
        
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
        
        const { createClient } = await import('@supabase/supabase-js');
        
        // Use service role key if available (for RLS bypass)
        let supabase;
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
          );
        } else {
          supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
          );
        }
        
        // Step 1: Verify order exists and get current status
        const { data: order, error: orderError } = await supabase
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
            await supabase.from('security_audit_logs').insert({
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
        const { data: orderPasses, error: passesError } = await supabase
          .from('order_passes')
          .select('*')
          .eq('order_id', orderId);
        
        if (passesError) {
          console.error('⚠️ Error fetching order passes (non-critical):', passesError);
          // Continue anyway - order_passes are preserved for audit
        }
        
        // Step 5: Update order status to REMOVED_BY_ADMIN (soft delete)
        const oldStatus = order.status;
        const { data: updatedOrder, error: updateError } = await supabase
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
          const { data: checkOrder } = await supabase
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
          // Step 6a: Atomically check and set stock_released flag (idempotency)
          const { data: orderUpdate, error: updateError } = await supabase
            .from('orders')
            .update({ stock_released: true })
            .eq('id', orderId)
            .eq('stock_released', false)  // Only update if NOT already released
            .select('id, status')
            .single();

          // If stock was already released, skip (idempotent)
          if (!updateError && orderUpdate) {
            // Step 6b: Fetch order_passes with pass_id
            const { data: orderPasses, error: passesError } = await supabase
              .from('order_passes')
              .select('pass_id, quantity')
              .eq('order_id', orderId)
              .not('pass_id', 'is', null);

            if (!passesError && orderPasses && orderPasses.length > 0) {
              // Step 6c: Decrement sold_quantity for each pass
              let releasedCount = 0;
              for (const orderPass of orderPasses) {
                if (!orderPass.pass_id) continue;

                // Fetch current sold_quantity
                const { data: currentPass, error: fetchError } = await supabase
                  .from('event_passes')
                  .select('sold_quantity')
                  .eq('id', orderPass.pass_id)
                  .single();

                if (!fetchError && currentPass) {
                  // Decrement stock atomically
                  const newSoldQuantity = Math.max(0, currentPass.sold_quantity - orderPass.quantity);
                  const { error: stockUpdateError } = await supabase
                    .from('event_passes')
                    .update({ sold_quantity: newSoldQuantity })
                    .eq('id', orderPass.pass_id)
                    .eq('sold_quantity', currentPass.sold_quantity);

                  if (!stockUpdateError) {
                    releasedCount++;
                  }
                }
              }

              // Step 6d: Log stock release
              if (releasedCount > 0) {
                await supabase.from('order_logs').insert({
                  order_id: orderId,
                  action: 'stock_released',
                  performed_by: adminId,
                  performed_by_type: 'system',
                  details: {
                    reason: `Removed by admin: ${adminEmail || 'Unknown admin'}`,
                    passes_released: releasedCount,
                    timestamp: new Date().toISOString()
                  }
                });
                console.log(`✅ Stock released for ${releasedCount} pass(es)`);
              }
            }
          } else {
            console.log('⚠️ Stock already released or order not found (idempotent)');
          }
        } catch (stockError) {
          console.error('❌ Error releasing stock on admin remove:', stockError);
          // Log but don't fail - order is removed, stock release is important but non-blocking
        }

        // Step 7: Log to order_logs (audit trail)
        try {
          await supabase.from('order_logs').insert({
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
          // Don't fail the request if logging fails
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
    }
    
    // /api/admin/aio-events-submissions (GET)
    if (path === '/api/admin/aio-events-submissions' && method === 'GET') {
      try {
        // Verify admin authentication
        const authResult = await verifyAdminAuth(req);
        if (!authResult.valid) {
          return res.status(authResult.statusCode || 401).json({
            error: authResult.error,
            details: authResult.details || authResult.reason
          });
        }

        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
          return res.status(500).json({ 
            error: 'Supabase not configured',
            details: 'Please check SUPABASE_URL and SUPABASE_ANON_KEY environment variables'
          });
        }

        const { createClient } = await import('@supabase/supabase-js');
        
        // Use service role key if available for better access
        let supabase;
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
          );
        } else {
          supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
          );
        }

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

        // Build query
        let query = supabase
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
          stack: error.stack
        });
        return res.status(500).json({ 
          error: 'Server error',
          details: error.message || 'An unexpected error occurred while fetching submissions'
        });
      }
    }
    
    // 404 for unknown routes
    return res.status(404).json({
      error: 'Not Found',
      message: `API route not found: ${path}`
    });
    
  } catch (error) {
    console.error('API Router Error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message
    });
  }
};
