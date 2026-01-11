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
  const path = req.url.split('?')[0]; // Remove query string
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

        if (normalizedVille) {
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
        
        await transporter.sendMail({
          from: from || `Andiamo Events <${process.env.EMAIL_USER}>`,
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
