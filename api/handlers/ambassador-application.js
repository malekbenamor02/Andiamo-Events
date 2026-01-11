// Ambassador application endpoint for Vercel
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
    
    const { fullName, age, phoneNumber, email, city, ville, socialLink, motivation } = bodyData;

    // Validate required fields
    if (!fullName || !age || !phoneNumber || !city) {
      return res.status(400).json({ error: 'Full name, age, phone number, and city are required' });
    }

    // Validate motivation is required
    if (!motivation || !motivation.trim()) {
      return res.status(400).json({ error: 'Motivation is required' });
    }

    // Validate phone number format
    const phoneRegex = /^[2459][0-9]{7}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({ error: 'Phone number must be 8 digits starting with 2, 4, 5, or 9' });
    }

    // Validate Instagram link if provided
    if (socialLink && !socialLink.trim().startsWith('https://www.instagram.com/') && !socialLink.trim().startsWith('https://instagram.com/')) {
      return res.status(400).json({ error: 'Instagram link must start with https://www.instagram.com/ or https://instagram.com/' });
    }

    // Check environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return res.status(500).json({ 
        error: 'Supabase not configured',
        details: 'Please check environment variables: SUPABASE_URL and SUPABASE_ANON_KEY must be set'
      });
    }

    // Initialize Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Sanitize inputs
    const sanitizedFullName = fullName.trim();
    const sanitizedEmail = email ? email.trim() : null;
    const sanitizedCity = city ? city.trim() : '';
    
    // Handle ville - check if it exists and is not empty
    let sanitizedVille = null;
    if (ville !== undefined && ville !== null && String(ville).trim() !== '') {
      sanitizedVille = String(ville).trim();
    }
    const sanitizedSocialLink = socialLink ? socialLink.trim() : null;
    const sanitizedMotivation = motivation.trim(); // Already validated as required above

    // Check for duplicate phone number in active ambassadors
    const { data: existingAmbByPhone } = await supabase
      .from('ambassadors')
      .select('id')
      .eq('phone', phoneNumber)
      .maybeSingle();

    if (existingAmbByPhone) {
      return res.status(400).json({ error: 'This phone number is already registered as an approved ambassador' });
    }

    // Check for duplicate email in active ambassadors (if email provided)
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

    // Check for duplicate phone number in applications
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

    // Check for duplicate email in applications (if email provided)
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

    // Check for rejected/removed applications and verify reapply delay (30 days)
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

    // Check by email if provided
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

    // Insert new application
    // Validate and set ville value for Sousse and Tunis
    let villeValue = null;
    
    // Handle ville for Sousse
    if (sanitizedCity === 'Sousse') {
      if (!sanitizedVille || sanitizedVille.trim() === '') {
        return res.status(400).json({ error: 'Ville (neighborhood) is required for Sousse' });
      }
      villeValue = sanitizedVille.trim();
    }
    
    // Handle ville for Tunis
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
};

