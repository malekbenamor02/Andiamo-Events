// Phone subscription endpoint for Vercel
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
    
    const { phone_number, language } = bodyData;

    // Validate required fields
    if (!phone_number) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Validate phone number format: exactly 8 digits, numeric only, starts with 2, 4, 5, or 9
    const phoneRegex = /^[2594][0-9]{7}$/;
    if (!phoneRegex.test(phone_number)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
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

    // Check for duplicate phone number in phone_subscribers table
    const { data: existingSubscriber, error: checkError } = await supabase
      .from('phone_subscribers')
      .select('id')
      .eq('phone_number', phone_number)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" which is fine
      console.error('Error checking for duplicate phone number:', checkError);
      return res.status(500).json({ error: 'Failed to check phone number' });
    }

    if (existingSubscriber) {
      return res.status(400).json({ error: 'Phone number already exists' });
    }

    // Insert new subscriber
    const { data: subscriber, error: insertError } = await supabase
      .from('phone_subscribers')
      .insert({
        phone_number: phone_number,
        language: language || 'en'
      })
      .select()
      .single();

    if (insertError) {
      // Check if it's a duplicate key error (race condition)
      if (insertError.code === '23505' || insertError.message?.includes('unique constraint') || insertError.message?.includes('duplicate key')) {
        return res.status(400).json({ error: 'Phone number already exists' });
      }
      console.error('Error inserting phone subscriber:', insertError);
      return res.status(500).json({ error: 'Failed to subscribe', details: insertError.message });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Phone number subscribed successfully',
      subscriber: {
        id: subscriber.id,
        phone_number: subscriber.phone_number
      }
    });
  } catch (error) {
    console.error('Error in phone subscription:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
};

