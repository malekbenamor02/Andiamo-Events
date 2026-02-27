// POST /api/aio-events/save-submission
// Saves user data when they click "Online Payment By AIO Events"
// Does NOT create orders, send emails, or send SMS - just saves data for lead generation
// Vercel serverless function

import { createClient } from '@supabase/supabase-js';

// Import shared CORS utility (using dynamic import for ES modules)
let corsUtils = null;
async function getCorsUtils() {
  if (!corsUtils) {
    corsUtils = await import('../lib/cors.js');
  }
  return corsUtils;
}

export default async (req, res) => {
  const { setCORSHeaders, handlePreflight } = await getCorsUtils();
  
  // Handle preflight requests
  if (handlePreflight(req, res, { methods: 'POST, OPTIONS', headers: 'Content-Type', credentials: false })) {
    return; // Preflight handled
  }
  
  // Set CORS headers for actual requests (no credentials needed)
  if (!setCORSHeaders(res, req, { methods: 'POST, OPTIONS', headers: 'Content-Type', credentials: false })) {
    if (req.headers.origin) {
      return res.status(403).json({ error: 'CORS policy: Origin not allowed' });
    }
  }
  
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      console.error('❌ Missing Supabase environment variables:', {
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY
      });
      return res.status(500).json({ error: 'Supabase not configured' });
    }

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

    const {
      customerInfo,
      eventInfo,
      selectedPasses,
      totalPrice,
      totalQuantity,
      language
    } = bodyData;

    // Validate required fields
    if (!customerInfo) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'customerInfo is required'
      });
    }

    // Validate customer info
    if (!customerInfo.full_name || !customerInfo.phone || !customerInfo.email || !customerInfo.city) {
      return res.status(400).json({
        error: 'Missing customer information',
        details: 'full_name, phone, email, and city are required'
      });
    }

    // Validate selected passes (allow empty array)
    if (!Array.isArray(selectedPasses)) {
      return res.status(400).json({
        error: 'Invalid passes',
        details: 'selectedPasses must be an array'
      });
    }

    // Validate totals
    if (typeof totalPrice !== 'number' || totalPrice < 0) {
      return res.status(400).json({
        error: 'Invalid total price',
        details: 'totalPrice must be a non-negative number'
      });
    }

    if (typeof totalQuantity !== 'number' || totalQuantity < 0) {
      return res.status(400).json({
        error: 'Invalid total quantity',
        details: 'totalQuantity must be a non-negative number'
      });
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Use service role key if available for better access
    let dbClient = supabase;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      dbClient = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
    }

    // Extract IP address and user agent
    const ipAddress = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip || null;
    const userAgent = req.headers['user-agent'] || null;

    // Prepare submission data
    const submissionData = {
      // Customer Information
      full_name: customerInfo.full_name.trim(),
      email: customerInfo.email.trim().toLowerCase(),
      phone: customerInfo.phone.trim(),
      city: customerInfo.city.trim(),
      ville: customerInfo.ville ? customerInfo.ville.trim() : null,
      
      // Event Information
      event_id: eventInfo?.id || null,
      event_name: eventInfo?.name || null,
      event_date: eventInfo?.date || null,
      event_venue: eventInfo?.venue || null,
      event_city: eventInfo?.city || null,
      
      // Selected Passes (as JSONB)
      selected_passes: selectedPasses,
      
      // Totals
      total_price: totalPrice,
      total_quantity: totalQuantity,
      
      // Metadata
      language: language || 'en',
      user_agent: userAgent,
      ip_address: ipAddress,
      status: 'submitted'
    };

    // Insert submission into database
    const { data: submission, error: insertError } = await dbClient
      .from('aio_events_submissions')
      .insert(submissionData)
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting AIO events submission:', insertError);
      return res.status(500).json({
        error: 'Failed to save submission',
        details: insertError.message
      });
    }

    // Return success response
    res.status(201).json({
      success: true,
      submission: {
        id: submission.id,
        submitted_at: submission.submitted_at
      }
    });

  } catch (error) {
    console.error('Error in /api/aio-events/save-submission:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
};
